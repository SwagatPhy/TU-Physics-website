// GET /api/my-courses — a student's courses and their class/notes links.
//
// Only courses the student is enrolled in, only active courses, only links
// whose visible_from date has passed, and only http(s) links (a stored
// "javascript:" link would be dangerous on the page, so it is never sent).

import { Router } from 'express';
import { toDbTime } from '../db.js';
import { requireLogin, requirePasswordChanged } from '../auth.js';
import { isWebLink } from '../validate.js';

export function studentRoutes({ db }) {
	const router = Router();

	router.get('/my-courses', requireLogin, requirePasswordChanged, (req, res) => {
		if (req.user.role !== 'student') return res.status(403).json({ error: 'students_only' });

		const courses = db
			.prepare(
				`SELECT c.id, c.code, c.title, c.semester
				 FROM enrollments e JOIN courses c ON c.id = e.course_id
				 WHERE e.user_id = ? AND c.active = 1
				 ORDER BY c.code`,
			)
			.all(req.user.id);

		const linksFor = db.prepare(
			`SELECT id, kind, title, url FROM resources
			 WHERE course_id = ? AND (visible_from IS NULL OR visible_from <= ?)
			 ORDER BY kind, title`,
		);
		const now = toDbTime(new Date());

		res.json({
			courses: courses.map((course) => ({
				code: course.code,
				title: course.title,
				semester: course.semester,
				resources: linksFor
					.all(course.id, now)
					.filter((link) => isWebLink(link.url))
					.map(({ id, kind, title, url }) => ({ id, kind, title, url })),
			})),
		});
	});

	return router;
}
