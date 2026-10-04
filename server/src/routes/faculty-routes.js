// Faculty dashboard API: their courses and the class/notes links in them.
//   GET    /teaching          courses I teach (admin: all), with links and student counts
//   POST   /resources         {courseId, kind, title, url, visibleFrom?}
//   PUT    /resources/:id     {kind, title, url, visibleFrom?}
//   DELETE /resources/:id
//
// The rule that matters: a faculty member can only change links in courses
// where courses.faculty_id is their own id. Admins can change any course.
// A course someone may not manage gets the same 404 as one that doesn't exist.

import { Router } from 'express';
import { toDbTime } from '../db.js';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireRole } from '../auth.js';
import { checkResource } from '../validate.js';

export function facultyRoutes({ db }) {
	const router = Router();
	const guard = [requireLogin, requirePasswordChanged, requireRole('faculty', 'admin')];

	// The course if this user may manage it, otherwise null.
	function manageableCourse(user, courseId) {
		const course = db.prepare('SELECT * FROM courses WHERE id = ? AND active = 1').get(Number(courseId));
		if (!course) return null;
		return user.role === 'admin' || course.faculty_id === user.id ? course : null;
	}

	// The link and its course if this user may manage it, otherwise null.
	function manageableResource(user, resourceId) {
		const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(resourceId));
		if (!resource) return null;
		return manageableCourse(user, resource.course_id) ? resource : null;
	}

	router.get('/teaching', ...guard, (req, res) => {
		const courses =
			req.user.role === 'admin'
				? db.prepare('SELECT * FROM courses WHERE active = 1 ORDER BY code').all()
				: db.prepare('SELECT * FROM courses WHERE active = 1 AND faculty_id = ? ORDER BY code').all(req.user.id);

		const countStudents = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?');
		const linksFor = db.prepare(
			'SELECT id, kind, title, url, visible_from, updated_at FROM resources WHERE course_id = ? ORDER BY kind, title',
		);

		res.json({
			courses: courses.map((course) => ({
				id: course.id,
				code: course.code,
				title: course.title,
				semester: course.semester,
				studentCount: countStudents.get(course.id).n,
				resources: linksFor.all(course.id).map((link) => ({
					id: link.id,
					kind: link.kind,
					title: link.title,
					url: link.url,
					visibleFrom: link.visible_from,
					updatedAt: link.updated_at,
				})),
			})),
		});
	});

	router.post('/resources', ...guard, (req, res) => {
		const course = manageableCourse(req.user, req.body?.courseId);
		if (!course) return res.status(404).json({ error: 'course_not_found' });
		const { error, value } = checkResource(req.body);
		if (error) return res.status(400).json({ error });

		const id = db
			.prepare(
				`INSERT INTO resources (course_id, kind, title, url, visible_from, created_by, updated_at)
				 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(course.id, value.kind, value.title, value.url, value.visibleFrom, req.user.id, toDbTime(new Date())).lastInsertRowid;
		logAudit(db, { actorId: req.user.id, action: 'resource_added', target: `resource:${id}` });
		res.status(201).json({ id: Number(id) });
	});

	router.put('/resources/:id', ...guard, (req, res) => {
		const resource = manageableResource(req.user, req.params.id);
		if (!resource) return res.status(404).json({ error: 'resource_not_found' });
		const { error, value } = checkResource(req.body);
		if (error) return res.status(400).json({ error });

		db.prepare('UPDATE resources SET kind = ?, title = ?, url = ?, visible_from = ?, updated_at = ? WHERE id = ?').run(
			value.kind,
			value.title,
			value.url,
			value.visibleFrom,
			toDbTime(new Date()),
			resource.id,
		);
		logAudit(db, { actorId: req.user.id, action: 'resource_changed', target: `resource:${resource.id}` });
		res.json({ id: resource.id });
	});

	router.delete('/resources/:id', ...guard, (req, res) => {
		const resource = manageableResource(req.user, req.params.id);
		if (!resource) return res.status(404).json({ error: 'resource_not_found' });
		db.prepare('DELETE FROM resources WHERE id = ?').run(resource.id);
		logAudit(db, { actorId: req.user.id, action: 'resource_deleted', target: `resource:${resource.id} course:${resource.course_id}` });
		res.status(204).end();
	});

	return router;
}
