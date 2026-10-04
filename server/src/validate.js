// Input checks shared by the routes. Each returns an error code (shown to the
// user as text chosen by Notes-manager TU) or the cleaned value.

import { toDbTime } from './db.js';

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
