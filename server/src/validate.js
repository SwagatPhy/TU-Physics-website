// Input checks shared by the routes. Each returns an error code (shown to the
// user as text chosen by Notes-manager TU) or the cleaned value.

import { toDbTime } from './db.js';
import { normalizeRollNumber, programmeForRollNumber } from './programmes.js';

export const RESOURCE_KINDS = ['class_link', 'notes', 'other'];

// Only http(s) links may be stored or shown: anything else ("javascript:",
// "data:", …) could run code when clicked.
export function isWebLink(url) {
	try {
		return ['http:', 'https:'].includes(new URL(url).protocol);
	} catch {
		return false;
	}
}

// Checks a class/notes link sent by a faculty member.
// Returns { error } or { value: { kind, title, url, visibleFrom } }.
export function checkResource(body) {
	const { kind, title, url, visibleFrom } = body ?? {};
	if (!RESOURCE_KINDS.includes(kind)) return { error: 'invalid_kind' };
	if (typeof title !== 'string' || !title.trim() || title.trim().length > 200) return { error: 'invalid_title' };
	if (typeof url !== 'string' || url.trim().length > 2000 || !isWebLink(url.trim())) return { error: 'invalid_url' };

	let visible = null;
	if (visibleFrom !== undefined && visibleFrom !== null && visibleFrom !== '') {
		const date = typeof visibleFrom === 'string' ? new Date(visibleFrom) : null;
		if (!date || Number.isNaN(date.getTime())) return { error: 'invalid_date' };
		visible = toDbTime(date);
	}
	return { value: { kind, title: title.trim(), url: url.trim(), visibleFrom: visible } };
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

// A student roll number: its prefix must be in programmes.conf.
// Returns { value: { rollNumber, programme } } or { error }.
export function checkRollNumber(rollNumber, programmes) {
	if (typeof rollNumber !== 'string' || rollNumber.length > 30) return { error: 'invalid_roll_number' };
	const clean = normalizeRollNumber(rollNumber);
	const programme = programmeForRollNumber(programmes, clean);
	if (!programme) return { error: 'invalid_roll_number' };
	return { value: { rollNumber: clean, programme } };
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
