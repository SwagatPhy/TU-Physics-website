// GET /api/my-courses — a student's offerings with their class links and notes.
//   { current: [...], past: [...] }  current = active offerings, past = finished ones
//
// Only offerings the student is enrolled in (and not removed from), only items
// whose visible_from date has passed, and only http(s) links (a stored
// "javascript:" link would be dangerous on the page, so it is never sent).
// A finished offering whose teacher hid its content is listed without items.
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

		const offerings = db
			.prepare(
				`SELECT o.id, o.programme, o.batch_year, o.semester, o.status, o.content_hidden, c.code, c.title
				 FROM enrollments e JOIN offerings o ON o.id = e.offering_id JOIN courses c ON c.id = o.course_id
				 WHERE e.user_id = ? AND e.removed = 0
				 ORDER BY c.code, o.semester`,
			)
			.all(req.user.id);

		const itemsFor = db.prepare(
			`SELECT id, kind, title, url, file_name, file_size FROM resources
			 WHERE offering_id = ? AND (visible_from IS NULL OR visible_from <= ?)
			 ORDER BY kind, title`,
		);
		const now = toDbTime(new Date());

		const describe = (offering) => {
			const hidden = offering.status === 'finished' && Boolean(offering.content_hidden);
			return {
				code: offering.code,
				title: offering.title,
				programme: offering.programme,
				batchYear: offering.batch_year,
				semester: offering.semester,
				contentHidden: hidden,
				resources: hidden
					? []
					: itemsFor
							.all(offering.id, now)
							.map((item) => ({
								id: item.id,
								kind: item.kind,
								title: item.title,
								url: isWebLink(item.url) ? item.url : null,
								file: item.file_name ? { name: item.file_name, size: item.file_size } : null,
							}))
							.filter((item) => item.url || item.file),
			};
		};

		res.json({
			current: offerings.filter((o) => o.status === 'active').map(describe),
			past: offerings.filter((o) => o.status === 'finished').map(describe),
		});
	});

	return router;
}
