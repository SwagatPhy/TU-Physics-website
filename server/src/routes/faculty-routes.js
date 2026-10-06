// Faculty dashboard API: the offerings I teach (a course for one batch in one
// semester; admin: all offerings), with their class links and notes.
//   GET    /teaching                    my offerings, with links, notes, student counts and earlier offerings to copy from
//   POST   /resources                   class link {offeringId, title, url, visibleFrom?}
//   PUT    /resources/:id               {title, url, visibleFrom?}
//   DELETE /resources/:id
//   POST   /notes                       {offeringId, title, url?, visibleFrom?, file?: {name, data}}
//   PUT    /notes/:id                   same without offeringId; file: object = replace, null = remove, absent = keep
//   DELETE /notes/:id                   also deletes the stored file
//   PUT    /offerings/:id/visibility    {hidden: true|false}  finished offerings only
//   POST   /offerings/:id/copy          {fromOfferingId}  copy links and notes (with files) from an earlier offering
//
// A note needs a file, a link, or both. File data is base64 inside the JSON
// (see files.js for what is accepted; app.js allows larger bodies on /notes).
//
// The rule that matters: a faculty member can only change items in offerings
// where offerings.teacher_id is their own id. Admins can change any offering.
// An offering someone may not manage gets the same 404 as one that doesn't exist.

import { Router } from 'express';
import { readFileSync } from 'node:fs';
import { toDbTime } from '../db.js';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireApproved, requireRole } from '../auth.js';
import { checkClassLink, checkNoteDetails } from '../validate.js';
import { checkUpload, storeFile, deleteStoredFile, storedFilePath } from '../files.js';

// Kinds shown in the "Notes" section ('other' rows come from before notes and
// class links were separate).
const NOTE_KINDS = ['notes', 'other'];

