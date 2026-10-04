import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { startTestServer, client, addUser, PASSWORD } from './helpers.js';
import { toDbTime } from '../src/db.js';
import { requirePasswordChanged } from '../src/auth.js';

describe('login, session cookie, /me, logout', () => {
	let app;
	before(async () => {
		app = await startTestServer();
		await addUser(app.db, { name: 'Ann Student', email: 'ann@example.test' });
		await addUser(app.db, { email: 'gone@example.test', active: 0 });
	});
	after(() => app.close());

	test('health check answers', async () => {
		const res = await client(app.baseUrl).request('/health');
		assert.equal(res.status, 200);
		assert.deepEqual(res.body, { status: 'ok' });
	});

	test('correct login returns the user and a locked-down session cookie', async () => {
		const browser = client(app.baseUrl);
		const res = await browser.login('ANN@example.test '); // case and spaces don't matter
		assert.equal(res.status, 200);
		assert.deepEqual(res.body.user, {
			id: res.body.user.id,
			name: 'Ann Student',
			email: 'ann@example.test',
			role: 'student',
			mustChangePassword: false,
		});
		assert.match(res.setCookie, /^dphy_session=[\w-]{43};/);
		for (const flag of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/dphy']) {
			assert.ok(res.setCookie.includes(flag), `cookie should have ${flag}`);
		}

		const me = await browser.request('/me');
		assert.equal(me.status, 200);
		assert.equal(me.body.user.email, 'ann@example.test');
		assert.equal(me.body.user.password_hash, undefined);
	});

	test('the database stores only a hash of the session token', async () => {
		const browser = client(app.baseUrl);
		await browser.login('ann@example.test');
		const token = browser.cookie.split('=')[1];
		const hashed = createHash('sha256').update(token).digest('hex');
		assert.ok(app.db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(hashed));
		assert.equal(app.db.prepare('SELECT 1 FROM sessions WHERE id = ?').get(token), undefined);
	});

	test('wrong password, unknown email and inactive account all get the same answer', async () => {
		const browser = client(app.baseUrl);
		for (const [email, password] of [
			['ann@example.test', 'wrong-password-1'],
			['nobody@example.test', PASSWORD],
			['gone@example.test', PASSWORD],
		]) {
			const res = await browser.login(email, password);
			assert.equal(res.status, 401);
			assert.deepEqual(res.body, { error: 'invalid_credentials' });
			assert.equal(res.setCookie, null);
		}
	});

	test('/me without a valid session is refused', async () => {
		const browser = client(app.baseUrl);
		assert.equal((await browser.request('/me')).status, 401);
		browser.cookie = 'dphy_session=made-up-token';
		const res = await browser.request('/me');
		assert.equal(res.status, 401);
		assert.deepEqual(res.body, { error: 'not_logged_in' });
	});

	test('logout ends the session and clears the cookie', async () => {
		const browser = client(app.baseUrl);
		await browser.login('ann@example.test');
		const oldCookie = browser.cookie;

		const res = await browser.request('/logout', { method: 'POST' });
		assert.equal(res.status, 204);
		assert.match(res.setCookie, /^dphy_session=;.*Max-Age=0/);

		browser.cookie = oldCookie; // even if a copy of the old cookie is replayed
		assert.equal((await browser.request('/me')).status, 401);
	});

	test('logging in again replaces the session you had before', async () => {
		const browser = client(app.baseUrl);
		await browser.login('ann@example.test');
		const first = browser.cookie;
		await browser.login('ann@example.test');
		browser.cookie = first;
		assert.equal((await browser.request('/me')).status, 401);
	});

	test('deactivating a user ends their existing sessions', async () => {
		const id = await addUser(app.db, { email: 'leaver@example.test' });
		const browser = client(app.baseUrl);
		await browser.login('leaver@example.test');
		assert.equal((await browser.request('/me')).status, 200);

		app.db.prepare('UPDATE users SET active = 0 WHERE id = ?').run(id);
		assert.equal((await browser.request('/me')).status, 401);
		assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(id).n, 0);
	});

	test('successful and failed logins are written to the audit log', async () => {
		const actions = app.db.prepare('SELECT action FROM audit_log').all().map((row) => row.action);
		assert.ok(actions.includes('login'));
		assert.ok(actions.includes('login_failed'));
		assert.ok(actions.includes('logout'));
	});
});

