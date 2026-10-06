// Tiny fake files for the upload tests: a minimal ZIP writer, so the tests can
// build Word/PowerPoint-shaped files (good and bad) without fixture files.

import { crc32, deflateRawSync } from 'node:zlib';

// entries: [{ name, data (string|Buffer), deflate?: boolean, claimedSize?: number }]
// claimedSize lies about the uncompressed size (to test the zip-bomb limits).
export function makeZip(entries) {
	const locals = [];
	const directory = [];
	let offset = 0;
	for (const entry of entries) {
		const name = Buffer.from(entry.name, 'utf8');
		const data = Buffer.from(entry.data);
		const stored = entry.deflate ? deflateRawSync(data) : data;
		const size = entry.claimedSize ?? data.length;

		const local = Buffer.alloc(30);
		local.writeUInt32LE(0x04034b50, 0);
		local.writeUInt16LE(20, 4);
		local.writeUInt16LE(entry.deflate ? 8 : 0, 8);
		local.writeUInt32LE(crc32(data), 14);
		local.writeUInt32LE(stored.length, 18);
		local.writeUInt32LE(size, 22);
		local.writeUInt16LE(name.length, 26);
		locals.push(local, name, stored);

		const central = Buffer.alloc(46);
		central.writeUInt32LE(0x02014b50, 0);
		central.writeUInt16LE(20, 4);
		central.writeUInt16LE(20, 6);
		central.writeUInt16LE(entry.deflate ? 8 : 0, 10);
		central.writeUInt32LE(crc32(data), 16);
		central.writeUInt32LE(stored.length, 20);
		central.writeUInt32LE(size, 24);
		central.writeUInt16LE(name.length, 28);
		central.writeUInt32LE(offset, 42);
		directory.push(central, name);

		offset += 30 + name.length + stored.length;
	}
	const directoryBytes = Buffer.concat(directory);
	const end = Buffer.alloc(22);
	end.writeUInt32LE(0x06054b50, 0);
	end.writeUInt16LE(entries.length, 8);
	end.writeUInt16LE(entries.length, 10);
	end.writeUInt32LE(directoryBytes.length, 12);
	end.writeUInt32LE(offset, 16);
	return Buffer.concat([...locals, directoryBytes, end]);
}

function contentTypes(mainPart, mainType) {
	return (
		'<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
		`<Default Extension="xml" ContentType="application/xml"/><Override PartName="/${mainPart}" ContentType="${mainType}"/></Types>`
	);
}
const DOCX_TYPE = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml';
const DOCM_TYPE = 'application/vnd.ms-word.document.macroEnabled.main+xml';
const PPTX_TYPE = 'application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml';

// A minimal .docx / .pptx: [Content_Types].xml plus the main part.
export function fakeDocx(extraEntries = []) {
	return makeZip([
		{ name: '[Content_Types].xml', data: contentTypes('word/document.xml', DOCX_TYPE), deflate: true },
		{ name: 'word/document.xml', data: '<w:document>TRIAL fake document</w:document>', deflate: true },
		...extraEntries,
	]);
}

export function fakePptx(extraEntries = []) {
	return makeZip([
		{ name: '[Content_Types].xml', data: contentTypes('ppt/presentation.xml', PPTX_TYPE), deflate: true },
		{ name: 'ppt/presentation.xml', data: '<p:presentation>TRIAL fake slides</p:presentation>', deflate: true },
		...extraEntries,
	]);
}

// A macro-enabled Word file (.docm) renamed to .docx, without a vbaProject.bin.
export function fakeMacroEnabledDocx() {
	return makeZip([
		{ name: '[Content_Types].xml', data: contentTypes('word/document.xml', DOCM_TYPE), deflate: true },
		{ name: 'word/document.xml', data: '<w:document/>' },
	]);
}

export const FAKE_PDF = Buffer.from('%PDF-1.4\n% TRIAL fake PDF for tests\n1 0 obj << >> endobj\ntrailer << >>\n%%EOF\n');
// The start of a Windows program (MZ header), to be renamed to other extensions.
export const FAKE_EXE = Buffer.concat([Buffer.from('MZ\x90\x00\x03\x00\x00\x00', 'latin1'), Buffer.alloc(64)]);
// The start of a legacy (OLE) Office file, as in .doc / .ppt.
export const FAKE_OLE = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(504)]);

export function upload(name, bytes) {
	return { name, data: Buffer.from(bytes).toString('base64') };
}
