// Test helpers: a real app on a random local port, backed by an in-memory
// database, plus a tiny fetch wrapper that keeps track of the session cookie.

import { loadConfig } from '../src/config.js';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { createApp } from '../src/app.js';
import { createLoginLimiter } from '../src/rate-limit.js';
import { hashPassword } from '../src/auth.js';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const PASSWORD = 'test-password-123';

let passwordHash; // hashing is deliberately slow, so do it once
async function sharedHash() {
	passwordHash ??= await hashPassword(PASSWORD);
	return passwordHash;
}

export async function addUser(
	db,
	{ name = 'Someone', email, role = 'student', active = 1, mustChange = 0, status = 'approved', rollNumber = null, programme = null, phone = null },
) {
	return Number(
		db
			.prepare(
				`INSERT INTO users (name, email, password_hash, role, active, must_change_password, created_at, status, roll_number, programme, phone)
				 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
			)
			.run(name, email, await sharedHash(), role, active, mustChange, toDbTime(new Date()), status, rollNumber, programme, phone)
			.lastInsertRowid,
	);
}

// Starts an app. `clock` lets a test move time forward for the rate limiter.
// Uploaded files go to a fresh temporary folder, removed by close().
export async function startTestServer({ limiterOptions = {}, env = {} } = {}) {
	const testDir = mkdtempSync(join(tmpdir(), 'portal-uploads-'));
	// A dot-folder in the path on purpose: real server paths can have one, and
	// downloads must still work (they once failed under .claude/ worktrees).
	const uploadsDir = join(testDir, '.dot-folder', 'uploads');
	const config = loadConfig({ DATABASE_PATH: ':memory:', BASE_PATH: '/dphy', COOKIE_SECURE: 'true', UPLOADS_DIR: uploadsDir, ...env });
	const db = openDatabase(':memory:');
	migrate(db);

	const clock = { now: Date.now() };
	const loginLimiter = createLoginLimiter({ ...limiterOptions, now: () => clock.now });
	const linkRequestLimiter = createLoginLimiter({ maxFailuresPerAccount: 3, now: () => clock.now });
	const outbox = []; // emails "sent" during the test
	const mailer = { send: async (message) => outbox.push(message) };
	const app = createApp({ db, config, loginLimiter, linkRequestLimiter, mailer });

	const server = await new Promise((resolve) => {
		const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
	});
	const baseUrl = `http://127.0.0.1:${server.address().port}/dphy/api`;

	return {
		db,
		config,
		clock,
		baseUrl,
		outbox,
		// Waits for emails and other work that happens after a response is sent.
		backgroundWorkDone: app.locals.backgroundWorkDone,
		close: async () => {
			await new Promise((resolve) => server.close(resolve));
			rmSync(testDir, { recursive: true, force: true });
		},
	};
}

export function addRosterRow(db, { email, name = 'Roster Person', rollNumber = null, role = 'student', programme = null }) {
	return Number(
		db
			.prepare(
				`INSERT INTO roster (email, name, roll_number, role, programme, claimed, created_at)
				 VALUES (?, ?, ?, ?, ?, 0, ?)`,
			)
			.run(email, name, rollNumber, role, programme, toDbTime(new Date())).lastInsertRowid,
	);
}

// The token from the link in an email body ("…/register/#token=abc").
export function tokenFromEmail(message) {
	return message.text.match(/#token=([\w-]+)/)?.[1];
}

// A browser-like client: sends JSON and remembers the session cookie.
export function client(baseUrl) {
	let cookie = null;
	return {
		get cookie() {
			return cookie;
		},
		set cookie(value) {
			cookie = value;
		},
		async request(path, { method = 'GET', body, headers = {} } = {}) {
			const response = await fetch(baseUrl + path, {
				method,
				headers: {
					...(method === 'GET' ? {} : { 'Content-Type': 'application/json' }),
					...(cookie ? { Cookie: cookie } : {}),
					...headers,
				},
				body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
			});
			const setCookie = response.headers.get('set-cookie');
			if (setCookie) {
				const [pair] = setCookie.split(';');
				cookie = pair.endsWith('=') ? null : pair; // "dphy_session=" means cleared
			}
			// JSON answers are parsed; anything else (a downloaded file) is returned as a Buffer.
			const bytes = Buffer.from(await response.arrayBuffer());
			const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
			const answer = !bytes.length ? null : isJson ? JSON.parse(bytes.toString('utf8')) : bytes;
			return { status: response.status, headers: response.headers, setCookie, body: answer };
		},
		login(email, password = PASSWORD) {
			return this.request('/login', { method: 'POST', body: { email, password } });
		},
	};
}
