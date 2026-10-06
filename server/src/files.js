// Note files: what may be uploaded, how it is checked, and where it is kept.
// (REPORT.md section 18.)
//
// - Allowed: .pdf .txt .md .csv .docx .pptx — one list, FILE_TYPES below.
//   Modern Word/PowerPoint only: no macro-enabled .docm/.pptm, no legacy
//   .doc/.ppt (old binary formats that can carry macros and are hard to check).
// - The type is checked by the file's content, not by the name the browser
//   sends: a PDF must start with "%PDF-", text must be valid UTF-8 without
//   binary bytes, and a .docx/.pptx must be a well-formed ZIP with the parts
//   Word/PowerPoint files have and no macro parts.
// - Files are stored in the uploads folder (outside the web root) under a
//   random 32-character name; the original name is kept only in the database.
//   They are only ever sent through the authenticated download endpoint.

import { mkdirSync, writeFileSync, rmSync, statSync } from 'node:fs';
import { join, basename } from 'node:path';
import { randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

// ---- Content checks ---------------------------------------------------------

function isPdf(buffer) {
	return buffer.subarray(0, 5).toString('latin1') === '%PDF-';
}

// Valid UTF-8, and no control characters except tab, newline, carriage return
// and form feed (a binary file renamed to .txt fails here).
function isPlainText(buffer) {
	let text;
	try {
		text = new TextDecoder('utf-8', { fatal: true }).decode(buffer);
	} catch {
		return false;
	}
	return !/[\u0000-\u0008\u000b\u000e-\u001f\u007f]/.test(text);
}

// Limits for .docx/.pptx, which are ZIP archives: refuse "zip bombs" (tiny
// files that expand enormously) and archives with absurd numbers of parts.
const ZIP_MAX_ENTRIES = 2000;
const ZIP_MAX_TOTAL_UNCOMPRESSED = 200 * 1024 * 1024;
const ZIP_MAX_RATIO = 200; // uncompressed / compressed, for parts over 1 MB
const CONTENT_TYPES_MAX = 1024 * 1024;

// Lists the files inside a ZIP from its central directory, or returns null if
// the archive is malformed or uses ZIP64 (never needed for files under 20 MB).
function readZipEntries(buffer) {
	const endSignature = 0x06054b50;
	let end = -1;
	for (let i = buffer.length - 22; i >= Math.max(0, buffer.length - 65557); i--) {
		if (buffer.readUInt32LE(i) === endSignature) {
			end = i;
			break;
		}
	}
	if (end < 0) return null;
	const count = buffer.readUInt16LE(end + 10);
	const directoryOffset = buffer.readUInt32LE(end + 16);
	if (count === 0xffff || directoryOffset === 0xffffffff || directoryOffset >= buffer.length) return null;

	const entries = [];
	let at = directoryOffset;
	for (let i = 0; i < count; i++) {
		if (at + 46 > buffer.length || buffer.readUInt32LE(at) !== 0x02014b50) return null;
		const nameLength = buffer.readUInt16LE(at + 28);
		const extraLength = buffer.readUInt16LE(at + 30);
		const commentLength = buffer.readUInt16LE(at + 32);
		if (at + 46 + nameLength > buffer.length) return null;
		entries.push({
			name: buffer.toString('utf8', at + 46, at + 46 + nameLength),
			method: buffer.readUInt16LE(at + 10),
			compressedSize: buffer.readUInt32LE(at + 20),
			uncompressedSize: buffer.readUInt32LE(at + 24),
			localHeaderOffset: buffer.readUInt32LE(at + 42),
		});
		at += 46 + nameLength + extraLength + commentLength;
	}
	return entries;
}

// The uncompressed content of one ZIP entry (stored or deflated), or null.
function readZipEntry(buffer, entry, maxBytes) {
	const at = entry.localHeaderOffset;
	if (entry.uncompressedSize > maxBytes || at + 30 > buffer.length || buffer.readUInt32LE(at) !== 0x04034b50) return null;
	const start = at + 30 + buffer.readUInt16LE(at + 26) + buffer.readUInt16LE(at + 28);
	const data = buffer.subarray(start, start + entry.compressedSize);
	try {
		if (entry.method === 0) return data;
		if (entry.method === 8) return inflateRawSync(data, { maxOutputLength: maxBytes });
	} catch {
		return null;
	}
	return null;
}

// A modern Office file: ZIP with [Content_Types].xml and parts under
// mainFolder ("word/" or "ppt/"), no macro (VBA) or ActiveX parts, no
// macro-enabled content type, and within the zip-bomb limits above.
function isOfficeFile(buffer, mainFolder) {
	if (buffer.subarray(0, 4).toString('latin1') !== 'PK\u0003\u0004') return false;
	const entries = readZipEntries(buffer);
	if (!entries || entries.length === 0 || entries.length > ZIP_MAX_ENTRIES) return false;

	let total = 0;
	for (const entry of entries) {
		total += entry.uncompressedSize;
		const ratio = entry.compressedSize > 0 ? entry.uncompressedSize / entry.compressedSize : Infinity;
		if (entry.uncompressedSize > 1024 * 1024 && ratio > ZIP_MAX_RATIO) return false;
		if (/vba|activex/i.test(entry.name)) return false; // vbaProject.bin, vbaData.xml, activeX/…
	}
	if (total > ZIP_MAX_TOTAL_UNCOMPRESSED) return false;

	const contentTypesEntry = entries.find((entry) => entry.name === '[Content_Types].xml');
	if (!contentTypesEntry || !entries.some((entry) => entry.name.startsWith(mainFolder))) return false;
	const contentTypes = readZipEntry(buffer, contentTypesEntry, CONTENT_TYPES_MAX);
	if (!contentTypes) return false;
	return !/macroEnabled|vbaProject/i.test(contentTypes.toString('utf8'));
}

// ---- The allow-list ---------------------------------------------------------

const TEXT = 'text/plain; charset=utf-8'; // .md and .csv are also served as plain text
export const FILE_TYPES = {
	pdf: { mime: 'application/pdf', check: isPdf },
	txt: { mime: TEXT, check: isPlainText },
	md: { mime: TEXT, check: isPlainText },
	csv: { mime: TEXT, check: isPlainText },
	docx: {
		mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
		check: (buffer) => isOfficeFile(buffer, 'word/'),
	},
	pptx: {
		mime: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
		check: (buffer) => isOfficeFile(buffer, 'ppt/'),
	},
};

// ---- Checking an upload -----------------------------------------------------

// An upload arrives as { name, data } with the file's bytes base64-encoded.
// Returns { error } (invalid_file, invalid_file_type, file_too_large) or
// { value: { fileName, buffer, mime, size } }.
export function checkUpload(file, maxBytes) {
	if (!file || typeof file.name !== 'string' || typeof file.data !== 'string' || file.name.length > 255) {
		return { error: 'invalid_file' };
	}
	const extension = file.name.split('.').pop().toLowerCase();
	const type = Object.hasOwn(FILE_TYPES, extension) ? FILE_TYPES[extension] : null;
	if (!type) return { error: 'invalid_file_type' };

	if (Math.floor((file.data.length * 3) / 4) > maxBytes + 3) return { error: 'file_too_large' }; // before decoding
	if (!/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) return { error: 'invalid_file' };
	const buffer = Buffer.from(file.data, 'base64');
	if (buffer.length > maxBytes) return { error: 'file_too_large' };
	if (buffer.length === 0 || !type.check(buffer)) return { error: 'invalid_file_type' };

	// The name people see: no folders, no control characters, at most 200 characters.
	const fileName = basename(file.name.replace(/\\/g, '/'))
		.replace(/[\u0000-\u001f\u007f"]/g, '')
		.trim()
		.slice(-200);
	return { value: { fileName: fileName || `note.${extension}`, buffer, mime: type.mime, size: buffer.length } };
}

// ---- Storing files ----------------------------------------------------------

const STORED_NAME = /^[a-f0-9]{32}$/;

// Saves the bytes under a new random name and returns that name.
export function storeFile(uploadsDir, buffer) {
	mkdirSync(uploadsDir, { recursive: true, mode: 0o700 });
	const name = randomBytes(16).toString('hex');
	writeFileSync(join(uploadsDir, name), buffer, { flag: 'wx', mode: 0o600 });
	return name;
}

// Full path of a stored file, or null if the name isn't one of ours.
export function storedFilePath(uploadsDir, storedName) {
	if (typeof storedName !== 'string' || !STORED_NAME.test(storedName)) return null;
	const path = join(uploadsDir, storedName);
	try {
		return statSync(path).isFile() ? path : null;
	} catch {
		return null;
	}
}

export function deleteStoredFile(uploadsDir, storedName) {
	if (typeof storedName === 'string' && STORED_NAME.test(storedName)) rmSync(join(uploadsDir, storedName), { force: true });
}
