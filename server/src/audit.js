import { toDbTime } from './db.js';

// Records who did what (logins, password changes, and later admin/faculty edits).
// `target` is a short reference like "user:12" or "course:3" — never a password.
export function logAudit(db, { actorId = null, action, target = null }) {
	db.prepare('INSERT INTO audit_log (actor_id, action, target, at) VALUES (?, ?, ?, ?)').run(
		actorId,
		action,
		target,
		toDbTime(new Date()),
	);
}
