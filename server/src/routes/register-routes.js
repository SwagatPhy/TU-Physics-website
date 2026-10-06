// Sign-up and "forgot password":
//   POST /register/request         {kind, name, email, rollNumber?, phone}
//   POST /register/complete        {token, password}
//   POST /password-reset/request   {email}
//   POST /password-reset/complete  {token, password}
//
// Sign-up: anyone can fill in the form. They get an email link (single-use,
// 30 minutes); opening it and choosing a password creates the account.
// - Students give a roll number; its prefix sets the programme (programmes.conf).
//   If email + roll number match an unclaimed roster row the account is created
//   approved and the row is claimed; otherwise it waits for an admin (pending).
// - Department members (faculty, scholars, staff) sign up without a roll number
//   and always wait for an admin. Nobody can sign up as admin.
//
// The two "request" endpoints check only the format of what was typed, then
// always answer 202 "check_your_email" before looking anything up. Lookups and
// emails happen afterwards, in the background, so neither the answer nor its
// timing reveals whether an email address or roll number is already known.

import { Router } from 'express';
import { logAudit } from '../audit.js';
import { toDbTime } from '../db.js';
import { hashPassword, checkNewPassword, deleteAllSessionsForUser } from '../auth.js';
import { checkSignup, checkEmail } from '../validate.js';
import { readRollNumber } from '../programmes.js';
import { enrolStudentAutomatically } from '../enrolment.js';
import { createLinkToken, useLinkToken, cancelUnusedResetLinks, cancelUnusedRegistrationLinks } from '../tokens.js';
import {
	registrationEmail,
	alreadyRegisteredEmail,
	rollNumberTakenEmail,
	passwordResetEmail,
} from '../mail-templates.js';

const CHECK_YOUR_EMAIL = { status: 'check_your_email' };

