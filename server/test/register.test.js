import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser, addRosterRow, addOffering, tokenFromEmail, PASSWORD } from './helpers.js';
import { toDbTime } from '../src/db.js';

const NEW_PASSWORD = 'my-own-new-password';

const student = (extra = {}) => ({
	kind: 'student',
	name: 'Priya Das',
	email: 'priya@example.test',
	rollNumber: 'PHP22017',
	phone: '+91 98765 43210',
	...extra,
});

describe('sign-up', () => {
	let app;
	before(async () => {
		app = await startTestServer();
		await addUser(app.db, { name: 'Existing Person', email: 'taken@example.test', rollNumber: 'PHP20001', programme: 'PhD' });
		addRosterRow(app.db, { email: 'listed@example.test', name: 'On Roster', rollNumber: 'PHM24001', programme: 'MSc' });
	});
	after(() => app.close());
	beforeEach(() => {
		app.outbox.length = 0;
		app.clock.now += 60 * 60 * 1000; // fresh rate-limit window for every test
	});

	const request = (body) => client(app.baseUrl).request('/register/request', { method: 'POST', body });
	const complete = (token, password = NEW_PASSWORD) =>
		client(app.baseUrl).request('/register/complete', { method: 'POST', body: { token, password } });
	const signUp = async (body) => {
		await request(body);
		await app.backgroundWorkDone();
		return tokenFromEmail(app.outbox.at(-1));
	};
	const user = (email) => app.db.prepare('SELECT * FROM users WHERE email = ?').get(email);

	test('badly typed details are refused straight away, with a reason', async () => {
		assert.deepEqual((await request(student({ rollNumber: 'XYZ123' }))).body, { error: 'invalid_roll_number' });
		assert.deepEqual((await request(student({ rollNumber: undefined }))).body, { error: 'invalid_roll_number' });
		assert.deepEqual((await request(student({ phone: 'call me' }))).body, { error: 'invalid_phone' });
		assert.deepEqual((await request(student({ phone: undefined }))).body, { error: 'invalid_phone' });
		assert.deepEqual((await request(student({ name: '  ' }))).body, { error: 'invalid_name' });
		assert.deepEqual((await request(student({ email: 'nope' }))).body, { error: 'invalid_email' });
		assert.deepEqual((await request(student({ kind: 'admin' }))).body, { error: 'invalid_kind' });
	});

	test('a new student verifies their email, sets a password and waits for approval', async () => {
		const res = await request(student());
		assert.equal(res.status, 202);
		assert.deepEqual(res.body, { status: 'check_your_email' });
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 1);
		assert.match(app.outbox[0].text, /\/dphy\/register\/#token=[\w-]{43}/);
		assert.equal(user('priya@example.test'), undefined, 'no account before the email is verified');

		const done = await complete(tokenFromEmail(app.outbox[0]));
		assert.deepEqual(done.body, { status: 'registered', approval: 'pending' });
		const created = user('priya@example.test');
		assert.deepEqual(
			[created.role, created.status, created.roll_number, created.programme, created.batch_year, created.phone, created.name],
			['student', 'pending', 'PHP22017', 'PhD', 2022, '+91 98765 43210', 'Priya Das'],
		);

		// Pending: can log in and see themselves, nothing else.
		const browser = client(app.baseUrl);
		assert.equal((await browser.login('priya@example.test', NEW_PASSWORD)).body.user.status, 'pending');
		assert.equal((await browser.request('/me')).status, 200);
		assert.deepEqual((await browser.request('/my-courses')).body, { error: 'approval_pending' });
	});

	test('an existing email gets exactly the same answer, and only a note to that inbox', async () => {
		const res = await request(student({ email: 'taken@example.test', rollNumber: 'PHP22030' }));
		assert.deepEqual([res.status, res.body], [202, { status: 'check_your_email' }]);
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 1);
		assert.equal(app.outbox[0].to, 'taken@example.test');
		assert.equal(tokenFromEmail(app.outbox[0]), undefined, 'no registration link');
		assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM signups WHERE email = ?').get('taken@example.test').n, 0);
	});

	test('a roll number that already has an account gets the same answer and no link', async () => {
		const res = await request(student({ email: 'copycat@example.test', rollNumber: ' php20001 ' }));
		assert.deepEqual([res.status, res.body], [202, { status: 'check_your_email' }]);
		await app.backgroundWorkDone();
		assert.equal(tokenFromEmail(app.outbox[0]), undefined);
		assert.equal(user('copycat@example.test'), undefined);
	});

	test('new, existing and duplicate-roll requests take about the same time', async () => {
		const median = async (body) => {
			const times = [];
			for (let i = 0; i < 5; i++) {
				const start = performance.now();
				await request(body);
				times.push(performance.now() - start);
				app.clock.now += 60 * 60 * 1000;
			}
			return times.sort((a, b) => a - b)[2];
		};
		const fresh = await median(student({ email: 'timing-new@example.test', rollNumber: 'PHP22040' }));
		const existing = await median(student({ email: 'taken@example.test', rollNumber: 'PHP22041' }));
		const duplicateRoll = await median(student({ email: 'timing-dup@example.test', rollNumber: 'PHP20001' }));
		await app.backgroundWorkDone();
		for (const [label, ms] of [['existing', existing], ['duplicate roll', duplicateRoll]]) {
			assert.ok(Math.abs(fresh - ms) < 25, `new ${fresh.toFixed(1)} ms vs ${label} ${ms.toFixed(1)} ms`);
		}
	});

	test('a student matching an unclaimed roster row is approved straight away', async () => {
		const batchOffering = addOffering(app.db, { code: 'PHY 101', programme: 'MSc', batchYear: 2024 });
		const token = await signUp(student({ name: 'Rosa', email: 'LISTED@example.test', rollNumber: 'PHM24001' }));
		assert.deepEqual((await complete(token)).body, { status: 'registered', approval: 'approved' });
		const created = user('listed@example.test');
		assert.equal(created.status, 'approved');
		const row = app.db.prepare('SELECT claimed, user_id FROM roster WHERE email = ?').get('listed@example.test');
		assert.deepEqual({ ...row }, { claimed: 1, user_id: created.id });
		// Approved at once, so already in their batch's offering (MSc 2024).
		assert.ok(app.db.prepare('SELECT 1 FROM enrollments WHERE offering_id = ? AND user_id = ?').get(batchOffering, created.id));
	});

	test('a roster email with a different roll number is not auto-approved', async () => {
		addRosterRow(app.db, { email: 'half@example.test', rollNumber: 'PHP22050', programme: 'PhD' });
		const token = await signUp(student({ email: 'half@example.test', rollNumber: 'PHP22051' }));
		assert.equal((await complete(token)).body.approval, 'pending');
		assert.equal(app.db.prepare('SELECT claimed FROM roster WHERE email = ?').get('half@example.test').claimed, 0);
	});

	test('department members sign up without a roll number and always wait for approval', async () => {
		addRosterRow(app.db, { email: 'dr.bora@example.test', role: 'faculty' }); // even if on the roster
		const token = await signUp({ kind: 'member', name: 'Dr Bora', email: 'dr.bora@example.test', phone: '03712 275000' });
		assert.deepEqual((await complete(token)).body, { status: 'registered', approval: 'pending' });
		const created = user('dr.bora@example.test');
		assert.deepEqual([created.role, created.status, created.roll_number], ['faculty', 'pending', null]);
	});

	test('a link works only once', async () => {
		const token = await signUp(student({ email: 'once@example.test', rollNumber: 'PHP22060' }));
		assert.equal((await complete(token)).status, 201);
		assert.deepEqual((await complete(token)).body, { error: 'invalid_or_expired_link' });
	});

	test('an expired link is refused and creates nothing', async () => {
		const token = await signUp(student({ email: 'late@example.test', rollNumber: 'PHP22070' }));
		app.db.prepare("UPDATE auth_tokens SET expires_at = ? WHERE purpose = 'register'").run(toDbTime(new Date(Date.now() - 1000)));
		assert.deepEqual((await complete(token)).body, { error: 'invalid_or_expired_link' });
		assert.equal(user('late@example.test'), undefined);
	});

	test('signing up again replaces the earlier link', async () => {
		const first = await signUp(student({ email: 'twice@example.test', rollNumber: 'PHP22080' }));
		const second = await signUp(student({ email: 'twice@example.test', rollNumber: 'PHP22080' }));
		assert.equal((await complete(first)).status, 400);
		assert.equal((await complete(second)).status, 201);
	});

	test('if someone else takes the roll number before the link is used, the link fails', async () => {
		const a = await signUp(student({ email: 'race-a@example.test', rollNumber: 'PHP22090' }));
		const b = await signUp(student({ email: 'race-b@example.test', rollNumber: 'PHP22090' }));
		assert.equal((await complete(a)).status, 201);
		assert.deepEqual((await complete(b)).body, { error: 'invalid_or_expired_link' });
		assert.equal(user('race-b@example.test'), undefined);
	});

	test('a weak password is refused without using up the link', async () => {
		const token = await signUp(student({ email: 'weak@example.test', rollNumber: 'PHP22100' }));
		assert.deepEqual((await complete(token, 'short')).body, { error: 'password_too_short' });
		assert.equal((await complete(token)).status, 201);
	});

	test('made-up tokens are refused', async () => {
		assert.deepEqual((await complete('not-a-real-token-at-all')).body, { error: 'invalid_or_expired_link' });
	});

	test('an address can ask for at most 3 emails per 15 minutes', async () => {
		const body = student({ email: 'anyone@example.test', rollNumber: 'PHP22110' });
		for (let i = 0; i < 3; i++) assert.equal((await request(body)).status, 202);
		assert.equal((await request(body)).status, 429);
	});
});

