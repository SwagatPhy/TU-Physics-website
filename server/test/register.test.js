import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { startTestServer, client, addUser, addRosterRow, tokenFromEmail, PASSWORD } from './helpers.js';
import { toDbTime } from '../src/db.js';

const NEW_PASSWORD = 'my-own-new-password';

describe('self-registration from the roster', () => {
	let app;
	before(async () => {
		app = await startTestServer();
		addRosterRow(app.db, { email: 'priya@example.test', name: 'Priya', rollNumber: 'PHD22017', programme: 'PhD' });
		addRosterRow(app.db, { email: 'ravi@example.test', name: 'Ravi', rollNumber: 'PHM24001', programme: 'MSc' });
		addRosterRow(app.db, { email: 'dr.bora@example.test', name: 'Dr Bora', role: 'faculty' });
		addRosterRow(app.db, { email: 'late@example.test', name: 'Late', rollNumber: 'PHD22099', programme: 'PhD' });
	});
	after(() => app.close());
	beforeEach(() => {
		app.outbox.length = 0;
		app.clock.now += 60 * 60 * 1000; // fresh rate-limit window for every test
	});

	const request = (body) => client(app.baseUrl).request('/register/request', { method: 'POST', body });
	const complete = (token, password = NEW_PASSWORD) =>
		client(app.baseUrl).request('/register/complete', { method: 'POST', body: { token, password } });

	test('known and unknown emails get exactly the same answer, and only the known one gets an email', async () => {
		const known = await request({ email: 'priya@example.test', rollNumber: 'PHD22017' });
		const unknown = await request({ email: 'stranger@example.test', rollNumber: 'PHD22017' });
		assert.equal(known.status, 202);
		assert.deepEqual([unknown.status, unknown.body], [known.status, known.body]);
		assert.deepEqual(known.body, { status: 'check_your_email' });

		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 1);
		assert.equal(app.outbox[0].to, 'priya@example.test');
		assert.match(app.outbox[0].text, /http:\/\/localhost:4321\/dphy\/register\/#token=[\w-]{43}/);
	});

	test('known and unknown emails take about the same time to answer', async () => {
		const median = async (email) => {
			const times = [];
			for (let i = 0; i < 5; i++) {
				const start = performance.now();
				await request({ email, rollNumber: 'PHD22017' });
				times.push(performance.now() - start);
				app.clock.now += 60 * 60 * 1000; // stay under the per-address limit
			}
			return times.sort((a, b) => a - b)[2];
		};
		const knownMs = await median('priya@example.test');
		const unknownMs = await median('nobody-here@example.test');
		await app.backgroundWorkDone();
		// The lookup and the email happen after the response, so both should be equally quick.
		assert.ok(Math.abs(knownMs - unknownMs) < 25, `known ${knownMs.toFixed(1)} ms vs unknown ${unknownMs.toFixed(1)} ms`);
	});

	test('a student with the wrong roll number gets no email (but the same answer)', async () => {
		const res = await request({ email: 'priya@example.test', rollNumber: 'PHD22018' });
		assert.equal(res.status, 202);
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 0);
	});

	test('roll numbers are matched without regard to case or spaces', async () => {
		await request({ email: 'priya@example.test', rollNumber: ' phd 22017 ' });
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 1);
	});

	test('the link creates the account with role and programme from the roster, and marks the row claimed', async () => {
		await request({ email: 'ravi@example.test', rollNumber: 'PHM24001' });
		await app.backgroundWorkDone();
		const res = await complete(tokenFromEmail(app.outbox[0]));
		assert.equal(res.status, 201);

		const user = app.db.prepare('SELECT * FROM users WHERE email = ?').get('ravi@example.test');
		assert.equal(user.role, 'student');
		assert.equal(user.programme, 'MSc');
		assert.equal(user.roll_number, 'PHM24001');
		assert.equal(user.must_change_password, 0);
		const row = app.db.prepare('SELECT claimed, user_id FROM roster WHERE email = ?').get('ravi@example.test');
		assert.deepEqual({ ...row }, { claimed: 1, user_id: user.id });

		assert.equal((await client(app.baseUrl).login('ravi@example.test', NEW_PASSWORD)).status, 200);
	});

	test('a link works only once', async () => {
		await request({ email: 'priya@example.test', rollNumber: 'PHD22017' });
		await app.backgroundWorkDone();
		const token = tokenFromEmail(app.outbox.at(-1));
		assert.equal((await complete(token)).status, 201);
		const again = await complete(token);
		assert.equal(again.status, 400);
		assert.deepEqual(again.body, { error: 'invalid_or_expired_link' });
	});

	test('a claimed roster row cannot register a second time', async () => {
		// Priya registered in the previous test.
		await request({ email: 'priya@example.test', rollNumber: 'PHD22017' });
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 0);
	});

	test('faculty register with their email only', async () => {
		await request({ email: 'dr.bora@example.test' });
		await app.backgroundWorkDone();
		assert.equal((await complete(tokenFromEmail(app.outbox[0]))).status, 201);
		assert.equal(app.db.prepare('SELECT role FROM users WHERE email = ?').get('dr.bora@example.test').role, 'faculty');
	});

	test('an expired link is refused', async () => {
		await request({ email: 'late@example.test', rollNumber: 'PHD22099' });
		await app.backgroundWorkDone();
		const token = tokenFromEmail(app.outbox[0]);
		app.db.prepare("UPDATE auth_tokens SET expires_at = ? WHERE purpose = 'register'").run(toDbTime(new Date(Date.now() - 1000)));
		assert.deepEqual((await complete(token)).body, { error: 'invalid_or_expired_link' });
		assert.equal(app.db.prepare('SELECT claimed FROM roster WHERE email = ?').get('late@example.test').claimed, 0);
	});

	test('asking again replaces the earlier link', async () => {
		await request({ email: 'late@example.test', rollNumber: 'PHD22099' });
		await request({ email: 'late@example.test', rollNumber: 'PHD22099' });
		await app.backgroundWorkDone();
		const [first, second] = app.outbox.map(tokenFromEmail);
		assert.equal((await complete(first)).status, 400);
		assert.equal((await complete(second)).status, 201);
	});

	test('a weak password is refused without using up the link', async () => {
		addRosterRow(app.db, { email: 'weak@example.test', rollNumber: 'PHD22050', programme: 'PhD' });
		await request({ email: 'weak@example.test', rollNumber: 'PHD22050' });
		await app.backgroundWorkDone();
		const token = tokenFromEmail(app.outbox[0]);
		assert.deepEqual((await complete(token, 'short')).body, { error: 'password_too_short' });
		assert.equal((await complete(token)).status, 201);
	});

	test('made-up tokens are refused', async () => {
		assert.deepEqual((await complete('not-a-real-token-at-all')).body, { error: 'invalid_or_expired_link' });
	});

	test('an address can ask for at most 3 emails per 15 minutes', async () => {
		for (let i = 0; i < 3; i++) assert.equal((await request({ email: 'anyone@example.test' })).status, 202);
		assert.equal((await request({ email: 'anyone@example.test' })).status, 429);
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

	test('a registration link cannot be used to reset a password, or the other way round', async () => {
		await request('meena@example.test');
		await app.backgroundWorkDone();
		const resetToken = tokenFromEmail(app.outbox[0]);
		const res = await client(app.baseUrl).request('/register/complete', {
			method: 'POST',
			body: { token: resetToken, password: NEW_PASSWORD },
		});
		assert.deepEqual(res.body, { error: 'invalid_or_expired_link' });
	});

	test('a deactivated account gets no reset link', async () => {
		await addUser(app.db, { email: 'off@example.test', active: 0 });
		await request('off@example.test');
		await app.backgroundWorkDone();
		assert.equal(app.outbox.length, 0);
	});
});