export function registerRoutes({ db, config, programmes, mailer, loginLimiter, linkRequestLimiter, runInBackground }) {
	const router = Router();
	const pageLink = (page) => `${config.siteUrl}${config.basePath}/${page}/`;
	const linkTo = (page, token) => `${pageLink(page)}#token=${token}`;

	// At most 3 emails per address per 15 minutes. Returns true after sending a 429.
	function linkRequestLimited(req, res, email) {
		const waitSeconds = linkRequestLimiter.check(req.ip, email);
		if (waitSeconds > 0) {
			res.set('Retry-After', String(waitSeconds));
			res.status(429).json({ error: 'too_many_attempts', retryAfterSeconds: waitSeconds });
			return true;
		}
		linkRequestLimiter.recordFailure(email); // every request counts towards the limit
		return false;
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
		const { error, value: signup } = checkSignup(req.body, programmes);
		if (error) return res.status(400).json({ error });
		if (linkRequestLimited(req, res, signup.email)) return;
		res.status(202).json(CHECK_YOUR_EMAIL);

		runInBackground(async () => {
			// Email already has an account: tell that inbox (not the form) how to log in.
			const existing = db.prepare('SELECT name FROM users WHERE email = ?').get(signup.email);
			if (existing) {
				return mailer.send({
					to: signup.email,
					...alreadyRegisteredEmail({ name: existing.name, loginLink: pageLink('login'), resetLink: pageLink('forgot-password') }),
				});
			}
			// Roll number already belongs to someone else's account.
			if (signup.rollNumber && db.prepare('SELECT 1 FROM users WHERE roll_number = ?').get(signup.rollNumber)) {
				return mailer.send({ to: signup.email, ...rollNumberTakenEmail({ name: signup.name }) });
			}

			// Optional roster: a student whose email and roll number match an
			// unclaimed row will be approved straight away.
			const rosterRow =
				signup.kind === 'student'
					? db
							.prepare("SELECT id FROM roster WHERE email = ? AND roll_number = ? AND role = 'student' AND claimed = 0")
							.get(signup.email, signup.rollNumber)
					: null;

			const signupId = db
				.prepare(
					`INSERT INTO signups (kind, name, email, roll_number, programme, phone, roster_id, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					signup.kind,
					signup.name,
					signup.email,
					signup.rollNumber,
					signup.programme,
					signup.phone,
					rosterRow?.id ?? null,
					toDbTime(new Date()),
				).lastInsertRowid;

			cancelUnusedRegistrationLinks(db, signup.email); // only the newest link works
			const token = createLinkToken(db, { purpose: 'register', signupId: Number(signupId), minutes: config.linkMinutes });
			await mailer.send({
				to: signup.email,
				...registrationEmail({ name: signup.name, link: linkTo('register', token), minutes: config.linkMinutes }),
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
		const signup = link?.signup_id && db.prepare('SELECT * FROM signups WHERE id = ?').get(link.signup_id);
		if (!signup) return res.status(400).json({ error: 'invalid_or_expired_link' });

		const now = toDbTime(new Date());
		let status;
		db.exec('BEGIN');
		try {
			// Claiming the roster row first means two sign-ups can't both use it.
			const claimed =
				signup.roster_id !== null &&
				db.prepare('UPDATE roster SET claimed = 1, claimed_at = ? WHERE id = ? AND claimed = 0').run(now, signup.roster_id)
					.changes === 1;
			status = claimed ? 'approved' : 'pending';

			// Fails on the UNIQUE email / roll number indexes if someone else got there first.
			const userId = Number(
				db
					.prepare(
						`INSERT INTO users (name, email, password_hash, role, status, active, must_change_password,
						                    created_at, roll_number, programme, phone, batch_year)
						 VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?)`,
					)
					.run(
						signup.name,
						signup.email,
						passwordHash,
						signup.kind === 'student' ? 'student' : 'faculty',
						status,
						now,
						signup.roll_number,
						signup.programme,
						signup.phone,
						// Batch = programme + joining year, read from the roll number (PHP22017 -> 2022).
						readRollNumber(programmes, signup.roll_number)?.batchYear ?? null,
					).lastInsertRowid,
			);
			if (claimed) {
				db.prepare('UPDATE roster SET user_id = ? WHERE id = ?').run(userId, signup.roster_id);
				enrolStudentAutomatically(db, config, userId); // approved at once: into their batch's offerings
			}
			logAudit(db, { actorId: userId, action: claimed ? 'registered_from_roster' : 'registered_pending', target: `user:${userId}` });
			db.exec('COMMIT');
		} catch {
			db.exec('ROLLBACK');
			return res.status(400).json({ error: 'invalid_or_expired_link' });
		}
		// The person now owns this account, so telling them whether it still needs approval reveals nothing.
		res.status(201).json({ status: 'registered', approval: status });
	});

	router.post('/password-reset/request', (req, res) => {
		const { error, value: email } = checkEmail(req.body?.email);
		if (error) return res.status(400).json({ error: 'invalid_input' });
		if (linkRequestLimited(req, res, email)) return;
		res.status(202).json(CHECK_YOUR_EMAIL);

		runInBackground(async () => {
			const user = db.prepare('SELECT id, name, active, status FROM users WHERE email = ?').get(email);
			if (!user || !user.active || user.status === 'rejected') return;
			cancelUnusedResetLinks(db, user.id);
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
		const user = link && db.prepare('SELECT id, email, active, status FROM users WHERE id = ?').get(link.user_id);
		if (!user || !user.active || user.status === 'rejected') return res.status(400).json({ error: 'invalid_or_expired_link' });

		db.prepare('UPDATE users SET password_hash = ?, must_change_password = 0 WHERE id = ?').run(passwordHash, user.id);
		deleteAllSessionsForUser(db, user.id); // signs out every device
		loginLimiter.recordSuccess(user.email); // lift any login lockout
		logAudit(db, { actorId: user.id, action: 'password_reset', target: `user:${user.id}` });
		res.json({ status: 'password_reset' });
	});

	return router;
}
