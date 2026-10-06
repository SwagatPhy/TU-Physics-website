// Admin: approving sign-ups.
//   GET  /admin/signups      accounts waiting for approval
//   PUT  /admin/users/:id    {name, rollNumber?, phone?} fix details before deciding
//   POST /admin/decisions    {userIds: [...], decision: "approve" | "reject"}
//
// Admin only. Every change is written to the audit log, and each decision sends
// the person an email ("approved" / "not approved").
//
// Approving a student enrols them in their batch's current non-elective
// offerings (enrolment.js; offerings are managed in offerings-routes.js).

import { Router } from 'express';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireApproved, requireRole, deleteAllSessionsForUser } from '../auth.js';
import { checkName, checkPhone, checkRollNumber } from '../validate.js';
import { approvedEmail, notApprovedEmail } from '../mail-templates.js';
import { enrolStudentAutomatically } from '../enrolment.js';

function summary(user) {
	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role: user.role,
		status: user.status,
		rollNumber: user.roll_number,
		programme: user.programme,
		phone: user.phone,
		createdAt: user.created_at,
	};
}

export function adminRoutes({ db, config, programmes, mailer, runInBackground }) {
	const router = Router();
	const guard = [requireLogin, requirePasswordChanged, requireApproved, requireRole('admin')];
	const loginLink = `${config.siteUrl}${config.basePath}/login/`;

	router.get('/admin/signups', ...guard, (req, res) => {
		const pending = db.prepare("SELECT * FROM users WHERE status = 'pending' ORDER BY created_at, id").all();
		res.json({ signups: pending.map(summary) });
	});

	router.put('/admin/users/:id', ...guard, (req, res) => {
		const user = db.prepare("SELECT * FROM users WHERE id = ? AND role <> 'admin'").get(Number(req.params.id));
		if (!user) return res.status(404).json({ error: 'user_not_found' });

		const name = checkName(req.body?.name);
		if (name.error) return res.status(400).json({ error: name.error });

		let phone = user.phone;
		if (req.body?.phone !== undefined) {
			const checked = checkPhone(req.body.phone);
			if (checked.error) return res.status(400).json({ error: checked.error });
			phone = checked.value;
		}

		let { roll_number: rollNumber, programme, batch_year: batchYear } = user;
		if (user.role === 'student' && req.body?.rollNumber !== undefined) {
			const checked = checkRollNumber(req.body.rollNumber, programmes);
			if (checked.error) return res.status(400).json({ error: checked.error });
			({ rollNumber, programme, batchYear } = checked.value);
			if (db.prepare('SELECT 1 FROM users WHERE roll_number = ? AND id <> ?').get(rollNumber, user.id)) {
				return res.status(400).json({ error: 'roll_number_taken' });
			}
		}

		db.prepare('UPDATE users SET name = ?, phone = ?, roll_number = ?, programme = ?, batch_year = ? WHERE id = ?').run(
			name.value,
			phone,
			rollNumber,
			programme,
			batchYear,
			user.id,
		);
		logAudit(db, { actorId: req.user.id, action: 'user_edited', target: `user:${user.id}` });
		// A corrected roll number can mean another batch: enrol in its offerings too.
		if (user.status === 'approved') enrolStudentAutomatically(db, config, user.id);
		res.json({ user: summary(db.prepare('SELECT * FROM users WHERE id = ?').get(user.id)) });
	});

	router.post('/admin/decisions', ...guard, (req, res) => {
		const { userIds, decision } = req.body ?? {};
		if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ error: 'invalid_decision' });
		if (!Array.isArray(userIds) || userIds.length === 0 || userIds.length > 500 || !userIds.every(Number.isInteger)) {
			return res.status(400).json({ error: 'invalid_input' });
		}

		const status = decision === 'approve' ? 'approved' : 'rejected';
		const done = [];
		const skipped = [];
		const notify = [];

		db.exec('BEGIN');
		try {
			for (const id of userIds) {
				// Only pending accounts can be decided; anything else is reported back untouched.
				const user = db.prepare("SELECT id, name, email FROM users WHERE id = ? AND status = 'pending'").get(id);
				if (!user) {
					skipped.push(id);
					continue;
				}
				db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, user.id);
				if (status === 'rejected') deleteAllSessionsForUser(db, user.id);
				logAudit(db, { actorId: req.user.id, action: `user_${status}`, target: `user:${user.id}` });
				if (status === 'approved') enrolStudentAutomatically(db, config, user.id);
				done.push(user.id);
				notify.push(user);
			}
			db.exec('COMMIT');
		} catch (error) {
			db.exec('ROLLBACK');
			throw error;
		}

		runInBackground(async () => {
			for (const user of notify) {
				const message = status === 'approved' ? approvedEmail({ name: user.name, loginLink }) : notApprovedEmail({ name: user.name });
				await mailer.send({ to: user.email, ...message });
			}
		});
		res.json({ decision, done, skipped });
	});

	return router;
}
