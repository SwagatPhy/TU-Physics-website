// GET /api/files/:id — download the file of a note.
//
// Allowed for: an approved student enrolled in the note's offering (and not
// removed from it), once the note's show-from date has passed and unless the
// teacher hid a finished offering's content; the offering's teacher; an admin.
// Everyone else gets the same 404 as for a note that doesn't exist.
// The file is always sent as a download (attachment) with its checked MIME
// type and "nosniff", so a browser never displays or runs it as a web page.

import { Router } from 'express';
import { resolve } from 'node:path';
import { toDbTime } from '../db.js';
import { logAudit } from '../audit.js';
import { requireLogin, requirePasswordChanged, requireApproved } from '../auth.js';
import { storedFilePath } from '../files.js';

export function filesRoutes({ db, config }) {
	const router = Router();

	function mayDownload(user, note) {
		if (user.role === 'admin') return true;
		if (user.role === 'faculty') return note.teacher_id === user.id;
		if (user.role !== 'student') return false;
		const enrolled = db
			.prepare('SELECT 1 FROM enrollments WHERE user_id = ? AND offering_id = ? AND removed = 0')
			.get(user.id, note.offering_id);
		const visible = note.visible_from === null || note.visible_from <= toDbTime(new Date());
		const hidden = note.status === 'finished' && Boolean(note.content_hidden);
		return Boolean(enrolled) && visible && !hidden;
	}

	router.get('/files/:id', requireLogin, requirePasswordChanged, requireApproved, (req, res) => {
		const note = db
			.prepare(
				`SELECT r.id, r.offering_id, r.visible_from, r.file_name, r.file_stored_as, r.file_type,
				        o.teacher_id, o.status, o.content_hidden
				 FROM resources r JOIN offerings o ON o.id = r.offering_id
				 WHERE r.id = ? AND r.file_stored_as IS NOT NULL`,
			)
			.get(Number(req.params.id));
		const path = note && mayDownload(req.user, note) ? storedFilePath(config.uploadsDir, note.file_stored_as) : null;
		if (!path) return res.status(404).json({ error: 'file_not_found' });

		logAudit(db, { actorId: req.user.id, action: 'note_downloaded', target: `resource:${note.id}` });
		res.attachment(note.file_name); // Content-Disposition: attachment; filename="…"; filename*=UTF-8''…
		res.type(note.file_type);
		res.set('Cache-Control', 'private, no-store');
		// root: only the random file name is checked by sendFile, so a server path
		// with a dot-folder in it (e.g. /home/x/.apps/…) still works.
		res.sendFile(note.file_stored_as, { root: resolve(config.uploadsDir) });
	});

	return router;
}
