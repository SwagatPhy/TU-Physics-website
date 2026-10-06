// Faculty dashboard API: their courses, the class links and the notes in them.
//   GET    /teaching          courses I teach (admin: all), with links, notes and student counts
//   POST   /resources         class link {courseId, title, url, visibleFrom?}
//   PUT    /resources/:id     {title, url, visibleFrom?}
//   DELETE /resources/:id
//   POST   /notes             {courseId, title, url?, visibleFrom?, file?: {name, data}}
//   PUT    /notes/:id         same without courseId; file: object = replace, null = remove, absent = keep
//   DELETE /notes/:id         also deletes the stored file
//
// A note needs a file, a link, or both. File data is base64 inside the JSON
// (see files.js for what is accepted; app.js allows larger bodies on /notes).
//
// The rule that matters: a faculty member can only change items in courses
// where courses.faculty_id is their own id. Admins can change any course.
// A course someone may not manage gets the same 404 as one that doesn't exist.

import { Router } from 'express';
import { toDbTime } from '../db.js';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireApproved, requireRole } from '../auth.js';
import { checkClassLink, checkNoteDetails } from '../validate.js';
import { checkUpload, storeFile, deleteStoredFile } from '../files.js';

// Kinds shown in the "Notes" section ('other' rows come from before notes and
// class links were separate).
const NOTE_KINDS = ['notes', 'other'];

