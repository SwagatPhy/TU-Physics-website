// Admin: course offerings — a course taught to one batch in one semester by
// one teacher (REPORT.md section 19).
//   GET    /admin/offerings                    all offerings, plus courses, teachers and programmes for the form
//   POST   /admin/offerings                    {courseId, programme, batchYear, semester, teacherId, isElective}
//   PUT    /admin/offerings/:id                same fields, plus status: "active" | "finished"
//   GET    /admin/offerings/:id                one offering and its students
//   POST   /admin/offerings/:id/students       {student: roll number or email}  add by hand
//   DELETE /admin/offerings/:id/students/:userId                               remove by hand
//
// Admin only; every change is audit-logged. Creating, editing or reopening a
// non-elective offering enrols its batch automatically (enrolment.js).

import { Router } from 'express';
import { toDbTime } from '../db.js';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireApproved, requireRole } from '../auth.js';
import { normalizeRollNumber } from '../programmes.js';
import { enrolBatchAutomatically } from '../enrolment.js';

const OFFERING_SQL = `
	SELECT o.*, c.code, c.title, t.name AS teacher_name,
	       (SELECT COUNT(*) FROM enrollments e WHERE e.offering_id = o.id AND e.removed = 0) AS student_count
	FROM offerings o JOIN courses c ON c.id = o.course_id LEFT JOIN users t ON t.id = o.teacher_id`;

export function describeOffering(row) {
	return {
		id: row.id,
		courseId: row.course_id,
		code: row.code,
		title: row.title,
		programme: row.programme,
		batchYear: row.batch_year,
		semester: row.semester,
		teacherId: row.teacher_id,
		teacherName: row.teacher_name ?? null,
		status: row.status,
		isElective: Boolean(row.is_elective),
		contentHidden: Boolean(row.content_hidden),
		studentCount: row.student_count ?? 0,
	};
}