describe('session time limits', () => {
	let app, userId;
	before(async () => {
		app = await startTestServer();
		userId = await addUser(app.db, { email: 'tim@example.test' });
	});
	after(() => app.close());

	const hoursAgo = (hours) => toDbTime(new Date(Date.now() - hours * 60 * 60 * 1000));

	test('a session unused for longer than the idle limit (8 h) expires', async () => {
		const browser = client(app.baseUrl);
		await browser.login('tim@example.test');
		app.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE user_id = ?').run(hoursAgo(9), userId);
		assert.equal((await browser.request('/me')).status, 401);
		assert.equal(app.db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE user_id = ?').get(userId).n, 0);
	});

	test('a session past its absolute limit (7 days) expires even if in use', async () => {
		const browser = client(app.baseUrl);
		await browser.login('tim@example.test');
		app.db.prepare('UPDATE sessions SET expires_at = ? WHERE user_id = ?').run(hoursAgo(1), userId);
		assert.equal((await browser.request('/me')).status, 401);
	});

	test('using a session moves its idle deadline forward', async () => {
		const browser = client(app.baseUrl);
		await browser.login('tim@example.test');
		app.db.prepare('UPDATE sessions SET last_seen_at = ? WHERE user_id = ?').run(hoursAgo(7), userId);
		assert.equal((await browser.request('/me')).status, 200); // 7 h: still fine, and refreshed
		const { last_seen_at } = app.db.prepare('SELECT last_seen_at FROM sessions WHERE user_id = ?').get(userId);
		assert.ok(Date.now() - new Date(`${last_seen_at.replace(' ', 'T')}Z`).getTime() < 60 * 1000);
	});
});

describe('first-login password change', () => {
	let app;
	before(async () => {
		app = await startTestServer();
		await addUser(app.db, { email: 'new@example.test', mustChange: 1 });
	});
	after(() => app.close());

	test('a new account is flagged as needing a password change', async () => {
		const browser = client(app.baseUrl);
		const res = await browser.login('new@example.test');
		assert.equal(res.body.user.mustChangePassword, true);
		assert.equal((await browser.request('/me')).body.user.mustChangePassword, true);
	});

	test('portal endpoints refuse a user who still has to change their password', () => {
		let status, body, nextCalled = false;
		const res = { status(code) { status = code; return this; }, json(data) { body = data; } };
		requirePasswordChanged({ user: { mustChangePassword: true } }, res, () => (nextCalled = true));
		assert.equal(status, 403);
		assert.deepEqual(body, { error: 'password_change_required' });
		assert.equal(nextCalled, false);

		requirePasswordChanged({ user: { mustChangePassword: false } }, res, () => (nextCalled = true));
		assert.equal(nextCalled, true);
	});

	test('bad change-password requests are rejected with a reason code', async () => {
		const browser = client(app.baseUrl);
		await browser.login('new@example.test');
		const attempt = (currentPassword, newPassword) =>
			browser.request('/change-password', { method: 'POST', body: { currentPassword, newPassword } });

		assert.deepEqual((await attempt('not-my-password', 'brand-new-password')).body, { error: 'wrong_current_password' });
		assert.deepEqual((await attempt(PASSWORD, 'short')).body, { error: 'password_too_short' });
		assert.deepEqual((await attempt(PASSWORD, 'x'.repeat(201))).body, { error: 'password_too_long' });
		assert.deepEqual((await attempt(PASSWORD, PASSWORD)).body, { error: 'password_unchanged' });
		assert.equal((await browser.request('/change-password', { method: 'POST', body: {} })).status, 400);
	});

	test('changing the password clears the flag, ends other sessions and keeps you logged in', async () => {
		const laptop = client(app.baseUrl);
		const phone = client(app.baseUrl);
		await laptop.login('new@example.test');
		await phone.login('new@example.test');
		const oldLaptopCookie = laptop.cookie;

		const res = await laptop.request('/change-password', {
			method: 'POST',
			body: { currentPassword: PASSWORD, newPassword: 'my-new-long-password' },
		});
		assert.equal(res.status, 200);
		assert.equal(res.body.user.mustChangePassword, false);
		assert.notEqual(laptop.cookie, oldLaptopCookie); // fresh session issued

		assert.equal((await laptop.request('/me')).body.user.mustChangePassword, false);
		assert.equal((await phone.request('/me')).status, 401);

		const fresh = client(app.baseUrl);
		assert.equal((await fresh.login('new@example.test', PASSWORD)).status, 401);
		assert.equal((await fresh.login('new@example.test', 'my-new-long-password')).status, 200);

		const actions = app.db.prepare('SELECT action FROM audit_log').all().map((row) => row.action);
		assert.ok(actions.includes('password_changed'));
	});
});

describe('login rate limiting', () => {
	let app;
	before(async () => {
		app = await startTestServer({ limiterOptions: { maxAttemptsPerIp: 12 } });
		await addUser(app.db, { email: 'target@example.test' });
	});
	after(() => app.close());

	test('5 wrong passwords lock the account for 15 minutes, even for the right password', async () => {
		const browser = client(app.baseUrl);
		for (let i = 0; i < 5; i++) assert.equal((await browser.login('target@example.test', 'guess-number-' + i)).status, 401);

		const locked = await browser.login('target@example.test');
		assert.equal(locked.status, 429);
		assert.equal(locked.body.error, 'too_many_attempts');
		assert.ok(Number(locked.headers.get('retry-after')) > 0);

		app.clock.now += 15 * 60 * 1000 + 1000;
		assert.equal((await browser.login('target@example.test')).status, 200);
	});

	test('too many attempts from one IP address are slowed down, whichever accounts they target', async () => {
		app.clock.now += 60 * 60 * 1000; // start a fresh window
		const browser = client(app.baseUrl);
		for (let i = 0; i < 12; i++) assert.equal((await browser.login(`user${i}@example.test`, 'some-password')).status, 401);
		assert.equal((await browser.login('another@example.test', 'some-password')).status, 429);
	});
});

describe('request checks', () => {
	let app;
	before(async () => {
		app = await startTestServer();
	});
	after(() => app.close());

	test('state-changing requests must be JSON (blocks cross-site form posts)', async () => {
		const res = await fetch(`${app.baseUrl}/login`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
			body: 'email=a%40example.test&password=whatever-123',
		});
		assert.equal(res.status, 415);
		const empty = await fetch(`${app.baseUrl}/logout`, { method: 'POST' });
		assert.equal(empty.status, 415);
	});

	test('broken JSON and missing fields get 400, never a crash', async () => {
		const browser = client(app.baseUrl);
		assert.deepEqual((await browser.request('/login', { method: 'POST', body: '{"email":' })).body, { error: 'invalid_json' });
		assert.deepEqual((await browser.request('/login', { method: 'POST', body: { email: 'x@example.test' } })).body, {
			error: 'invalid_input',
		});
		assert.equal((await browser.request('/login', { method: 'POST', body: { email: ['x'], password: 1 } })).status, 400);
	});

	test('responses carry security headers and no framework banner', async () => {
		const res = await fetch(`${app.baseUrl}/health`);
		assert.equal(res.headers.get('x-content-type-options'), 'nosniff');
		assert.equal(res.headers.get('cache-control'), 'no-store');
		assert.ok(res.headers.get('content-security-policy').includes("frame-ancestors 'none'"));
		assert.equal(res.headers.get('x-powered-by'), null);
	});

	test('unknown API paths return JSON 404', async () => {
		const res = await client(app.baseUrl).request('/nope');
		assert.equal(res.status, 404);
		assert.deepEqual(res.body, { error: 'not_found' });
	});
});
