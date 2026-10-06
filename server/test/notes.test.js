import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startTestServer, client, addUser, addOffering, enrol } from './helpers.js';
import { toDbTime } from '../src/db.js';
import { makeZip, fakeDocx, fakePptx, fakeMacroEnabledDocx, FAKE_PDF, FAKE_EXE, FAKE_OLE, upload } from './fake-files.js';

describe('notes with files (REPORT.md section 18)', () => {
	let app, mine, theirs, enrolledStudent, pendingStudent;
	const browsers = {};

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		const me = await addUser(db, { name: 'Prof Me', email: 'me@example.test', role: 'faculty' });
		const other = await addUser(db, { name: 'Prof Other', email: 'other@example.test', role: 'faculty' });
		await addUser(db, { email: 'admin@example.test', role: 'admin' });
		enrolledStudent = await addUser(db, { email: 'student@example.test' });
		await addUser(db, { email: 'outsider@example.test' });
		pendingStudent = await addUser(db, { email: 'pending@example.test', status: 'pending' });

		mine = addOffering(db, { code: 'MINE', teacherId: me });
		theirs = addOffering(db, { code: 'THEIRS', teacherId: other });
		enrol(db, mine, enrolledStudent);
		enrol(db, mine, pendingStudent);

		for (const name of ['me', 'other', 'admin', 'student', 'outsider', 'pending']) {
			browsers[name] = client(app.baseUrl);
			await browsers[name].login(`${name}@example.test`);
		}
	});
	after(() => app.close());

	const addNote = (who, body) => browsers[who].request('/notes', { method: 'POST', body: { offeringId: mine, title: 'Week 1', ...body } });
	const errorFor = async (name, bytes) => (await addNote('me', { file: upload(name, bytes) })).body.error;
	const storedFiles = () => readdirSync(app.config.uploadsDir);
	const storedNameOf = (id) => app.db.prepare('SELECT file_stored_as FROM resources WHERE id = ?').get(id).file_stored_as;

	describe('which files are accepted', () => {
		test('PDF, text, Markdown, CSV and modern Word/PowerPoint files are accepted', async () => {
			const good = [
				['notes.pdf', FAKE_PDF],
				['notes.txt', 'Plain text notes — with UTF-8 ✓'],
				['notes.md', '# Heading\n\n- point'],
				['marks.csv', 'roll,mark\nPHD99001,10\n'],
				['notes.docx', fakeDocx()],
				['slides.pptx', fakePptx()],
				['UPPER.PDF', FAKE_PDF],
			];
			for (const [name, bytes] of good) {
				const res = await addNote('me', { file: upload(name, bytes) });
				assert.equal(res.status, 201, `${name}: ${JSON.stringify(res.body)}`);
			}
		});

		test('a renamed program (.exe) is refused whatever it is called', async () => {
			for (const name of ['setup.exe', 'notes.pdf', 'notes.txt', 'notes.md', 'notes.csv', 'notes.docx', 'notes.pptx']) {
				assert.equal(await errorFor(name, FAKE_EXE), 'invalid_file_type', name);
			}
		});

		test('a fake PDF (not starting with %PDF-) is refused', async () => {
			assert.equal(await errorFor('notes.pdf', 'This is not really a PDF'), 'invalid_file_type');
			assert.equal(await errorFor('notes.pdf', fakeDocx()), 'invalid_file_type');
		});

		test('text files must be valid UTF-8 without binary bytes', async () => {
			assert.equal(await errorFor('notes.txt', Buffer.from([0x68, 0x69, 0xff, 0xfe])), 'invalid_file_type');
			assert.equal(await errorFor('notes.txt', Buffer.from('text\u0000with a NUL')), 'invalid_file_type');
		});

		test('a ZIP that is not a Word/PowerPoint file is refused', async () => {
			const plainZip = makeZip([{ name: 'readme.txt', data: 'hello' }]);
			assert.equal(await errorFor('notes.docx', plainZip), 'invalid_file_type');
			assert.equal(await errorFor('notes.pptx', fakeDocx()), 'invalid_file_type'); // Word file named .pptx
			assert.equal(await errorFor('notes.docx', fakePptx()), 'invalid_file_type');
			assert.equal(await errorFor('notes.docx', Buffer.from('PK\u0003\u0004 broken')), 'invalid_file_type');
		});

		test('Office files with macros are refused', async () => {
			const withMacros = fakeDocx([{ name: 'word/vbaProject.bin', data: 'fake macro code' }]);
			assert.equal(await errorFor('notes.docx', withMacros), 'invalid_file_type');
			assert.equal(await errorFor('slides.pptx', fakePptx([{ name: 'ppt/vbaProject.bin', data: 'x' }])), 'invalid_file_type');
			assert.equal(await errorFor('notes.docx', fakeDocx([{ name: 'word/activeX/activeX1.xml', data: '<x/>' }])), 'invalid_file_type');
			assert.equal(await errorFor('notes.docx', fakeMacroEnabledDocx()), 'invalid_file_type');
		});

		test('macro-enabled (.docm .pptm .xlsm) and legacy (.doc .ppt) files are refused', async () => {
			for (const [name, bytes] of [
				['notes.docm', fakeDocx()],
				['slides.pptm', fakePptx()],
				['sheet.xlsm', fakeDocx()],
				['notes.doc', FAKE_OLE],
				['slides.ppt', FAKE_OLE],
				['notes.docx', FAKE_OLE], // a legacy file renamed to .docx
			]) {
				assert.equal(await errorFor(name, bytes), 'invalid_file_type', name);
			}
		});

		test('zip bombs are refused', async () => {
			const zeros = Buffer.alloc(5 * 1024 * 1024); // compresses about 1000 to 1
			assert.equal(await errorFor('notes.docx', fakeDocx([{ name: 'word/media/big.bin', data: zeros, deflate: true }])), 'invalid_file_type');
			const claimsHuge = fakeDocx([{ name: 'word/media/a.bin', data: 'x', claimedSize: 300 * 1024 * 1024 }]);
			assert.equal(await errorFor('notes.docx', claimsHuge), 'invalid_file_type');
			const manyParts = fakeDocx(Array.from({ length: 2001 }, (_, i) => ({ name: `word/p${i}.xml`, data: '' })));
			assert.equal(await errorFor('notes.docx', manyParts), 'invalid_file_type');
		});

		test('a file over 20 MB is refused', async () => {
			const tooBig = Buffer.alloc(20 * 1024 * 1024 + 1, 'a');
			const res = await addNote('me', { file: upload('big.txt', tooBig) });
			assert.equal(res.status, 400);
			assert.equal(res.body.error, 'file_too_large');
		});

		test('a request far beyond the limit gets file_too_large too', async () => {
			const small = await startTestServer({ env: { MAX_UPLOAD_MB: '0.01' } });
			try {
				await addUser(small.db, { email: 'me@example.test', role: 'faculty' });
				const browser = client(small.baseUrl);
				await browser.login('me@example.test');
				const res = await browser.request('/notes', {
					method: 'POST',
					body: { offeringId: 1, title: 'x', file: upload('big.txt', Buffer.alloc(100 * 1024, 'a')) },
				});
				assert.equal(res.status, 413);
				assert.equal(res.body.error, 'file_too_large');
			} finally {
				await small.close();
			}
		});

		test('a note needs a file or a link, and the file data must be base64', async () => {
			assert.equal((await addNote('me', {})).body.error, 'file_or_link_required');
			assert.equal((await addNote('me', { file: null })).body.error, 'file_or_link_required');
			assert.equal((await addNote('me', { url: 'https://example.com/reading' })).status, 201);
			assert.equal((await addNote('me', { url: 'javascript:alert(1)' })).body.error, 'invalid_url');
			assert.equal((await addNote('me', { file: { name: 'a.txt', data: 'not base64!' } })).body.error, 'invalid_file');
			assert.equal((await addNote('me', { file: 'a.txt' })).body.error, 'invalid_file');
		});

		test('file names are cleaned and files are stored under random names', async () => {
			const res = await addNote('me', { file: upload('..\\..//etc/"passwd".txt', 'x') });
			const row = app.db.prepare('SELECT file_name, file_stored_as FROM resources WHERE id = ?').get(res.body.id);
			assert.equal(row.file_name, 'passwd.txt');
			assert.match(row.file_stored_as, /^[a-f0-9]{32}$/);
			assert.ok(existsSync(join(app.config.uploadsDir, row.file_stored_as)));
		});
	});

	describe('who may download', () => {
		let noteId, futureNoteId, theirNoteId;
		const download = (who, id) => browsers[who].request(`/files/${id}`);

		before(async () => {
			noteId = (await addNote('me', { title: 'Lecture 1', file: upload('Lecture 1 – notes.pdf', FAKE_PDF) })).body.id;
			futureNoteId = (await addNote('me', { title: 'Later', file: upload('later.txt', 'soon'), visibleFrom: '2099-01-01' })).body.id;
			theirNoteId = (
				await browsers.other.request('/notes', { method: 'POST', body: { offeringId: theirs, title: 'Theirs', file: upload('t.txt', 'theirs') } })
			).body.id;
		});

		test('an enrolled student downloads it as an attachment with the right type', async () => {
			const res = await download('student', noteId);
			assert.equal(res.status, 200);
			assert.deepEqual(res.body, FAKE_PDF);
			assert.equal(res.headers.get('content-type'), 'application/pdf');
			assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
			assert.match(res.headers.get('content-disposition'), /^attachment; filename="Lecture 1 \? notes.pdf"; filename\*=UTF-8''Lecture%201%20%E2%80%93%20notes.pdf$/);
			assert.match(res.headers.get('cache-control'), /no-store/);
		});

		test('the student sees the note in their course list, without the stored file name', async () => {
			const course = (await browsers.student.request('/my-courses')).body.current[0];
			const note = course.resources.find((item) => item.id === noteId);
			assert.deepEqual(note.file, { name: 'Lecture 1 – notes.pdf', size: FAKE_PDF.length });
			assert.equal(note.url, null);
			assert.ok(!course.resources.some((item) => item.id === futureNoteId));
			assert.ok(!JSON.stringify(course).includes(storedNameOf(noteId)));
		});

		test('a student of another course, a pending student and a logged-out visitor cannot', async () => {
			assert.equal((await download('outsider', noteId)).status, 404);
			assert.deepEqual((await download('pending', noteId)).body, { error: 'approval_pending' });
			assert.equal((await client(app.baseUrl).request(`/files/${noteId}`)).status, 401);
		});

		test('a note is not downloadable before its show-from date (except by staff)', async () => {
			assert.equal((await download('student', futureNoteId)).status, 404);
			assert.equal((await download('me', futureNoteId)).status, 200);
			assert.equal((await download('admin', futureNoteId)).status, 200);
		});

		test("another faculty member's course: no download, no change, no delete", async () => {
			assert.equal((await download('other', noteId)).status, 404);
			assert.equal((await download('me', theirNoteId)).status, 404);
			assert.equal((await download('admin', theirNoteId)).status, 200);
			assert.deepEqual((await browsers.other.request(`/notes/${noteId}`, { method: 'PUT', body: { title: 'hijacked', url: 'https://example.com' } })).body, {
				error: 'resource_not_found',
			});
			assert.equal((await browsers.other.request(`/notes/${noteId}`, { method: 'DELETE' })).status, 404);
			assert.equal((await browsers.other.request('/notes', { method: 'POST', body: { offeringId: mine, title: 'x', url: 'https://example.com' } })).status, 404);
			assert.equal((await download('student', noteId)).status, 200); // still there
		});

		test('a class link has no file to download', async () => {
			const link = await browsers.me.request('/resources', { method: 'POST', body: { offeringId: mine, title: 'Class', url: 'https://example.com/c' } });
			assert.equal((await download('me', link.body.id)).status, 404);
		});
	});

	describe('changing and deleting', () => {
		test('replacing a file deletes the old one; removing it needs a link to remain', async () => {
			const id = (await addNote('me', { file: upload('v1.txt', 'version 1') })).body.id;
			const first = storedNameOf(id);

			const replaced = await browsers.me.request(`/notes/${id}`, { method: 'PUT', body: { title: 'Week 1', file: upload('v2.txt', 'version 2') } });
			assert.equal(replaced.status, 200);
			const second = storedNameOf(id);
			assert.notEqual(second, first);
			assert.ok(!storedFiles().includes(first));
			assert.equal((await browsers.student.request(`/files/${id}`)).body.toString(), 'version 2');

			const kept = await browsers.me.request(`/notes/${id}`, { method: 'PUT', body: { title: 'Renamed' } });
			assert.equal(kept.status, 200);
			assert.equal(storedNameOf(id), second); // no file sent: the file stays

			const noLink = await browsers.me.request(`/notes/${id}`, { method: 'PUT', body: { title: 'Renamed', file: null } });
			assert.equal(noLink.body.error, 'file_or_link_required');
			const removed = await browsers.me.request(`/notes/${id}`, {
				method: 'PUT',
				body: { title: 'Renamed', file: null, url: 'https://example.com/instead' },
			});
			assert.equal(removed.status, 200);
			assert.equal(storedNameOf(id), null);
			assert.ok(!storedFiles().includes(second));
		});

		test('deleting a note deletes its file, and everything is in the audit log', async () => {
			const id = (await addNote('me', { file: upload('gone.txt', 'bye') })).body.id;
			const stored = storedNameOf(id);
			assert.ok(storedFiles().includes(stored));
			assert.equal((await browsers.me.request(`/notes/${id}`, { method: 'DELETE' })).status, 204);
			assert.ok(!storedFiles().includes(stored));
			assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM resources WHERE id = ?').get(id).n, 0);

			const actions = app.db.prepare('SELECT action FROM audit_log').all().map((row) => row.action);
			for (const action of ['note_added', 'note_changed', 'note_deleted', 'note_downloaded']) assert.ok(actions.includes(action), action);
		});

		test('notes and class links are separate: /resources does not touch notes', async () => {
			const id = (await addNote('me', { url: 'https://example.com/n' })).body.id;
			assert.equal((await browsers.me.request(`/resources/${id}`, { method: 'DELETE' })).status, 404);
			const link = await browsers.me.request('/resources', { method: 'POST', body: { offeringId: mine, title: 'Class', url: 'https://example.com/c' } });
			assert.equal((await browsers.me.request(`/notes/${link.body.id}`, { method: 'DELETE' })).status, 404);
		});

		test('older "other" items are managed as notes', async () => {
			const id = Number(
				app.db
					.prepare("INSERT INTO resources (offering_id, kind, title, url, updated_at) VALUES (?, 'other', 'Old item', 'https://example.com/o', ?)")
					.run(mine, toDbTime(new Date())).lastInsertRowid,
			);
			const res = await browsers.me.request(`/notes/${id}`, { method: 'PUT', body: { title: 'Old item', url: 'https://example.com/o', file: upload('o.txt', 'x') } });
			assert.equal(res.status, 200);
			assert.equal(app.db.prepare('SELECT kind FROM resources WHERE id = ?').get(id).kind, 'other');
		});
	});
});