export function offeringsRoutes({ db, config, programmes }) {
	const router = Router();
	const guard = [requireLogin, requirePasswordChanged, requireApproved, requireRole('admin')];
	const programmeNames = [...new Set(programmes.values())];

	const findOffering = (id) => db.prepare(`${OFFERING_SQL} WHERE o.id = ?`).get(Number(id));

	// Checks the offering form. Returns { error } or { value }.
	function checkOffering(body) {
		const { courseId, programme, batchYear, semester, teacherId, isElective, status } = body ?? {};
		if (!db.prepare('SELECT 1 FROM courses WHERE id = ?').get(Number(courseId))) return { error: 'course_not_found' };
		if (!programmeNames.includes(programme)) return { error: 'invalid_programme' };
		if (!Number.isInteger(batchYear) || batchYear < 2000 || batchYear > 2099) return { error: 'invalid_batch_year' };
		if (typeof semester !== 'string' || !semester.trim() || semester.trim().length > 40) return { error: 'invalid_semester' };
		const teacher = db
			.prepare("SELECT id FROM users WHERE id = ? AND role IN ('faculty', 'admin') AND status = 'approved' AND active = 1")
			.get(Number(teacherId));
		if (!teacher) return { error: 'teacher_not_found' };
		if (typeof isElective !== 'boolean') return { error: 'invalid_input' };
		if (status !== undefined && !['active', 'finished'].includes(status)) return { error: 'invalid_input' };
		return {
			value: { courseId: Number(courseId), programme, batchYear, semester: semester.trim(), teacherId: teacher.id, isElective, status },
		};
	}

	const duplicateOf = (value, exceptId = 0) =>
		db
			.prepare('SELECT id FROM offerings WHERE course_id = ? AND programme = ? AND batch_year = ? AND semester = ? AND id <> ?')
			.get(value.courseId, value.programme, value.batchYear, value.semester, exceptId);

	router.get('/admin/offerings', ...guard, (req, res) => {
		res.json({
			offerings: db.prepare(`${OFFERING_SQL} ORDER BY o.status, c.code, o.batch_year, o.semester`).all().map(describeOffering),
			courses: db.prepare('SELECT id, code, title FROM courses ORDER BY code').all().map((c) => ({ ...c })),
			teachers: db
				.prepare("SELECT id, name FROM users WHERE role IN ('faculty', 'admin') AND status = 'approved' AND active = 1 ORDER BY name")
				.all()
				.map((t) => ({ ...t })),
			programmes: programmeNames,
		});
	});

	router.post('/admin/offerings', ...guard, (req, res) => {
		const { error, value } = checkOffering(req.body);
		if (error) return res.status(400).json({ error });
		if (duplicateOf(value)) return res.status(400).json({ error: 'offering_exists' });

		const id = Number(
			db
				.prepare(
					`INSERT INTO offerings (course_id, programme, batch_year, semester, teacher_id, status, is_elective, content_hidden, created_at)
					 VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
				)
				.run(value.courseId, value.programme, value.batchYear, value.semester, value.teacherId, value.status ?? 'active', value.isElective ? 1 : 0, toDbTime(new Date()))
				.lastInsertRowid,
		);
		logAudit(db, { actorId: req.user.id, action: 'offering_created', target: `offering:${id}` });
		const enrolled = enrolBatchAutomatically(db, config, id);
		res.status(201).json({ id, enrolled });
	});

	router.put('/admin/offerings/:id', ...guard, (req, res) => {
		const offering = findOffering(req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const { error, value } = checkOffering(req.body);
		if (error) return res.status(400).json({ error });
		if (duplicateOf(value, offering.id)) return res.status(400).json({ error: 'offering_exists' });

		const status = value.status ?? offering.status;
		db.prepare(
			`UPDATE offerings SET course_id = ?, programme = ?, batch_year = ?, semester = ?, teacher_id = ?, status = ?, is_elective = ?
			 WHERE id = ?`,
		).run(value.courseId, value.programme, value.batchYear, value.semester, value.teacherId, status, value.isElective ? 1 : 0, offering.id);
		const action = status !== offering.status ? (status === 'finished' ? 'offering_finished' : 'offering_reopened') : 'offering_changed';
		logAudit(db, { actorId: req.user.id, action, target: `offering:${offering.id}` });
		// Now active and non-elective (perhaps just reopened, or for another batch): enrol that batch.
		const enrolled = enrolBatchAutomatically(db, config, offering.id);
		res.json({ id: offering.id, enrolled });
	});

	router.get('/admin/offerings/:id', ...guard, (req, res) => {
		const offering = findOffering(req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const students = db
			.prepare(
				`SELECT u.id, u.name, u.email, u.roll_number, e.added_by
				 FROM enrollments e JOIN users u ON u.id = e.user_id
				 WHERE e.offering_id = ? AND e.removed = 0 ORDER BY u.roll_number, u.name`,
			)
			.all(offering.id)
			.map((s) => ({ id: s.id, name: s.name, email: s.email, rollNumber: s.roll_number, addedBy: s.added_by }));
		res.json({ offering: describeOffering(offering), students });
	});

	router.post('/admin/offerings/:id/students', ...guard, (req, res) => {
		const offering = findOffering(req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const given = typeof req.body?.student === 'string' ? req.body.student.trim() : '';
		if (!given || given.length > 254) return res.status(400).json({ error: 'student_not_found' });
		const person = db.prepare('SELECT id, role, status FROM users WHERE email = ? OR roll_number = ?').get(given.toLowerCase(), normalizeRollNumber(given));
		if (!person) return res.status(404).json({ error: 'student_not_found' });
		if (person.role !== 'student') return res.status(400).json({ error: 'not_a_student' });

		const existing = db.prepare('SELECT removed FROM enrollments WHERE offering_id = ? AND user_id = ?').get(offering.id, person.id);
		if (existing && !existing.removed) return res.status(400).json({ error: 'already_enrolled' });
		if (existing) {
			db.prepare("UPDATE enrollments SET removed = 0, added_by = 'admin' WHERE offering_id = ? AND user_id = ?").run(offering.id, person.id);
		} else {
			db.prepare("INSERT INTO enrollments (offering_id, user_id, added_by, removed, created_at) VALUES (?, ?, 'admin', 0, ?)").run(
				offering.id,
				person.id,
				toDbTime(new Date()),
			);
		}
		logAudit(db, { actorId: req.user.id, action: 'enrolled_by_admin', target: `user:${person.id} offering:${offering.id}` });
		res.status(201).json({ userId: person.id });
	});

	router.delete('/admin/offerings/:id/students/:userId', ...guard, (req, res) => {
		const offering = findOffering(req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		// Kept as "removed", so automatic enrolment never adds them back.
		const changed = db
			.prepare('UPDATE enrollments SET removed = 1 WHERE offering_id = ? AND user_id = ? AND removed = 0')
			.run(offering.id, Number(req.params.userId)).changes;
		if (!changed) return res.status(404).json({ error: 'student_not_found' });
		logAudit(db, { actorId: req.user.id, action: 'unenrolled_by_admin', target: `user:${Number(req.params.userId)} offering:${offering.id}` });
		res.status(204).end();
	});

	return router;
}
