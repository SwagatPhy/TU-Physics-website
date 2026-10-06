import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, renameSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:net';
import { spawnSync } from 'node:child_process';
import { loadConfig } from '../src/config.js';
import { openDatabase, migrate } from '../src/db.js';
import { createApp } from '../src/app.js';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

// An API on a real database file in a temporary folder.
async function startOnFile() {
	const folder = mkdtempSync(join(tmpdir(), 'portal-guard-'));
	const databasePath = join(folder, 'portal.sqlite');
	const config = loadConfig({ DATABASE_PATH: databasePath, COOKIE_SECURE: 'true' });
	const db = openDatabase(databasePath);
	migrate(db);
	let stopped = 0;
	const app = createApp({ db, config, mailer: { send: async () => {} }, onDatabaseReplaced: () => stopped++ });
	const server = await new Promise((resolve) => {
		const listening = app.listen(0, '127.0.0.1', () => resolve(listening));
	});
	const health = () => fetch(`http://127.0.0.1:${server.address().port}/dphy/api/health`);
	return {
		databasePath,
		health,
		stopped: () => stopped,
		close: () => {
			server.close();
			db.close();
			rmSync(folder, { recursive: true, force: true });
		},
	};
}

describe('the API notices when its database file is replaced or deleted', () => {
	test('replaced file (e.g. reset with seed:people -- --fresh): requests refused, API stops', async () => {
		const api = await startOnFile();
		assert.equal((await api.health()).status, 200);

		renameSync(api.databasePath, `${api.databasePath}.old`); // what a reset does: the path now…
		const other = openDatabase(api.databasePath); // …points to a different file
		other.close();

		const res = await api.health();
		assert.equal(res.status, 503);
		assert.deepEqual(await res.json(), { error: 'database_replaced' });
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.ok(api.stopped() >= 1, 'onDatabaseReplaced was called');
		assert.equal((await api.health()).status, 503, 'still refused afterwards');
		api.close();
	});

	test('deleted file: requests refused, API stops', async () => {
		const api = await startOnFile();
		rmSync(api.databasePath);
		assert.equal((await api.health()).status, 503);
		await new Promise((resolve) => setTimeout(resolve, 20));
		assert.ok(api.stopped() >= 1);
		api.close();
	});

	test('nothing happens while the file is unchanged', async () => {
		const api = await startOnFile();
		for (let i = 0; i < 3; i++) assert.equal((await api.health()).status, 200);
		assert.equal(api.stopped(), 0);
		api.close();
	});
});

describe('the seed scripts refuse while the API is running', () => {
	for (const script of ['scripts/seed-people.js', 'scripts/seed.js']) {
		test(`${script} refuses when something listens on the API port`, async () => {
			const blocker = createServer().listen(0, '127.0.0.1');
			await new Promise((resolve) => blocker.once('listening', resolve));
			const databasePath = `data/guard-test-${process.pid}.sqlite`;

			const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', script, '--fresh'], {
				cwd: SERVER_DIR,
				encoding: 'utf8',
				env: {
					...process.env,
					NODE_ENV: 'development',
					PORT: String(blocker.address().port),
					DATABASE_PATH: databasePath,
					MAIL_MODE: 'outbox',
					SEED_PASSWORD: 'guard-test-password',
				},
			});
			blocker.close();

			assert.equal(run.status, 1);
			assert.match(run.stderr, /Refusing to seed: the portal API is running on port \d+/);
			assert.ok(!existsSync(join(SERVER_DIR, databasePath)), 'no database file was created');
		});
	}
});
