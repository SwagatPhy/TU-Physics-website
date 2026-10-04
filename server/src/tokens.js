// Single-use links for registration and password reset.
// The random token goes in the emailed link; the database stores only its
// SHA-256 hash, the purpose, who it's for, an expiry time and when it was used.

import { randomBytes, createHash } from 'node:crypto';
import { toDbTime } from './db.js';

function hashToken(token) {
	return createHash('sha256').update(token).digest('hex');
}

// Creates a token and returns it (to put in the link).
// purpose 'register' links point at a sign-up (signupId); 'reset' links at a user.
export function createLinkToken(db, { purpose, signupId = null, userId = null, minutes }) {
	const token = randomBytes(32).toString('base64url');
	const now = new Date();
	db.prepare(
		`INSERT INTO auth_tokens (id, purpose, signup_id, user_id, expires_at, created_at)
		 VALUES (?, ?, ?, ?, ?, ?)`,
	).run(hashToken(token), purpose, signupId, userId, toDbTime(new Date(now.getTime() + minutes * 60 * 1000)), toDbTime(now));
	return token;
}

// Marks a token as used and returns its row, or returns null if the token is
// unknown, for another purpose, already used or expired. Marking it used is a
// single UPDATE that only succeeds once, so two simultaneous requests can't
// both use the same link.
export function useLinkToken(db, token, purpose) {
	if (typeof token !== 'string' || token.length > 100) return null;
	const id = hashToken(token);
	const now = toDbTime(new Date());
	const result = db
		.prepare('UPDATE auth_tokens SET used_at = ? WHERE id = ? AND purpose = ? AND used_at IS NULL AND expires_at > ?')
		.run(now, id, purpose, now);
	if (result.changes !== 1) return null;
	return db.prepare('SELECT * FROM auth_tokens WHERE id = ?').get(id);
}

// When a new link is sent, older unused links for the same person stop working:
// reset links by user, registration links by the email address signed up with.
export function cancelUnusedResetLinks(db, userId) {
	db.prepare("UPDATE auth_tokens SET used_at = ? WHERE purpose = 'reset' AND user_id = ? AND used_at IS NULL").run(
		toDbTime(new Date()),
		userId,
	);
}

export function cancelUnusedRegistrationLinks(db, email) {
	db.prepare(
		`UPDATE auth_tokens SET used_at = ?
		 WHERE purpose = 'register' AND used_at IS NULL
		   AND signup_id IN (SELECT id FROM signups WHERE email = ?)`,
	).run(toDbTime(new Date()), email);
}