describe('forgot password', () => {
	let app;
	before(async () => {
		app = await startTestServer();
		await addUser(app.db, { name: 'Meena', email: 'meena@example.test' });
	});
	after(() => app.close());
	beforeEach(() => {
		app.outbox.length = 0;
		app.clock.now += 60 * 60 * 1000;
	});

	const request = (email) => client(app.baseUrl).request('/password-reset/request', { method: 'POST', body: { email } });
	const complete = (token, password = NEW_PASSWORD) =>
		client(app.baseUrl).request('/password-reset/complete', { method: 'POST', body: { token, password } });

	test('known and unknown emails get the same answer; only the known one gets a link', async () => {
		const known = await request('meena@example.test');
		const unknown = await request('who@example.test');
		assert.deepEqual([unknown.status, unknown.body], [known.status, known.body]);
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 1);
		assert.match(app.outbox[0].text, /\/dphy\/forgot-password\/#token=/);
	});

	test('resetting signs out every session, and only the new password works', async () => {
		const laptop = client(app.baseUrl);
		await laptop.login('meena@example.test', PASSWORD);
		assert.equal((await laptop.request('/me')).status, 200);

		await request('meena@example.test');
		await app.backgroundWorkDone();
		const token = tokenFromEmail(app.outbox[0]);
		assert.deepEqual((await complete(token)).body, { status: 'password_reset' });

		assert.equal((await laptop.request('/me')).status, 401);
		assert.equal((await client(app.baseUrl).login('meena@example.test', PASSWORD)).status, 401);
		assert.equal((await client(app.baseUrl).login('meena@example.test', NEW_PASSWORD)).status, 200);

		// …and the link can't be used again
		assert.deepEqual((await complete(token, 'yet-another-password')).body, { error: 'invalid_or_expired_link' });
	});

	test('an expired reset link is refused', async () => {
		await request('meena@example.test');
		await app.backgroundWorkDone();
		app.db.prepare("UPDATE auth_tokens SET expires_at = ? WHERE purpose = 'reset'").run(toDbTime(new Date(Date.now() - 1000)));
		assert.deepEqual((await complete(tokenFromEmail(app.outbox[0]))).body, { error: 'invalid_or_expired_link' });
	});

	test('a reset link cannot be used to sign up', async () => {
		await request('meena@example.test');
		await app.backgroundWorkDone();
		const res = await client(app.baseUrl).request('/register/complete', {
			method: 'POST',
			body: { token: tokenFromEmail(app.outbox[0]), password: NEW_PASSWORD },
		});
		assert.deepEqual(res.body, { error: 'invalid_or_expired_link' });
	});

	test('deactivated and rejected accounts get no reset link', async () => {
		await addUser(app.db, { email: 'off@example.test', active: 0 });
		await addUser(app.db, { email: 'no@example.test', status: 'rejected' });
		await request('off@example.test');
		await request('no@example.test');
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 0);
	});
});
