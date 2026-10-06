// Automatic enrolment of students in course offerings (REPORT.md section 19).
//
// A student is enrolled automatically in every offering that is
//   - active (not finished),
//   - not an elective,
//   - for their batch: the same programme and joining year (batch_year),
// when they are approved, and when such an offering is created or reopened.
// Electives start empty; an admin adds students by hand. PhD students (roll
// numbers starting PHP) are only enrolled by hand, unless AUTO_ENROL_PHD=true.
//
// Safe to run any number of times: a student already in the offering is never
// added twice, and one an admin removed (enrollments.removed = 1) is never
// added back automatically.

import { toDbTime } from './db.js';
import { logAudit } from './audit.js';

// SQL condition: which students may be enrolled automatically.
function eligibleStudents(config) {
	return `u.role = 'student' AND u.status = 'approved' AND u.active = 1
	        AND u.programme IS NOT NULL AND u.batch_year IS NOT NULL
	        ${config.autoEnrolPhd ? '' : "AND u.roll_number NOT LIKE 'PHP%'"}`;
}

// SQL condition: which offerings take students automatically.
const OPEN_FOR_AUTO = `o.status = 'active' AND o.is_elective = 0 AND o.programme IS NOT NULL AND o.batch_year IS NOT NULL`;

// Enrols one student in every matching offering. Returns how many were added.
export function enrolStudentAutomatically(db, config, userId) {
	const added = db
		.prepare(
			`INSERT INTO enrollments (offering_id, user_id, added_by, removed, created_at)
			 SELECT o.id, u.id, 'auto', 0, ?
			 FROM offerings o JOIN users u ON u.programme = o.programme AND u.batch_year = o.batch_year
			 WHERE u.id = ? AND ${OPEN_FOR_AUTO} AND ${eligibleStudents(config)}
			   AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.offering_id = o.id AND e.user_id = u.id)`,
		)
		.run(toDbTime(new Date()), userId).changes;
	if (added > 0) logAudit(db, { action: 'enrolled_automatically', target: `user:${userId} into ${added} offering(s)` });
	return added;
}

// Enrols every matching student of the offering's batch. Returns how many were added.
export function enrolBatchAutomatically(db, config, offeringId) {
	const added = db
		.prepare(
			`INSERT INTO enrollments (offering_id, user_id, added_by, removed, created_at)
			 SELECT o.id, u.id, 'auto', 0, ?
			 FROM offerings o JOIN users u ON u.programme = o.programme AND u.batch_year = o.batch_year
			 WHERE o.id = ? AND ${OPEN_FOR_AUTO} AND ${eligibleStudents(config)}
			   AND NOT EXISTS (SELECT 1 FROM enrollments e WHERE e.offering_id = o.id AND e.user_id = u.id)`,
		)
		.run(toDbTime(new Date()), offeringId).changes;
	if (added > 0) logAudit(db, { action: 'enrolled_automatically', target: `offering:${offeringId} (${added} student(s))` });
	return added;
}
