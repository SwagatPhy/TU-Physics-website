import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser, addOffering, enrol } from './helpers.js';
import { toDbTime } from '../src/db.js';

describe('GET /my-courses', () => {
	let app;

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		const faculty = await addUser(db, { email: 'prof@example.test', role: 'faculty' });
		const studentA = await addUser(db, { email: 'a@example.test' });
		const studentB = await addUser(db, { email: 'b@example.test' });
		await addUser(db, { email: 'nothing@example.test' });
		await addUser(db, { email: 'newbie@example.test', mustChange: 1 });
		const removed = await addUser(db, { email: 'removed@example.test' });

		const now = toDbTime(new Date());
		const link = (offeringId, title, url, visibleFrom = null) =>
			db
				.prepare('INSERT INTO resources (offering_id, kind, title, url, visible_from, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)')
				.run(offeringId, 'notes', title, url, visibleFrom, faculty, now);

		const onlyA = addOffering(db, { code: 'A-ONLY', teacherId: faculty });
		const onlyB = addOffering(db, { code: 'B-ONLY', teacherId: faculty });
		const shared = addOffering(db, { code: 'SHARED', teacherId: faculty });
		const pastOpen = addOffering(db, { code: 'PAST-OPEN', teacherId: faculty, semester: 'Autumn 2025', status: 'finished' });
		const pastHidden = addOffering(db, { code: 'PAST-HIDDEN', teacherId: faculty, semester: 'Autumn 2025', status: 'finished', contentHidden: true });

		link(onlyA, 'A notes', 'https://example.com/a-notes');
		link(onlyB, 'B notes', 'https://example.com/b-notes-SECRET');
		link(shared, 'Shared notes', 'https://example.com/shared');
		link(shared, 'Not yet', 'https://example.com/future', toDbTime(new Date(Date.now() + 86400000)));
		link(shared, 'Bad link', 'javascript:alert(1)');
		link(pastOpen, 'Old notes', 'https://example.com/old');
		link(pastHidden, 'Hidden notes', 'https://example.com/hidden-SECRET');

		for (const offering of [onlyA, shared, pastOpen, pastHidden]) enrol(db, offering, studentA);
		for (const offering of [onlyB, shared]) enrol(db, offering, studentB);
		enrol(db, shared, removed);
		db.prepare('UPDATE enrollments SET removed = 1 WHERE user_id = ?').run(removed);
	});
	after(() => app.close());

	async function myCourses(email) {
		const browser = client(app.baseUrl);
		await browser.login(email);
		return browser.request('/my-courses');
	}

	test('student A gets only their own offerings — never student B’s', async () => {
		const res = await myCourses('a@example.test');
		assert.equal(res.status, 200);
		assert.deepEqual(res.body.current.map((c) => c.code), ['A-ONLY', 'SHARED']);
		const everything = JSON.stringify(res.body);
		assert.ok(!everything.includes('B-ONLY'));
		assert.ok(!everything.includes('b-notes-SECRET'));
	});

	test('student B gets only their own offerings — never student A’s', async () => {
		const res = await myCourses('b@example.test');
		assert.deepEqual(res.body.current.map((c) => c.code), ['B-ONLY', 'SHARED']);
		assert.deepEqual(res.body.past, []);
		assert.ok(!JSON.stringify(res.body).includes('a-notes'));
	});

	test('links not yet visible and non-web links are left out', async () => {
		const shared = (await myCourses('a@example.test')).body.current.find((c) => c.code === 'SHARED');
		assert.deepEqual(shared.resources.map((r) => r.title), ['Shared notes']);
		assert.ok(!JSON.stringify(shared).includes('javascript:'));
	});

	test('finished offerings are past courses; hidden content is not sent at all', async () => {
		const { past } = (await myCourses('a@example.test')).body;
		assert.deepEqual(
			past.map((c) => [c.code, c.contentHidden, c.resources.map((r) => r.title)]),
			[
				['PAST-HIDDEN', true, []],
				['PAST-OPEN', false, ['Old notes']],
			],
		);
		assert.ok(!JSON.stringify(past).includes('hidden-SECRET'));
	});

	test('a student removed from an offering no longer sees it', async () => {
		assert.deepEqual((await myCourses('removed@example.test')).body, { current: [], past: [] });
	});

	test('a student with no enrolments gets empty lists', async () => {
		assert.deepEqual((await myCourses('nothing@example.test')).body, { current: [], past: [] });
	});

	test('logged-out users, faculty and pending password changes are refused', async () => {
		assert.equal((await client(app.baseUrl).request('/my-courses')).status, 401);
		assert.deepEqual((await myCourses('prof@example.test')).body, { error: 'students_only' });
		const pending = await myCourses('newbie@example.test');
		assert.equal(pending.status, 403);
		assert.deepEqual(pending.body, { error: 'password_change_required' });
	});
});
