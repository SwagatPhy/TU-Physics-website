// Self-registration from the roster, and "forgot password":
//   POST /register/request         {email, rollNumber?}
//   POST /register/complete        {token, password}
//   POST /password-reset/request   {email}
//   POST /password-reset/complete  {token, password}
//
// The two "request" endpoints always give the same answer (202
// "check_your_email") straight away, before looking anything up. The roster or
// account lookup and the email happen afterwards, in the background, so neither
// the response nor its timing reveals whether an email address is known.

import { Router } from 'express';
import { logAudit } from '../audit.js';
import { toDbTime } from '../db.js';
import { hashPassword, checkNewPassword, deleteAllSessionsForUser } from '../auth.js';
import { normalizeRollNumber } from '../programmes.js';
import { createLinkToken, useLinkToken, cancelUnusedTokens } from '../tokens.js';
import { registrationEmail, passwordResetEmail } from '../mail-templates.js';

const CHECK_YOUR_EMAIL = { status: 'check_your_email' };

export function registerRoutes({ db, config, mailer, loginLimiter, linkRequestLimiter, runInBackground }) {
	const router = Router();
	const linkTo = (page, token) => `${config.siteUrl}${config.basePath}/${page}/#token=${token}`;

	// Shared by both "request" endpoints: input check and rate limit.
	// Returns the normalized email, or null after sending an error response.
	function acceptLinkRequest(req, res) {
		const { email } = req.body ?? {};
		if (typeof email !== 'string' || email.length > 254) {
			res.status(400).json({ error: 'invalid_input' });
			return null;
		}
		const normalizedEmail = email.trim().toLowerCase();
		const waitSeconds = linkRequestLimiter.check(req.ip, normalizedEmail);
		if (waitSeconds > 0) {
			res.set('Retry-After', String(waitSeconds));
			res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: waitSeconds });
			return null;
		}
		linkRequestLimiter.recordFailure(normalizedEmail); // every request counts: max 3 emails per address per window
		return normalizedEmail;
	}

	// The "complete" endpoints hash a password (deliberately slow), so they share
	// the per-IP login allowance. Returns true after sending a 429.
	function ipLimited(req, res) {
		const waitSeconds = loginLimiter.check(req.ip, '');
		if (waitSeconds === 0) return false;
		res.set('Retry-After', String(waitSeconds));
		res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: waitSeconds });
		return true;
	}

	router.post('/register/request', (req, res) => {
		const { rollNumber } = req.body ?? {};
		if (rollNumber !== undefined && (typeof rollNumber !== 'string' || rollNumber.length > 30)) {
			return res.status(400).json({ error: 'invalid_input' });
		}
		const email = acceptLinkRequest(req, res);
		if (!email) return;
		res.status(202).json(CHECK_YOUR_EMAIL);

		runInBackground(async () => {
			const person = db.prepare('SELECT * FROM roster WHERE email = ?').get(email);
			if (!person || person.claimed) return;
			// Students must also give the roll number on the roster; faculty and staff register by email only.
			if (person.role === 'student' && normalizeRollNumber(rollNumber) !== person.roll_number) return;
			if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return;

			cancelUnusedTokens(db, { purpose: 'register', rosterId: person.id });
			const token = createLinkToken(db, { purpose: 'register', rosterId: person.id, minutes: config.linkMinutes });
			await mailer.send({
				to: email,
				...registrationEmail({ name: person.name, link: linkTo('register', token), minutes: config.linkMinutes }),
			});
		});
	});

	router.post('/register/complete', async (req, res) => {
		if (ipLimited(req, res)) return;
		const { token, password } = req.body ?? {};
		if (typeof token !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'invalid_input' });
		const problem = checkNewPassword(password);
		if (problem) return res.status(400).json({ error: problem }); // checked first, so a weak password doesn't use up the link

		const passwordHash = await hashPassword(password);
		const link = useLinkToken(db, token, 'register');
		const person = link && db.prepare('SELECT * FROM roster WHERE id = ?').get(link.roster_id);
		if (!person || person.claimed || db.prepare('SELECT 1 FROM users WHERE email = ?').get(person.email)) {
			return res.status(400).json({ error: 'invalid_or_expired_link' });
		}

		const now = toDbTime(new Date());
		db.exec('BEGIN');
		try {
			const claimed = db.prepare('UPDATE roster SET claimed = 1, claimed_at = ? WHERE id = ? AND claimed = 0').run(now, person.id);
			if (claimed.changes !== 1) throw new Error('roster row already claimed');
			const userId = db
				.prepare(
					`INSERT INTO users (name, email, password_hash, role, active, must_change_password, created_at, roll_number, programme)
					 VALUES (?, ?, ?, ?, 1, 0, ?, ?, ?)`,
				)
				.run(person.name, person.email, passwordHash, person.role, now, person.roll_number, person.programme).lastInsertRowid;
			db.prepare('UPDATE roster SET user_id = ? WHERE id = ?').run(userId, person.id);
			logAudit(db, { actorId: Number(userId), action: 'registered', target: `roster:${person.id}` });
			db.exec('COMMIT');
		} catch {
			db.exec('ROLLBACK');
			return res.status(400).json({ error: 'invalid_or_expired_link' });
		}
		res.status(201).json({ status: 'registered' });
	});

	router.post('/password-reset/request', (req, res) => {
		const email = acceptLinkRequest(req, res);
		if (!email) return;
		res.status(202).json(CHECK_YOUR_EMAIL);

		runInBackground(async () => {
			const user = db.prepare('SELECT id, name, active FROM users WHERE email = ?').get(email);
			if (!user || !user.active) return;
			cancelUnusedTokens(db, { purpose: 'reset', userId: user.id });
			const token = createLinkToken(db, { purpose: 'reset', userId: user.id, minutes: config.linkMinutes });
			await mailer.send({
				to: email,
				...passwordResetEmail({ name: user.name, link: linkTo('forgot-password', token), minutes: config.linkMinutes }),
			});
		});
	});

	router.post('/password-reset/complete', async (req, res) => {
		if (ipLimited(req, res)) return;
		const { token, password } = req.body ?? {};
		if (typeof token !== 'string' || typeof password !== 'string') return res.status(400).json({ error: 'invalid_input' });
		const problem = checkNewPassword(password);
		if (problem) return res.status(400).json({ error: problem });

		const passwordHash = await hashPassword(password);
		const link = useLinkToken(db, token, 'reset');
		const user = link && db.prepare('SELECT id, email, active FROM users WHERE id = ?').get(link.user_id);
		if (!user || !user.active) return res.status(400).json({ error: 'invalid_or_expired_link' });

		db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, user.id);
		deleteAllSessionsForUser(db, user.id); // signs out every device
		loginLimiter.recordSuccess(user.email); // lift any login lockout
		logAudit(db, { actorId: user.id, action: 'password_reset', target: `user:${user.id}` });
		res.json({ status: 'password_reset' });
	});

	return router;
}
