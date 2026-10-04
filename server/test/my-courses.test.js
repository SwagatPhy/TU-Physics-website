import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser } from './helpers.js';
import { toDbTime } from '../src/db.js';

describe('GET /my-courses', () => {
	let app, studentA, studentB;

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		const faculty = await addUser(db, { email: 'prof@example.test', role: 'faculty' });
		studentA = await addUser(db, { email: 'a@example.test' });
		studentB = await addUser(db, { email: 'b@example.test' });
		await addUser(db, { email: 'nothing@example.test' });
		await addUser(db, { email: 'newbie@example.test', mustChange: 1 });

		const now = toDbTime(new Date());
		const course = (code, active = 1) =>
			Number(
				db
					.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, ?)')
					.run(code, `${code} title`, 'TRIAL', faculty, active).lastInsertRowid,
			);
		const link = (courseId, title, url, visibleFrom = null) =>
			db
				.prepare('INSERT INTO resources (course_id, kind, title, url, visible_from, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
				.run(courseId, 'notes', title, url, visibleFrom, faculty, now);

		const onlyA = course('A-ONLY');
		const onlyB = course('B-ONLY');
		const shared = course('SHARED');
		const retired = course('RETIRED', 0);

		link(onlyA, 'A notes', 'https://example.com/a-notes');
		link(onlyB, 'B notes', 'https://example.com/b-notes-SECRET');
		link(shared, 'Shared notes', 'https://example.com/shared');
		link(shared, 'Not yet', 'https://example.com/future', toDbTime(new Date(Date.now() + 86400000)));
		link(shared, 'Bad link', 'javascript:alert(1)');
		link(retired, 'Old notes', 'https://example.com/old');

		const enroll = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)');
		enroll.run(studentA, onlyA);
		enroll.run(studentA, shared);
		enroll.run(studentA, retired);
		enroll.run(studentB, onlyB);
		enroll.run(studentB, shared);
	});
	after(() => app.close());

	async function myCourses(email) {
		const browser = client(app.baseUrl);
		await browser.login(email);
		return browser.request('/my-courses');
	}

	test('student A gets only their own courses — never student B’s', async () => {
		const res = await myCourses('a@example.test');
		assert.equal(res.status, 200);
		assert.deepEqual(res.body.courses.map((c) => c.code), ['A-ONLY', 'SHARED']);
		const everything = JSON.stringify(res.body);
		assert.ok(!everything.includes('B-ONLY'));
		assert.ok(!everything.includes('b-notes-SECRET'));
	});

	test('student B gets only their own courses — never student A’s', async () => {
		const res = await myCourses('b@example.test');
		assert.deepEqual(res.body.courses.map((c) => c.code), ['B-ONLY', 'SHARED']);
		assert.ok(!JSON.stringify(res.body).includes('a-notes'));
	});

	test('inactive courses, links not yet visible, and non-web links are left out', async () => {
		const res = await myCourses('a@example.test');
		const shared = res.body.courses.find((c) => c.code === 'SHARED');
		assert.deepEqual(shared.resources.map((r) => r.title), ['Shared notes']);
		assert.ok(!JSON.stringify(res.body).includes('RETIRED'));
		assert.ok(!JSON.stringify(res.body).includes('javascript:'));
	});

	test('a student with no enrollments gets an empty list', async () => {
		assert.deepEqual((await myCourses('nothing@example.test')).body, { courses: [] });
	});

	test('logged-out users, faculty and pending password changes are refused', async () => {
		assert.equal((await client(app.baseUrl).request('/my-courses')).status, 401);
		assert.deepEqual((await myCourses('prof@example.test')).body, { error: 'students_only' });
		const pending = await myCourses('newbie@example.test');
		assert.equal(pending.status, 403);
		assert.deepEqual(pending.body, { error: 'password_change_required' });
	});
});