export function facultyRoutes({ db, config }) {
	const router = Router();
	const guard = [requireLogin, requirePasswordChanged, requireApproved, requireRole('faculty', 'admin')];

	// The course if this user may manage it, otherwise null.
	function manageableCourse(user, courseId) {
		const course = db.prepare('SELECT * FROM courses WHERE id = ? AND active = 1').get(Number(courseId));
		if (!course) return null;
		return user.role === 'admin' || course.faculty_id === user.id ? course : null;
	}

	// The item (of one of the given kinds) if this user may manage its course, otherwise null.
	function manageableResource(user, resourceId, kinds) {
		const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(resourceId));
		if (!resource || !kinds.includes(resource.kind)) return null;
		return manageableCourse(user, resource.course_id) ? resource : null;
	}

	router.get('/teaching', ...guard, (req, res) => {
		const courses =
			req.user.role === 'admin'
				? db.prepare('SELECT * FROM courses WHERE active = 1 ORDER BY code').all()
				: db.prepare('SELECT * FROM courses WHERE active = 1 AND faculty_id = ? ORDER BY code').all(req.user.id);

		const countStudents = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE course_id = ?');
		const itemsFor = db.prepare(
			`SELECT id, kind, title, url, visible_from, updated_at, file_name, file_size
			 FROM resources WHERE course_id = ? ORDER BY kind, title`,
		);

		res.json({
			courses: courses.map((course) => ({
				id: course.id,
				code: course.code,
				title: course.title,
				semester: course.semester,
				studentCount: countStudents.get(course.id).n,
				resources: itemsFor.all(course.id).map((item) => ({
					id: item.id,
					kind: item.kind,
					title: item.title,
					url: item.url,
					file: item.file_name ? { name: item.file_name, size: item.file_size } : null,
					visibleFrom: item.visible_from,
					updatedAt: item.updated_at,
				})),
			})),
		});
	});

	// ---- Class links ----------------------------------------------------------

	router.post('/resources', ...guard, (req, res) => {
		const course = manageableCourse(req.user, req.body?.courseId);
		if (!course) return res.status(404).json({ error: 'course_not_found' });
		const { error, value } = checkClassLink(req.body);
		if (error) return res.status(400).json({ error });

		const id = db
			.prepare(
				`INSERT INTO resources (course_id, kind, title, url, visible_from, created_by, updated_at)
				 VALUES (?, 'class_link', ?, ?, ?, ?, ?)`,
			)
			.run(course.id, value.title, value.url, value.visibleFrom, req.user.id, toDbTime(new Date())).lastInsertRowid;
		logAudit(db, { actorId: req.user.id, action: 'resource_added', target: `resource:${id}` });
		res.status(201).json({ id: Number(id) });
	});

	router.put('/resources/:id', ...guard, (req, res) => {
		const resource = manageableResource(req.user, req.params.id, ['class_link']);
		if (!resource) return res.status(404).json({ error: 'resource_not_found' });
		const { error, value } = checkClassLink(req.body);
		if (error) return res.status(400).json({ error });

		db.prepare('UPDATE resources SET title = ?, url = ?, visible_from = ?, updated_at = ? WHERE id = ?').run(
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
		const resource = manageableResource(req.user, req.params.id, ['class_link']);
		if (!resource) return res.status(404).json({ error: 'resource_not_found' });
		db.prepare('DELETE FROM resources WHERE id = ?').run(resource.id);
		logAudit(db, { actorId: req.user.id, action: 'resource_deleted', target: `resource:${resource.id} course:${resource.course_id}` });
		res.status(204).end();
	});

	// ---- Notes ----------------------------------------------------------------

	// Checks the note details and, if sent, the file.
	// Returns { error } or { value: { title, url, visibleFrom, upload } } where
	// upload is a checked file, null (remove the file) or undefined (no change).
	function checkNote(body) {
		const details = checkNoteDetails(body);
		if (details.error) return details;
		let upload = body.file;
		if (upload) {
			const checked = checkUpload(upload, config.maxUploadBytes);
			if (checked.error) return checked;
			upload = checked.value;
		} else if (upload !== undefined) {
			upload = null;
		}
		return { value: { ...details.value, upload } };
	}

	router.post('/notes', ...guard, (req, res) => {
		const course = manageableCourse(req.user, req.body?.courseId);
		if (!course) return res.status(404).json({ error: 'course_not_found' });
		const { error, value } = checkNote(req.body);
		if (error) return res.status(400).json({ error });
		if (!value.upload && !value.url) return res.status(400).json({ error: 'file_or_link_required' });

		const storedAs = value.upload ? storeFile(config.uploadsDir, value.upload.buffer) : null;
		let id;
		try {
			id = db
				.prepare(
					`INSERT INTO resources (course_id, kind, title, url, visible_from, created_by, updated_at,
					                        file_name, file_stored_as, file_size, file_type)
					 VALUES (?, 'notes', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					course.id,
					value.title,
					value.url,
					value.visibleFrom,
					req.user.id,
					toDbTime(new Date()),
					value.upload?.fileName ?? null,
					storedAs,
					value.upload?.size ?? null,
					value.upload?.mime ?? null,
				).lastInsertRowid;
		} catch (error) {
			deleteStoredFile(config.uploadsDir, storedAs); // don't leave a file nothing points to
			throw error;
		}
		const fileNote = storedAs ? ` file:${storedAs} (${value.upload.size} bytes)` : '';
		logAudit(db, { actorId: req.user.id, action: 'note_added', target: `resource:${id} course:${course.id}${fileNote}` });
		res.status(201).json({ id: Number(id) });
	});

	router.put('/notes/:id', ...guard, (req, res) => {
		const note = manageableResource(req.user, req.params.id, NOTE_KINDS);
		if (!note) return res.status(404).json({ error: 'resource_not_found' });
		const { error, value } = checkNote(req.body);
		if (error) return res.status(400).json({ error });

		// The file the note will have afterwards: the new one, none, or the current one.
		const keepFile = value.upload === undefined;
		if (!value.url && !(value.upload || (keepFile && note.file_stored_as))) {
			return res.status(400).json({ error: 'file_or_link_required' });
		}
		const file = keepFile
			? { name: note.file_name, storedAs: note.file_stored_as, size: note.file_size, type: note.file_type }
			: value.upload
				? { name: value.upload.fileName, storedAs: null, size: value.upload.size, type: value.upload.mime }
				: { name: null, storedAs: null, size: null, type: null };
		if (value.upload) file.storedAs = storeFile(config.uploadsDir, value.upload.buffer);

		try {
			db.prepare(
				`UPDATE resources SET title = ?, url = ?, visible_from = ?, updated_at = ?,
				        file_name = ?, file_stored_as = ?, file_size = ?, file_type = ?
				 WHERE id = ?`,
			).run(value.title, value.url, value.visibleFrom, toDbTime(new Date()), file.name, file.storedAs, file.size, file.type, note.id);
		} catch (error) {
			if (value.upload) deleteStoredFile(config.uploadsDir, file.storedAs);
			throw error;
		}
		if (!keepFile) deleteStoredFile(config.uploadsDir, note.file_stored_as); // replaced or removed

		const fileNote = keepFile ? '' : value.upload ? ` file replaced:${file.storedAs}` : ' file removed';
		logAudit(db, { actorId: req.user.id, action: 'note_changed', target: `resource:${note.id}${fileNote}` });
		res.json({ id: note.id });
	});

	router.delete('/notes/:id', ...guard, (req, res) => {
		const note = manageableResource(req.user, req.params.id, NOTE_KINDS);
		if (!note) return res.status(404).json({ error: 'resource_not_found' });
		db.prepare('DELETE FROM resources WHERE id = ?').run(note.id);
		deleteStoredFile(config.uploadsDir, note.file_stored_as);
		logAudit(db, { actorId: req.user.id, action: 'note_deleted', target: `resource:${note.id} course:${note.course_id}` });
		res.status(204).end();
	});

	return router;
}
