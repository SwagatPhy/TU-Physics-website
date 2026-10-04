// POST /api/login, POST /api/logout, GET /api/me, POST /api/change-password
//
// Responses carry short error codes (e.g. "invalid_credentials"), not
// sentences. The Astro pages turn each code into the wording supplied by
// Notes-manager TU, so all user-facing text lives in one place.

import { Router } from 'express';
import { logAudit } from '../audit.js';
import { toDbTime } from '../db.js';
import {
	hashPassword,
	verifyPassword,
	checkNewPassword,
	createSession,
	deleteSession,
	deleteAllSessionsForUser,
	setSessionCookie,
	clearSessionCookie,
	requireLogin,
	requirePasswordChanged,
	PASSWORD_MAX_LENGTH,
} from '../auth.js';
import { checkName, checkPhone } from '../validate.js';

// What the browser may know about the logged-in person (their own details).
function publicUser(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		status: user.status,
		phone: user.phone ?? null,
		rollNumber: user.rollNumber ?? user.roll_number ?? null,
		programme: user.programme ?? null,
		mustChangePassword: Boolean(user.mustChangePassword ?? user.must_change_password),
	};
}

export function authRoutes({ db, config, loginLimiter }) {
	const router = Router();

	router.post('/login', async (req, res) => {
		const { email, password } = req.body ?? {};
		if (typeof email !== 'string' || typeof password !== 'string' || email.length > 254 || password.length > PASSWORD_MAX_LENGTH) {
			return res.status(400).json({ error: 'invalid_input' });
		}
		const normalizedEmail = email.trim().toLowerCase();

		const waitSeconds = loginLimiter.check(req.ip, normalizedEmail);
		if (waitSeconds > 0) {
			res.set('Retry-After', String(waitSeconds));
			return res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: waitSeconds });
		}

		const user = db.prepare('SELECT * FROM users WHERE email = ?').get(normalizedEmail);
		const passwordOk = await verifyPassword(user?.password_hash, password);

		// Same response for "no such email", "wrong password", "deactivated" and
		// "rejected", so the login form can't be used to find out which accounts
		// exist. (Pending accounts may log in; they only see a waiting page.)
		if (!user || !passwordOk || !user.active || user.status === 'rejected') {
			loginLimiter.recordFailure(normalizedEmail);
			logAudit(db, { actorId: user?.id ?? null, action: 'login_failed', target: user ? `user:${user.id}` : null });
			return res.status(401).json({ error: 'invalid_credentials' });
		}

		loginLimiter.recordSuccess(normalizedEmail);
		deleteSession(db, req.sessionToken); // never reuse a session from before login
		const token = createSession(db, config, user.id, { ip: req.ip, userAgent: req.get('user-agent') });
		db.prepare('UPDATE users SET last_login_at = ? WHERE id = ?').run(toDbTime(new Date()), user.id);
		logAudit(db, { actorId: user.id, action: 'login', target: `user:${user.id}` });

		setSessionCookie(res, config, token);
		res.json({ user: publicUser(user) });
	});

	router.post('/logout', (req, res) => {
		if (req.user) logAudit(db, { actorId: req.user.id, action: 'logout', target: `user:${req.user.id}` });
		deleteSession(db, req.sessionToken);
		clearSessionCookie(res, config);
		res.status(204).end();
	});

	router.get('/me', requireLogin, (req, res) => {
		res.json({ user: publicUser(req.user) });
	});

	// Your own name and contact number. Allowed while waiting for approval
	// (an admin may also correct them). Email and roll number can't be changed here.
	router.put('/profile', requireLogin, requirePasswordChanged, (req, res) => {
		const name = checkName(req.body?.name);
		if (name.error) return res.status(400).json({ error: name.error });
		const phone = checkPhone(req.body?.phone);
		if (phone.error) return res.status(400).json({ error: phone.error });

		db.prepare('UPDATE users SET name = ?, phone = ? WHERE id = ?').run(name.value, phone.value, req.user.id);
		logAudit(db, { actorId: req.user.id, action: 'profile_changed', target: `user:${req.user.id}` });
		res.json({ user: publicUser({ ...req.user, name: name.value, phone: phone.value }) });
	});

	// Works while a password change is pending — that's how the first-login
	// change gets done. Ends every other session of the user and starts a new one.
	router.post('/change-password', requireLogin, async (req, res) => {
		const { currentPassword, newPassword } = req.body ?? {};
		if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || currentPassword.length > PASSWORD_MAX_LENGTH) {
			return res.status(400).json({ error: 'invalid_input' });
		}

		const email = req.user.email;
		const waitSeconds = loginLimiter.check(req.ip, email);
		if (waitSeconds > 0) {
			res.set('Retry-After', String(waitSeconds));
			return res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: waitSeconds });
		}

		const { password_hash: currentHash } = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
		if (!(await verifyPassword(currentHash, currentPassword))) {
			loginLimiter.recordFailure(email);
			return res.status(400).json({ error: 'wrong_current_password' });
		}
		loginLimiter.recordSuccess(email);

		const problem = checkNewPassword(newPassword);
		if (problem) return res.status(400).json({ error: problem });
		if (newPassword === currentPassword) return res.status(400).json({ error: 'password_unchanged' });

		db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(
			await hashPassword(newPassword),
			req.user.id,
		);
		deleteAllSessionsForUser(db, req.user.id);
		const token = createSession(db, config, req.user.id, { ip: req.ip, userAgent: req.get('user-agent') });
		logAudit(db, { actorId: req.user.id, action: 'password_changed', target: `user:${req.user.id}` });

		setSessionCookie(res, config, token);
		res.json({ user: publicUser({ ...req.user, mustChangePassword: false }) });
	});

	return router;
}
