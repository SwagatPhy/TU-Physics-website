// `npm run admin:create`: the first-administrator command used on a real server.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDatabase } from '../src/db.js';
import { verifyPassword } from '../src/auth.js';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'create-admin.js');
const PASSWORD = 'a-good-admin-password';

describe('npm run admin:create', () => {
	let folder, databasePath;
	before(() => {
		folder = mkdtempSync(join(tmpdir(), 'portal-admin-'));
		databasePath = join(folder, 'portal.sqlite');
	});
	after(() => rmSync(folder, { recursive: true, force: true }));

	// Runs the command with the answers typed in, one per line.
	function run(answers, args = []) {
		return spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', SCRIPT, ...args], {
			input: answers.map((answer) => `${answer}\n`).join(''),
			encoding: 'utf8',
			env: { ...process.env, NODE_ENV: 'production', DATABASE_PATH: databasePath },
		});
	}
	const userWithEmail = (email) => openDatabase(databasePath).prepare('SELECT * FROM users WHERE email = ?').get(email);

	test('creates an approved admin, in production too, and never prints the password', async () => {
		const result = run(['Head Admin', 'Head@Example.test', PASSWORD, PASSWORD]);
		assert.equal(result.status, 0, result.stderr);
		assert.ok(!(result.stdout + result.stderr).includes(PASSWORD));

		const user = userWithEmail('head@example.test');
		assert.equal(user.name, 'Head Admin');
		assert.equal(user.role, 'admin');
		assert.equal(user.status, 'approved');
		assert.equal(user.must_change_password, 0);
		assert.ok(await verifyPassword(user.password_hash, PASSWORD));

		const audit = openDatabase(databasePath).prepare("SELECT target FROM audit_log WHERE action = 'admin_created'").all();
		assert.deepEqual(audit.map((row) => row.target), [`user:${user.id} (command line)`]);
	});

	test('--force-change makes the admin choose a new password at first login', () => {
		assert.equal(run(['Second Admin', 'second@example.test', PASSWORD, PASSWORD], ['--force-change']).status, 0);
		assert.equal(userWithEmail('second@example.test').must_change_password, 1);
	});

	test('refuses an email that already has an account', () => {
		const result = run(['Someone', 'head@example.test', PASSWORD, PASSWORD]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /already exists/);
	});

	test('refuses different passwords, a short password, a bad email and missing answers', () => {
		for (const [answers, message] of [
			[['Third Admin', 'third@example.test', PASSWORD, `${PASSWORD}x`], /different/],
			[['Third Admin', 'third@example.test', 'short', 'short'], /at least 10/],
			[['Third Admin', 'not an email', PASSWORD, PASSWORD], /email/],
			[['Third Admin', 'third@example.test'], /input ended/],
		]) {
			const result = run(answers);
			assert.equal(result.status, 1);
			assert.match(result.stderr, message);
		}
		assert.equal(userWithEmail('third@example.test'), undefined);
	});

	test('refuses a password (or anything else) given on the command line', () => {
		const result = run([], ['--password', PASSWORD]);
		assert.equal(result.status, 1);
		assert.match(result.stderr, /never given on the command line/);
	});
});
