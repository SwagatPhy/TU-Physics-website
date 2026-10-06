// `npm run backup` and `npm run backup:check` on a real database file.

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, readdirSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { storeFile } from '../src/files.js';
import { addOffering } from './helpers.js';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('backups', () => {
	let folder, env, db, storedAs;

	before(() => {
		folder = mkdtempSync(join(tmpdir(), 'portal-backup-'));
		env = { ...process.env, DATABASE_PATH: join(folder, 'live', 'portal.sqlite'), UPLOADS_DIR: join(folder, 'live', 'uploads') };
		db = openDatabase(env.DATABASE_PATH); // stays open, like the running API
		migrate(db);
		const now = toDbTime(new Date());
		const teacher = db.prepare("INSERT INTO users (name, email, password_hash, role, created_at) VALUES ('T', 't@example.test', 'h', 'faculty', ?)").run(now).lastInsertRowid;
		const offering = addOffering(db, { code: 'PHY 1', teacherId: teacher });
		storedAs = storeFile(env.UPLOADS_DIR, Buffer.from('note'));
		db.prepare(
			`INSERT INTO resources (offering_id, kind, title, created_by, updated_at, file_name, file_stored_as, file_size, file_type)
			 VALUES (?, 'notes', 'N', ?, ?, 'n.txt', ?, 4, 'text/plain; charset=utf-8')`,
		).run(offering, teacher, now, storedAs);
	});
	after(() => {
		db.close();
		rmSync(folder, { recursive: true, force: true });
	});

	const run = (script, args) =>
		spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', `scripts/${script}.js`, ...args], { cwd: SERVER_DIR, env, encoding: 'utf8' });

	test('a backup of the live database and files passes the restore check', () => {
		db.exec('BEGIN'); // another connection in the middle of writing
		db.prepare("INSERT INTO audit_log (action, at) VALUES ('uncommitted', '2026-01-01 00:00:00')").run();
		const made = run('backup', [join(folder, 'backups')]);
		db.exec('ROLLBACK');
		assert.equal(made.status, 0, made.stderr);

		const [name] = readdirSync(join(folder, 'backups'));
		assert.match(name, /^\d{4}-\d{2}-\d{2}T\d{4}$/);
		const checked = run('backup-check', [join(folder, 'backups', name)]);
		assert.equal(checked.status, 0, checked.stderr);
		assert.match(checked.stdout, /Backup OK.*\n.*1 accounts, 1 courses, 1 offerings, 1 links and notes, 1 note files \(all present\), 0 log entries/);
	});

	test('the check fails when a note file is missing from the backup', () => {
		const made = run('backup', [join(folder, 'broken')]);
		assert.equal(made.status, 0, made.stderr);
		const [name] = readdirSync(join(folder, 'broken'));
		rmSync(join(folder, 'broken', name, 'uploads', storedAs));
		const checked = run('backup-check', [join(folder, 'broken', name)]);
		assert.equal(checked.status, 1);
		assert.match(checked.stderr, /1 of 1 note file\(s\) are missing/);
	});

	test('--keep deletes only older backup folders', () => {
		const target = join(folder, 'rotating');
		for (const old of ['2020-01-01T0000', '2020-01-02T0000', '2020-01-03T0000', 'keep-me-not-a-backup']) {
			mkdirSync(join(target, old), { recursive: true });
		}
		const made = run('backup', [target, '--keep', '2']);
		assert.equal(made.status, 0, made.stderr);
		const left = readdirSync(target).sort();
		assert.equal(left.length, 3);
		assert.deepEqual(left.slice(0, 1), ['2020-01-03T0000']);
		assert.ok(left.includes('keep-me-not-a-backup'));
	});

	test('explains what is wrong instead of backing up', () => {
		assert.match(run('backup', []).stderr, /give the backup folder/);
		assert.match(run('backup', [join(folder, 'x'), '--keep', 'many']).stderr, /--keep needs a whole number/);
		assert.match(run('backup-check', [join(folder, 'nothing-here')]).stderr, /portal.sqlite is missing/);
	});
});
