// Input checks shared by the routes. Each returns an error code (shown to the
// user as text chosen by Notes-manager TU) or the cleaned value.

import { toDbTime } from './db.js';
import { readRollNumber } from './programmes.js';

// Only http(s) links may be stored or shown: anything else ("javascript:",
// "data:", …) could run code when clicked.
export function isWebLink(url) {
	try {
		return ['http:', 'https:'].includes(new URL(url).protocol);
	} catch {
		return false;
	}
}

function isBlank(value) {
	return value === undefined || value === null || value === '';
}

function checkTitle(title) {
	if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) return { error: 'invalid_title' };
	return { value: title.trim() };
}

function checkUrl(url) {
	if (typeof url !== 'string' || url.trim().length > 2000 || !isWebLink(url.trim())) return { error: 'invalid_url' };
	return { value: url.trim() };
}

// "Show to students from": optional; null means straight away.
function checkVisibleFrom(visibleFrom) {
	if (isBlank(visibleFrom)) return { value: null };
	const date = typeof visibleFrom === 'string' ? new Date(visibleFrom) : null;
	if (!date || Number.isNaN(date.getTime())) return { error: 'invalid_date' };
	return { value: toDbTime(date) };
}

// A class link: title and URL required, optional show-from date.
// Returns { error } or { value: { title, url, visibleFrom } }.
export function checkClassLink(body) {
	const title = checkTitle(body?.title);
	const url = checkUrl(body?.url);
	const visibleFrom = checkVisibleFrom(body?.visibleFrom);
	for (const result of [title, url, visibleFrom]) if (result.error) return result;
	return { value: { title: title.value, url: url.value, visibleFrom: visibleFrom.value } };
}

// The text part of a note: title, optional URL, optional show-from date.
// (The file is checked separately by checkUpload in files.js; the route makes
// sure a note ends up with a file, a URL, or both.)
// Returns { error } or { value: { title, url, visibleFrom } } (url may be null).
export function checkNoteDetails(body) {
	const title = checkTitle(body?.title);
	const url = isBlank(body?.url) ? { value: null } : checkUrl(body.url);
	const visibleFrom = checkVisibleFrom(body?.visibleFrom);
	for (const result of [title, url, visibleFrom]) if (result.error) return result;
	return { value: { title: title.value, url: url.value, visibleFrom: visibleFrom.value } };
}

// ---- Sign-up and profile details ------------------------------------------

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Digits with an optional leading + and spaces/dashes between: "+91 98765 43210", "03712-275000".
const PHONE_PATTERN = /^\+?[0-9][0-9 -]{5,18}[0-9]$/;

export function checkName(name) {
	if (typeof name !== 'string') return { error: 'invalid_name' };
	const clean = name.trim().replace(/\s+/g, ' ');
	if (!clean || clean.length > 200 || /[\u0000-\u001f<>]/.test(clean)) return { error: 'invalid_name' };
	return { value: clean };
}

export function checkPhone(phone) {
	if (typeof phone !== 'string' || !PHONE_PATTERN.test(phone.trim())) return { error: 'invalid_phone' };
	return { value: phone.trim() };
}

export function checkEmail(email) {
	if (typeof email !== 'string') return { error: 'invalid_email' };
	const clean = email.trim().toLowerCase();
	if (!EMAIL_PATTERN.test(clean) || clean.length > 254) return { error: 'invalid_email' };
	return { value: clean };
}

// A student roll number: a prefix from programmes.conf, the 2-digit joining
// year and a 3-digit serial (PHP22017).
// Returns { value: { rollNumber, programme, batchYear } } or { error }.
export function checkRollNumber(rollNumber, programmes) {
	if (typeof rollNumber !== 'string' || rollNumber.length > 30) return { error: 'invalid_roll_number' };
	const read = readRollNumber(programmes, rollNumber);
	return read ? { value: read } : { error: 'invalid_roll_number' };
}

// The sign-up form. kind is "student" (needs a roll number) or "member"
// (faculty, scholars, staff: no roll number). Format errors are fine to report
// straight away: they say nothing about which accounts exist.
export function checkSignup(body, programmes) {
	const { kind, name, email, rollNumber, phone } = body ?? {};
	if (!['student', 'member'].includes(kind)) return { error: 'invalid_kind' };
	for (const result of [checkName(name), checkEmail(email), checkPhone(phone)]) if (result.error) return result;

	let roll = { rollNumber: null, programme: null };
	if (kind === 'student') {
		const checked = checkRollNumber(rollNumber, programmes);
		if (checked.error) return checked;
		roll = checked.value;
	}
	return {
		value: {
			kind,
			name: checkName(name).value,
			email: checkEmail(email).value,
			phone: checkPhone(phone).value,
			...roll,
		},
	};
}
