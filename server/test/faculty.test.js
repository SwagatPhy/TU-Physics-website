import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser } from './helpers.js';
import { toDbTime } from '../src/db.js';

describe('faculty link dashboard', () => {
	let app, mine, theirs, retired, theirLink;
	const browsers = {};

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		const me = await addUser(db, { name: 'Prof Me', email: 'me@example.test', role: 'faculty' });
		const other = await addUser(db, { name: 'Prof Other', email: 'other@example.test', role: 'faculty' });
		await addUser(db, { email: 'admin@example.test', role: 'admin' });
		const student = await addUser(db, { email: 'student@example.test' });
		await addUser(db, { email: 'pending@example.test', role: 'faculty', mustChange: 1 });

		const addCourse = db.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, ?)');
		mine = Number(addCourse.run('MINE', 'My course', 'TRIAL', me, 1).lastInsertRowid);
		theirs = Number(addCourse.run('THEIRS', 'Their course', 'TRIAL', other, 1).lastInsertRowid);
		retired = Number(addCourse.run('OLD', 'Old course', 'TRIAL', me, 0).lastInsertRowid);
		db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)').run(student, mine);
		theirLink = Number(
			db
				.prepare('INSERT INTO resources (course_id, kind, title, url, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)')
				.run(theirs, 'notes', 'Their notes', 'https://example.com/theirs', other, toDbTime(new Date())).lastInsertRowid,
		);

		for (const email of ['me', 'other', 'admin', 'student', 'pending']) {
			browsers[email] = client(app.baseUrl);
			await browsers[email].login(`${email}@example.test`);
		}
	});
	after(() => app.close());

	const link = (extra = {}) => ({ kind: 'notes', title: 'Week 1 notes', url: 'https://example.com/week1', ...extra });
	const post = (who, body) => browsers[who].request('/resources', { method: 'POST', body });

	test('/teaching lists only my own active courses, with student counts', async () => {
		const res = await browsers.me.request('/teaching');
		assert.equal(res.status, 200);
		assert.deepEqual(res.body.courses.map((c) => [c.code, c.studentCount]), [['MINE', 1]]);
		assert.ok(!JSON.stringify(res.body).includes('Their notes'));
	});

	test('admin sees every active course', async () => {
		const res = await browsers.admin.request('/teaching');
		assert.deepEqual(res.body.courses.map((c) => c.code), ['MINE', 'THEIRS']);
	});

	test('students, pending password changes and logged-out users are refused', async () => {
		assert.deepEqual((await browsers.student.request('/teaching')).body, { error: 'not_allowed' });
		assert.deepEqual((await browsers.pending.request('/teaching')).body, { error: 'password_change_required' });
		assert.equal((await client(app.baseUrl).request('/teaching')).status, 401);
		assert.equal((await post('student', { courseId: mine, ...link() })).status, 403);
	});

	test('a faculty member can add, change and delete links in their own course', async () => {
		const added = await post('me', { courseId: mine, ...link({ visibleFrom: '2030-01-01' }) });
		assert.equal(added.status, 201);
		const id = added.body.id;

		let course = (await browsers.me.request('/teaching')).body.courses[0];
		assert.deepEqual(
			course.resources.map((r) => [r.title, r.visibleFrom]),
			[['Week 1 notes', '2030-01-01 00:00:00']],
		);

		const changed = await browsers.me.request(`/resources/${id}`, { method: 'PUT', body: link({ title: 'Week 1 notes (v2)', kind: 'other' }) });
		assert.equal(changed.status, 200);
		course = (await browsers.me.request('/teaching')).body.courses[0];
		assert.deepEqual(course.resources.map((r) => [r.kind, r.title, r.visibleFrom]), [['other', 'Week 1 notes (v2)', null]]);

		assert.equal((await browsers.me.request(`/resources/${id}`, { method: 'DELETE' })).status, 204);
		assert.deepEqual((await browsers.me.request('/teaching')).body.courses[0].resources, []);

		const actions = app.db.prepare('SELECT action FROM audit_log WHERE actor_id IS NOT NULL').all().map((row) => row.action);
		for (const action of ['resource_added', 'resource_changed', 'resource_deleted']) assert.ok(actions.includes(action));
	});

	test("a faculty member cannot add, change or delete links in another faculty member's course", async () => {
		assert.deepEqual((await post('me', { courseId: theirs, ...link() })).body, { error: 'course_not_found' });
		const put = await browsers.me.request(`/resources/${theirLink}`, { method: 'PUT', body: link({ title: 'hijacked' }) });
		assert.deepEqual(put.body, { error: 'resource_not_found' });
		const del = await browsers.me.request(`/resources/${theirLink}`, { method: 'DELETE' });
		assert.deepEqual(del.body, { error: 'resource_not_found' });

		const row = app.db.prepare('SELECT title FROM resources WHERE id = ?').get(theirLink);
		assert.equal(row.title, 'Their notes'); // untouched
	});

	test('an inactive course cannot be changed', async () => {
		assert.deepEqual((await post('me', { courseId: retired, ...link() })).body, { error: 'course_not_found' });
	});

	test('admin can manage links in any course', async () => {
		const res = await browsers.admin.request(`/resources/${theirLink}`, { method: 'PUT', body: link({ title: 'Fixed by admin' }) });
		assert.equal(res.status, 200);
	});

	test('only http(s) links and sensible values are accepted', async () => {
		const bad = async (extra) => (await post('me', { courseId: mine, ...link(extra) })).body.error;
		assert.equal(await bad({ url: 'javascript:alert(1)' }), 'invalid_url');
		assert.equal(await bad({ url: 'data:text/html,hi' }), 'invalid_url');
		assert.equal(await bad({ url: 'not a link' }), 'invalid_url');
		assert.equal(await bad({ kind: 'video' }), 'invalid_kind');
		assert.equal(await bad({ title: '   ' }), 'invalid_title');
		assert.equal(await bad({ title: 'x'.repeat(201) }), 'invalid_title');
		assert.equal(await bad({ visibleFrom: 'next tuesday' }), 'invalid_date');
		assert.equal((await post('me', { courseId: 'abc', ...link() })).status, 404);
	});
});
