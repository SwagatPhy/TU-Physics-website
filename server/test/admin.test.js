import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser } from './helpers.js';

describe('admin approval of sign-ups', () => {
	let app;
	const ids = {};
	const browsers = {};

	before(async () => {
		app = await startTestServer();
		const db = app.db;
		ids.admin = await addUser(db, { name: 'Admin', email: 'admin@example.test', role: 'admin' });
		ids.faculty = await addUser(db, { name: 'Prof', email: 'prof@example.test', role: 'faculty' });
		ids.student = await addUser(db, { name: 'Approved Student', email: 'ok@example.test', rollNumber: 'PHD21001', programme: 'PhD' });
		for (const [key, rollNumber] of [['p1', 'PHD23001'], ['p2', 'PHD23002'], ['p3', 'PHM24003'], ['p4', 'PHM24004'], ['p5', 'PHM24005']]) {
			ids[key] = await addUser(db, {
				name: `Pending ${key}`,
				email: `${key}@example.test`,
				status: 'pending',
				rollNumber,
				programme: rollNumber.startsWith('PHD') ? 'PhD' : 'MSc',
				phone: '98765 43210',
			});
		}
		ids.pendingMember = await addUser(db, { name: 'Pending Staff', email: 'staff@example.test', role: 'faculty', status: 'pending', phone: '03712 275000' });

		for (const key of ['admin', 'faculty', 'student', 'p1', 'p2', 'pendingMember']) {
			browsers[key] = client(app.baseUrl);
			const email = { admin: 'admin', faculty: 'prof', student: 'ok', pendingMember: 'staff' }[key] ?? key;
			await browsers[key].login(`${email}@example.test`);
		}
	});
	after(() => app.close());
	beforeEach(() => (app.outbox.length = 0));

	const decide = (userIds, decision, who = 'admin') =>
		browsers[who].request('/admin/decisions', { method: 'POST', body: { userIds, decision } });
	const statusOf = (id) => app.db.prepare('SELECT status FROM users WHERE id = ?').get(id).status;

	test('only admins can use the approval endpoints', async () => {
		for (const who of ['faculty', 'student', 'p1']) {
			const list = await browsers[who].request('/admin/signups');
			assert.equal(list.status, 403, `${who} listing`);
			assert.equal((await decide([ids.p3], 'approve', who)).status, 403, `${who} deciding`);
			const edit = await browsers[who].request(`/admin/users/${ids.p3}`, { method: 'PUT', body: { name: 'x' } });
			assert.equal(edit.status, 403, `${who} editing`);
		}
		assert.equal((await client(app.baseUrl).request('/admin/signups')).status, 401);
		assert.equal(statusOf(ids.p3), 'pending');
	});

	test('the admin sees every pending sign-up with its details', async () => {
		const res = await browsers.admin.request('/admin/signups');
		assert.equal(res.status, 200);
		assert.deepEqual(
			res.body.signups.map((s) => [s.name, s.rollNumber, s.programme, s.email, s.phone, s.role]),
			[
				['Pending p1', 'PHD23001', 'PhD', 'p1@example.test', '98765 43210', 'student'],
				['Pending p2', 'PHD23002', 'PhD', 'p2@example.test', '98765 43210', 'student'],
				['Pending p3', 'PHM24003', 'MSc', 'p3@example.test', '98765 43210', 'student'],
				['Pending p4', 'PHM24004', 'MSc', 'p4@example.test', '98765 43210', 'student'],
				['Pending p5', 'PHM24005', 'MSc', 'p5@example.test', '98765 43210', 'student'],
				['Pending Staff', null, null, 'staff@example.test', '03712 275000', 'faculty'],
			],
		);
		assert.ok(res.body.signups.every((s) => s.createdAt));
	});

	test('pending users can only see themselves, log out and edit their own name and phone', async () => {
		const pending = browsers.p2;
		assert.equal((await pending.request('/me')).body.user.status, 'pending');
		assert.deepEqual((await pending.request('/my-courses')).body, { error: 'approval_pending' });
		assert.deepEqual((await browsers.pendingMember.request('/teaching')).body, { error: 'approval_pending' });

		const changed = await pending.request('/profile', { method: 'PUT', body: { name: 'Pending p2 Fixed', phone: '+91 90000 00000' } });
		assert.equal(changed.status, 200);
		assert.equal(changed.body.user.name, 'Pending p2 Fixed');
		const row = app.db.prepare('SELECT name, phone, email, roll_number FROM users WHERE id = ?').get(ids.p2);
		assert.deepEqual({ ...row }, { name: 'Pending p2 Fixed', phone: '+91 90000 00000', email: 'p2@example.test', roll_number: 'PHD23002' });
		assert.deepEqual((await pending.request('/profile', { method: 'PUT', body: { name: 'x', phone: 'nope' } })).body, { error: 'invalid_phone' });
	});

	test('approving a pending student unlocks the portal and emails them', async () => {
		const res = await decide([ids.p1], 'approve');
		assert.deepEqual(res.body, { decision: 'approve', done: [ids.p1], skipped: [] });
		assert.equal(statusOf(ids.p1), 'approved');
		assert.deepEqual((await browsers.p1.request('/my-courses')).body, { courses: [] }); // same session, now allowed
		await app.backgroundWorkDone();
		assert.deepEqual(app.outbox.map((m) => m.to), ['p1@example.test']);
		assert.match(app.outbox[0].text, /\/dphy\/login\//);
	});

	test('the admin can correct a name and roll number before approving', async () => {
		const fix = await browsers.admin.request(`/admin/users/${ids.p3}`, { method: 'PUT', body: { name: 'Corrected Name', rollNumber: 'phd 23003' } });
		assert.equal(fix.status, 200);
		assert.deepEqual([fix.body.user.name, fix.body.user.rollNumber, fix.body.user.programme], ['Corrected Name', 'PHD23003', 'PhD']);

		const taken = await browsers.admin.request(`/admin/users/${ids.p3}`, { method: 'PUT', body: { name: 'Corrected Name', rollNumber: 'PHD21001' } });
		assert.deepEqual(taken.body, { error: 'roll_number_taken' });
		const badPrefix = await browsers.admin.request(`/admin/users/${ids.p3}`, { method: 'PUT', body: { name: 'Corrected Name', rollNumber: 'XYZ1' } });
		assert.deepEqual(badPrefix.body, { error: 'invalid_roll_number' });
		const admin = await browsers.admin.request(`/admin/users/${ids.admin}`, { method: 'PUT', body: { name: 'x' } });
		assert.deepEqual(admin.body, { error: 'user_not_found' });
	});

	test('bulk approval approves every pending one and skips the rest', async () => {
		const res = await decide([ids.p3, ids.p4, ids.student, 99999], 'approve');
		assert.deepEqual(res.body, { decision: 'approve', done: [ids.p3, ids.p4], skipped: [ids.student, 99999] });
		assert.equal(statusOf(ids.p3), 'approved');
		assert.equal(statusOf(ids.p4), 'approved');
		await app.backgroundWorkDone();
		assert.deepEqual(app.outbox.map((m) => m.to).sort(), ['p3@example.test', 'p4@example.test']);
	});

	test('rejecting ends their session, blocks login like a wrong password, and emails them', async () => {
		assert.equal((await browsers.p2.request('/me')).status, 200);
		assert.deepEqual((await decide([ids.p2], 'reject')).body.done, [ids.p2]);
		assert.equal(statusOf(ids.p2), 'rejected');
		assert.equal((await browsers.p2.request('/me')).status, 401);
		const login = await client(app.baseUrl).login('p2@example.test');
		assert.deepEqual([login.status, login.body], [401, { error: 'invalid_credentials' }]);
		await app.backgroundWorkDone();
		assert.deepEqual(app.outbox.map((m) => m.to), ['p2@example.test']);

		assert.deepEqual((await decide([ids.p2], 'approve')).body.skipped, [ids.p2], 'a decided account is not decided again');
	});

	test('a rejected account cannot use a session even if one survived (status checked on every request)', async () => {
		const id = await addUser(app.db, { email: 'later@example.test' });
		const browser = client(app.baseUrl);
		await browser.login('later@example.test');
		app.db.prepare("UPDATE users SET status = 'rejected' WHERE id = ?").run(id); // e.g. changed by a future admin tool
		assert.equal((await browser.request('/me')).status, 401);
	});

	test('every decision and edit is in the audit log', () => {
		const rows = app.db
			.prepare("SELECT action, target FROM audit_log WHERE actor_id = ? AND action LIKE 'user_%'")
			.all(ids.admin)
			.map((row) => `${row.action} ${row.target}`);
		for (const expected of [`user_approved user:${ids.p1}`, `user_edited user:${ids.p3}`, `user_approved user:${ids.p4}`, `user_rejected user:${ids.p2}`]) {
			assert.ok(rows.includes(expected), `missing "${expected}"`);
		}
	});

	test('bad decision requests are refused', async () => {
		assert.deepEqual((await decide([ids.p5], 'maybe')).body, { error: 'invalid_decision' });
		assert.deepEqual((await decide([], 'approve')).body, { error: 'invalid_input' });
		assert.deepEqual((await decide(['1'], 'approve')).body, { error: 'invalid_input' });
		assert.equal(statusOf(ids.p5), 'pending');
	});
});
