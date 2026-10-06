// GET /api/my-courses — a student's courses with their class links and notes.
//
// Only courses the student is enrolled in, only active courses, only items
// whose visible_from date has passed, and only http(s) links (a stored
// "javascript:" link would be dangerous on the page, so it is never sent).
// Note files are only described here; they are downloaded through
// GET /api/files/:id (files-routes.js), which checks the same rules again.

import { Router } from 'express';
import { toDbTime } from '../db.js';
import { requireLogin, requirePasswordChanged, requireApproved } from '../auth.js';
import { isWebLink } from '../validate.js';

export function studentRoutes({ db }) {
	const router = Router();

	router.get('/my-courses', requireLogin, requirePasswordChanged, requireApproved, (req, res) => {
		if (req.user.role !== 'student') return res.status(403).json({ error: 'students_only' });

		const courses = db
			.prepare(
				`SELECT c.id, c.code, c.title, c.semester
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 WHERE e.user_id = ? AND c.active = 1
				 ORDER BY c.code`,
			)
			.all(req.user.id);

		const itemsFor = db.prepare(
			`SELECT id, kind, title, url, file_name, file_size FROM resources
			 WHERE course_id = ? AND (visible_from IS NULL OR visible_from <= ?)
			 ORDER BY kind, title`,
		);
		const now = toDbTime(new Date());

		res.json({
			courses: courses.map((course) => ({
				code: course.code,
				title: course.title,
				semester: course.semester,
				resources: itemsFor
					.all(course.id, now)
					.map((item) => ({
						id: item.id,
						kind: item.kind,
						title: item.title,
						url: isWebLink(item.url) ? item.url : null,
						file: item.file_name ? { name: item.file_name, size: item.file_size } : null,
					}))
					.filter((item) => item.url || item.file),
			})),
		});
	});

	return router;
}