export function facultyRoutes({ db, config }) {
	const router = Router();
	const guard = [requireLogin, requirePasswordChanged, requireApproved, requireRole('faculty', 'admin')];

	const OFFERING_SQL = `SELECT o.*, c.code, c.title FROM offerings o JOIN courses c ON c.id = o.course_id`;

	// The offering if this user may manage it, otherwise null.
	function manageableOffering(user, offeringId) {
		const offering = db.prepare(`${OFFERING_SQL} WHERE o.id = ?`).get(Number(offeringId));
		if (!offering) return null;
		return user.role === 'admin' || offering.teacher_id === user.id ? offering : null;
	}

	// The item (of one of the given kinds) if this user may manage its offering, otherwise null.
	function manageableResource(user, resourceId, kinds) {
		const resource = db.prepare('SELECT * FROM resources WHERE id = ?').get(Number(resourceId));
		if (!resource || !kinds.includes(resource.kind)) return null;
		return manageableOffering(user, resource.offering_id) ? resource : null;
	}

	// Offerings this user may manage: all for an admin, else the ones they teach.
	function myOfferings(user) {
		const order = 'ORDER BY o.status, c.code, o.batch_year, o.semester';
		return user.role === 'admin'
			? db.prepare(`${OFFERING_SQL} ${order}`).all()
			: db.prepare(`${OFFERING_SQL} WHERE o.teacher_id = ? ${order}`).all(user.id);
	}

	const countItems = db.prepare('SELECT COUNT(*) AS n FROM resources WHERE offering_id = ?');

	router.get('/teaching', ...guard, (req, res) => {
		const offerings = myOfferings(req.user);
		const countStudents = db.prepare('SELECT COUNT(*) AS n FROM enrollments WHERE offering_id = ? AND removed = 0');
		const itemsFor = db.prepare(
			`SELECT id, kind, title, url, visible_from, updated_at, file_name, file_size
			 FROM resources WHERE offering_id = ? ORDER BY kind, title`,
		);

		res.json({
			offerings: offerings.map((offering) => ({
				id: offering.id,
				code: offering.code,
				title: offering.title,
				programme: offering.programme,
				batchYear: offering.batch_year,
				semester: offering.semester,
				status: offering.status,
				isElective: Boolean(offering.is_elective),
				contentHidden: Boolean(offering.content_hidden),
				studentCount: countStudents.get(offering.id).n,
				// Other offerings of the same course this user manages, to copy links and notes from.
				previousOfferings: offerings
					.filter((other) => other.course_id === offering.course_id && other.id !== offering.id)
					.map((other) => ({
						id: other.id,
						programme: other.programme,
						batchYear: other.batch_year,
						semester: other.semester,
						itemCount: countItems.get(other.id).n,
					})),
				resources: itemsFor.all(offering.id).map((item) => ({
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

	// ---- Finished offerings: hide or show their content -----------------------

	router.put('/offerings/:id/visibility', ...guard, (req, res) => {
		const offering = manageableOffering(req.user, req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		if (offering.status !== 'finished') return res.status(400).json({ error: 'offering_not_finished' });
		if (typeof req.body?.hidden !== 'boolean') return res.status(400).json({ error: 'invalid_input' });
		db.prepare('UPDATE offerings SET content_hidden = ? WHERE id = ?').run(req.body.hidden ? 1 : 0, offering.id);
		logAudit(db, { actorId: req.user.id, action: req.body.hidden ? 'offering_content_hidden' : 'offering_content_shown', target: `offering:${offering.id}` });
		res.json({ id: offering.id, hidden: req.body.hidden });
	});

	// ---- Copy links and notes from an earlier offering of the same course -----

	router.post('/offerings/:id/copy', ...guard, (req, res) => {
		const offering = manageableOffering(req.user, req.params.id);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const source = manageableOffering(req.user, req.body?.fromOfferingId);
		if (!source || source.id === offering.id || source.course_id !== offering.course_id) {
			return res.status(404).json({ error: 'copy_source_not_found' });
		}

		const items = db.prepare('SELECT * FROM resources WHERE offering_id = ? ORDER BY id').all(source.id);
		const insert = db.prepare(
			`INSERT INTO resources (offering_id, kind, title, url, visible_from, created_by, updated_at,
			                        file_name, file_stored_as, file_size, file_type)
			 VALUES (?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)`,
		);
		const now = toDbTime(new Date());
		const newFiles = [];
		let copied = 0;
		db.exec('BEGIN');
		try {
			for (const item of items) {
				// Each copy gets its own stored file, so deleting one note never removes the other's file.
				const sourceFile = item.file_stored_as ? storedFilePath(config.uploadsDir, item.file_stored_as) : null;
				if (item.file_stored_as && !sourceFile && !item.url) continue; // file lost and nothing else to copy
				const storedAs = sourceFile ? storeFile(config.uploadsDir, readFileSync(sourceFile)) : null;
				if (storedAs) newFiles.push(storedAs);
				insert.run(
					offering.id,
					item.kind,
					item.title,
					item.url,
					req.user.id,
					now,
					storedAs ? item.file_name : null,
					storedAs,
					storedAs ? item.file_size : null,
					storedAs ? item.file_type : null,
				);
				copied += 1;
			}
			db.exec('COMMIT');
		} catch (error) {
			db.exec('ROLLBACK');
			for (const name of newFiles) deleteStoredFile(config.uploadsDir, name);
			throw error;
		}
		logAudit(db, { actorId: req.user.id, action: 'offering_content_copied', target: `offering:${source.id} -> offering:${offering.id} (${copied} item(s))` });
		res.json({ copied });
	});

	// ---- Class links ----------------------------------------------------------

	router.post('/resources', ...guard, (req, res) => {
		const offering = manageableOffering(req.user, req.body?.offeringId);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const { error, value } = checkClassLink(req.body);
		if (error) return res.status(400).json({ error });

		const id = db
			.prepare(
				`INSERT INTO resources (offering_id, kind, title, url, visible_from, created_by, updated_at)
				 VALUES (?, 'class_link', ?, ?, ?, ?, ?)`,
			)
			.run(offering.id, value.title, value.url, value.visibleFrom, req.user.id, toDbTime(new Date())).lastInsertRowid;
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
		logAudit(db, { actorId: req.user.id, action: 'resource_deleted', target: `resource:${resource.id} offering:${resource.offering_id}` });
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
		const offering = manageableOffering(req.user, req.body?.offeringId);
		if (!offering) return res.status(404).json({ error: 'offering_not_found' });
		const { error, value } = checkNote(req.body);
		if (error) return res.status(400).json({ error });
		if (!value.upload && !value.url) return res.status(400).json({ error: 'file_or_link_required' });

		const storedAs = value.upload ? storeFile(config.uploadsDir, value.upload.buffer) : null;
		let id;
		try {
			id = db
				.prepare(
					`INSERT INTO resources (offering_id, kind, title, url, visible_from, created_by, updated_at,
					                        file_name, file_stored_as, file_size, file_type)
					 VALUES (?, 'notes', ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
				)
				.run(
					offering.id,
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
		logAudit(db, { actorId: req.user.id, action: 'note_added', target: `resource:${id} offering:${offering.id}${fileNote}` });
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
		logAudit(db, { actorId: req.user.id, action: 'note_deleted', target: `resource:${note.id} offering:${note.offering_id}` });
		res.status(204).end();
	});

	return router;
}
