import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { startTestServer, client, addUser, addOffering, enrol } from './helpers.js';
import { toDbTime } from '../src/db.js';
import { upload } from './fake-files.js';

describe('faculty dashboard: offerings and class links', () => {
	let app, mine, mineLastYear, theirs, theirLink;
	const browsers = {};

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		const me = await addUser(db, { name: 'Prof Me', email: 'me@example.test', role: 'faculty' });
		const other = await addUser(db, { name: 'Prof Other', email: 'other@example.test', role: 'faculty' });
		await addUser(db, { email: 'admin@example.test', role: 'admin' });
		const student = await addUser(db, { email: 'student@example.test' });
		await addUser(db, { email: 'pending@example.test', role: 'faculty', mustChange: 1 });

		mine = addOffering(db, { code: 'MINE', teacherId: me, programme: 'MSc', batchYear: 2025, semester: 'Autumn 2026' });
		mineLastYear = addOffering(db, { code: 'MINE', teacherId: me, programme: 'MSc', batchYear: 2024, semester: 'Autumn 2025', status: 'finished' });
		theirs = addOffering(db, { code: 'THEIRS', teacherId: other, programme: 'MSc', batchYear: 2025 });
		enrol(db, mine, student);
		theirLink = Number(
			db
				.prepare('INSERT INTO resources (offering_id, kind, title, url, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
				.run(theirs, 'class_link', 'Their link', 'https://example.com/theirs', other, toDbTime(new Date())).lastInsertRowid,
		);

		for (const email of ['me', 'other', 'admin', 'student', 'pending']) {
			browsers[email] = client(app.baseUrl);
			await browsers[email].login(`${email}@example.test`);
		}
	});
	after(() => app.close());

	const link = (extra = {}) => ({ title: 'Week 1 class', url: 'https://example.com/week1', ...extra });
	const post = (who, body) => browsers[who].request('/resources', { method: 'POST', body });
	const teaching = async (who = 'me') => (await browsers[who].request('/teaching')).body.offerings;

	test('/teaching lists only my own offerings, with batch, semester, status and student counts', async () => {
		const offerings = await teaching();
		assert.deepEqual(
			offerings.map((o) => [o.code, o.programme, o.batchYear, o.semester, o.status, o.studentCount]),
			[
				['MINE', 'MSc', 2025, 'Autumn 2026', 'active', 1],
				['MINE', 'MSc', 2024, 'Autumn 2025', 'finished', 0],
			],
		);
		assert.deepEqual(offerings[0].previousOfferings.map((p) => p.id), [mineLastYear]);
		assert.ok(!JSON.stringify(offerings).includes('Their link'));
	});

	test('admin sees every offering', async () => {
		assert.deepEqual((await teaching('admin')).map((o) => o.code), ['MINE', 'THEIRS', 'MINE']);
	});

	test('students, pending password changes and logged-out users are refused', async () => {
		assert.deepEqual((await browsers.student.request('/teaching')).body, { error: 'not_allowed' });
		assert.deepEqual((await browsers.pending.request('/teaching')).body, { error: 'password_change_required' });
		assert.equal((await client(app.baseUrl).request('/teaching')).status, 401);
		assert.equal((await post('student', { offeringId: mine, ...link() })).status, 403);
	});

	test('a faculty member can add, change and delete class links in their own offering', async () => {
		const added = await post('me', { offeringId: mine, ...link({ visibleFrom: '2030-01-01' }) });
		assert.equal(added.status, 201);
		const id = added.body.id;
		assert.deepEqual(
			(await teaching())[0].resources.map((r) => [r.title, r.visibleFrom]),
			[['Week 1 class', '2030-01-01 00:00:00']],
		);

		assert.equal((await browsers.me.request(`/resources/${id}`, { method: 'PUT', body: link({ title: 'Week 1 class (v2)' }) })).status, 200);
		assert.deepEqual((await teaching())[0].resources.map((r) => [r.kind, r.title, r.visibleFrom]), [['class_link', 'Week 1 class (v2)', null]]);

		assert.equal((await browsers.me.request(`/resources/${id}`, { method: 'DELETE' })).status, 204);
		assert.deepEqual((await teaching())[0].resources, []);

		const actions = app.db.prepare('SELECT action FROM audit_log WHERE actor_id IS NOT NULL').all().map((row) => row.action);
		for (const action of ['resource_added', 'resource_changed', 'resource_deleted']) assert.ok(actions.includes(action));
	});

	test("a faculty member cannot add, change or delete links in another teacher's offering", async () => {
		assert.deepEqual((await post('me', { offeringId: theirs, ...link() })).body, { error: 'offering_not_found' });
		assert.deepEqual((await browsers.me.request(`/resources/${theirLink}`, { method: 'PUT', body: link({ title: 'hijacked' }) })).body, {
			error: 'resource_not_found',
		});
		assert.deepEqual((await browsers.me.request(`/resources/${theirLink}`, { method: 'DELETE' })).body, { error: 'resource_not_found' });
		assert.equal(app.db.prepare('SELECT title FROM resources WHERE id = ?').get(theirLink).title, 'Their link');
	});

	test('admin can manage links in any offering', async () => {
		assert.equal((await browsers.admin.request(`/resources/${theirLink}`, { method: 'PUT', body: link({ title: 'Fixed by admin' }) })).status, 200);
	});

	test('only http(s) links and sensible values are accepted', async () => {
		const bad = async (extra) => (await post('me', { offeringId: mine, ...link(extra) })).body.error;
		assert.equal(await bad({ url: 'javascript:alert(1)' }), 'invalid_url');
		assert.equal(await bad({ url: 'data:text/html,hi' }), 'invalid_url');
		assert.equal(await bad({ url: 'not a link' }), 'invalid_url');
		assert.equal(await bad({ url: undefined }), 'invalid_url'); // a class link needs a URL
		assert.equal(await bad({ title: '   ' }), 'invalid_title');
		assert.equal(await bad({ title: 'x'.repeat(201) }), 'invalid_title');
		assert.equal(await bad({ visibleFrom: 'next tuesday' }), 'invalid_date');
		assert.equal((await post('me', { offeringId: 'abc', ...link() })).status, 404);
	});

	test('a finished offering’s content can be hidden from students and shown again', async () => {
		const hide = (id, hidden, who = 'me') => browsers[who].request(`/offerings/${id}/visibility`, { method: 'PUT', body: { hidden } });
		assert.deepEqual((await hide(mine, true)).body, { error: 'offering_not_finished' });
		assert.equal((await hide(mineLastYear, true)).status, 200);
		assert.equal((await teaching()).find((o) => o.id === mineLastYear).contentHidden, true);
		assert.equal((await hide(mineLastYear, false)).status, 200);
		assert.equal((await hide(mineLastYear, true, 'other')).status, 404);
		const actions = app.db.prepare('SELECT action FROM audit_log').all().map((row) => row.action);
		assert.ok(actions.includes('offering_content_hidden') && actions.includes('offering_content_shown'));
	});

	test('links and notes (with their files) can be copied from an earlier offering of the same course', async () => {
		await post('me', { offeringId: mineLastYear, ...link({ title: 'Old class link' }) });
		await browsers.me.request('/notes', { method: 'POST', body: { offeringId: mineLastYear, title: 'Old notes', file: upload('old.txt', 'old notes') } });
		const filesBefore = readdirSync(app.config.uploadsDir).length;

		const copy = (from, to = mine, who = 'me') => browsers[who].request(`/offerings/${to}/copy`, { method: 'POST', body: { fromOfferingId: from } });
		assert.deepEqual((await copy(mineLastYear)).body, { copied: 2 });
		const copied = (await teaching())[0].resources;
		assert.deepEqual(copied.map((r) => r.title).sort(), ['Old class link', 'Old notes']);
		assert.equal(readdirSync(app.config.uploadsDir).length, filesBefore + 1, 'the copy has its own file');

		// The copy's file downloads, and deleting the copy leaves the original's file alone.
		const copiedNote = copied.find((r) => r.title === 'Old notes');
		assert.equal((await browsers.student.request(`/files/${copiedNote.id}`)).body.toString(), 'old notes');
		await browsers.me.request(`/notes/${copiedNote.id}`, { method: 'DELETE' });
		assert.equal(readdirSync(app.config.uploadsDir).length, filesBefore);

		assert.deepEqual((await copy(theirs)).body, { error: 'copy_source_not_found' }); // not mine
		assert.deepEqual((await copy(mine)).body, { error: 'copy_source_not_found' }); // itself
		assert.equal((await copy(mineLastYear, theirs)).status, 404); // into someone else's
		assert.ok(app.db.prepare("SELECT 1 FROM audit_log WHERE action = 'offering_content_copied'").get());
	});
});
