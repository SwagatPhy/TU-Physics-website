// Passwords, sessions and the login cookie.
//
// - Passwords are hashed with argon2id (library defaults: 64 MB, 3 passes).
// - A session is a random 32-byte token in an HttpOnly cookie. The database
//   stores only its SHA-256 hash, plus timestamps for the idle and absolute
//   time limits.

import argon2 from 'argon2';
import { randomBytes, createHash } from 'node:crypto';
import { toDbTime, fromDbTime } from './db.js';

export const SESSION_COOKIE = 'dphy_session';
export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 200; // argon2 is slow on purpose; cap the input size

// ---- Passwords ----------------------------------------------------------

export function hashPassword(password) {
	return argon2.hash(password, { type: argon2.argon2id });
}

// Used when the email isn't found, so a wrong email takes as long as a wrong
// password and the response time doesn't reveal which accounts exist.
let dummyHash;
export async function verifyPassword(hash, password) {
	if (!hash) {
		dummyHash ??= await hashPassword('not-a-real-password');
		await argon2.verify(dummyHash, password);
		return false;
	}
	return argon2.verify(hash, password);
}

// Returns an error code for an unacceptable new password, or null if it's fine.
export function checkNewPassword(password) {
	if (typeof password !== 'string' || password.length < PASSWORD_MIN_LENGTH) return 'password_too_short';
	if (password.length > PASSWORD_MAX_LENGTH) return 'password_too_long';
	return null;
}

// ---- Sessions -----------------------------------------------------------

function hashToken(token) {
	return createHash('sha256').update(token).digest('hex');
}

// Creates a session row and returns the token to put in the cookie.
export function createSession(db, config, userId, { ip = null, userAgent = null } = {}) {
	const token = randomBytes(32).toString('base64url');
	const now = new Date();
	const expires = new Date(now.getTime() + config.sessionMaxDays * 24 * 60 * 60 * 1000);
	db.prepare(
		`INSERT INTO sessions (id, user_id, created_at, last_seen_at, expires_at, ip, user_agent)
		 VALUES (?, ?, ?, ?, ?, ?, ?)`,
	).run(hashToken(token), userId, toDbTime(now), toDbTime(now), toDbTime(expires), ip, userAgent?.slice(0, 500) ?? null);
	return token;
}

// Returns the logged-in user for a token, or null if the session is missing,
// past its idle or absolute limit, or the user has been deactivated or rejected.
export function findSessionUser(db, config, token) {
	if (!token) return null;
	const id = hashToken(token);
	const row = db
		.prepare(
			`SELECT s.last_seen_at, s.expires_at,
			        u.id, u.name, u.email, u.role, u.active, u.status, u.must_change_password,
			        u.phone, u.roll_number, u.programme
			 FROM sessions s JOIN users u ON u.id = s.user_id
			 WHERE s.id = ?`,
		)
		.get(id);
	if (!row) return null;

	const now = new Date();
	const idleLimit = new Date(fromDbTime(row.last_seen_at).getTime() + config.sessionIdleHours * 60 * 60 * 1000);
	if (!row.active || row.status === 'rejected' || now >= fromDbTime(row.expires_at) || now >= idleLimit) {
		db.prepare('DELETE FROM sessions WHERE id = ?').run(id);
		return null;
	}

	db.prepare('UPDATE sessions SET last_seen_at = ? WHERE id = ?').run(toDbTime(now), id);
	return {
		id: row.id,
		name: row.name,
		email: row.email,
		role: row.role,
		status: row.status,
		phone: row.phone,
		rollNumber: row.roll_number,
		programme: row.programme,
		mustChangePassword: Boolean(row.must_change_password),
	};
}

export function deleteSession(db, token) {
	if (token) db.prepare('DELETE FROM sessions WHERE id = ?').run(hashToken(token));
}

export function deleteAllSessionsForUser(db, userId) {
	db.prepare('DELETE FROM sessions WHERE user_id = ?').run(userId);
}

// ---- Cookie ---------------------------------------------------------------

export function readSessionToken(req) {
	const header = req.headers.cookie ?? '';
	for (const part of header.split(';')) {
		const [name, ...value] = part.trim().split('=');
		if (name === SESSION_COOKIE) return value.join('=') || null;
	}
	return null;
}

function cookieAttributes(config, maxAgeSeconds) {
	const attributes = [`Path=${config.basePath || '/'}`, 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];
	if (config.cookieSecure) attributes.push('Secure');
	return attributes.join('; ');
}

export function setSessionCookie(res, config, token) {
	const maxAge = config.sessionMaxDays * 24 * 60 * 60;
	res.append('Set-Cookie', `${SESSION_COOKIE}=${token}; ${cookieAttributes(config, maxAge)}`);
}

export function clearSessionCookie(res, config) {
	res.append('Set-Cookie', `${SESSION_COOKIE}=; ${cookieAttributes(config, 0)}`);
}

// ---- Middleware ---------------------------------------------------------

// Attaches req.user (or null) and req.sessionToken to every request.
export function loadSession(db, config) {
	return (req, res, next) => {
		req.sessionToken = readSessionToken(req);
		req.user = findSessionUser(db, config, req.sessionToken);
		next();
	};
}

export function requireLogin(req, res, next) {
	if (!req.user) return res.status(401).json({ error: 'not_logged_in' });
	next();
}

// For every portal endpoint except /me, /logout and /change-password:
// a user with a temporary password must change it before doing anything else.
export function requirePasswordChanged(req, res, next) {
	if (req.user?.mustChangePassword) return res.status(403).json({ error: 'password_change_required' });
	next();
}

// For everything except /me, /logout, /change-password and /profile: a
// self-registered account can't use the portal until an admin approves it.
export function requireApproved(req, res, next) {
	if (req.user?.status !== 'approved') return res.status(403).json({ error: 'approval_pending' });
	next();
}

// Allows only the given roles, e.g. requireRole('faculty', 'admin').
export function requireRole(...roles) {
	return (req, res, next) => {
		if (!roles.includes(req.user?.role)) return res.status(403).json({ error: 'not_allowed' });
		next();
	};
}

// Cross-site forms can't send "Content-Type: application/json" without the
// browser asking first (a CORS preflight, which this API never approves), so
// requiring that header on every state-changing request blocks cross-site
// request forgery. The header itself is checked (not req.is()), because
// req.is() ignores it on requests with an empty body, such as logout.
export function requireJson(req, res, next) {
	if (req.method === 'GET' || req.method === 'HEAD') return next();
	const type = (req.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
	if (type !== 'application/json') return res.status(415).json({ error: 'json_required' });
	next();
}
