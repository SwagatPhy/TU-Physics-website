// Checks that a backup can be restored: `npm run backup:check -- <backup folder>`
//
// Opens the copied database read-only, runs SQLite's integrity check, counts
// what is in it, and checks that every note file the database mentions is in
// the backup's uploads/ folder. Changes nothing. Exit code 0 = usable backup.

import { DatabaseSync } from 'node:sqlite';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

function fail(message) {
	console.error(`Backup NOT usable: ${message}`);
	process.exit(1);
}

const folder = process.argv[2];
if (!folder) fail('give the backup folder: npm run backup:check -- /var/backups/dphy-portal/2026-10-06T0230');
const databaseFile = join(folder, 'portal.sqlite');
if (!existsSync(databaseFile)) fail(`${databaseFile} is missing.`);

let db;
try {
	db = new DatabaseSync(databaseFile, { readOnly: true });
	const integrity = db.prepare('PRAGMA integrity_check').get().integrity_check;
	if (integrity !== 'ok') fail(`the database is damaged (${integrity}).`);
} catch (error) {
	fail(`the database can't be read (${error.message}).`);
}

const count = (table) => db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get().n;
const files = db.prepare('SELECT file_stored_as FROM resources WHERE file_stored_as IS NOT NULL').all();
const missing = files.filter((row) => !existsSync(join(folder, 'uploads', row.file_stored_as)));
if (missing.length > 0) fail(`${missing.length} of ${files.length} note file(s) are missing from ${join(folder, 'uploads')}.`);

console.log(
	`Backup OK: ${folder}\n` +
		`  ${count('users')} accounts, ${count('courses')} courses, ${count('resources')} links and notes, ` +
		`${files.length} note files (all present), ${count('audit_log')} log entries.`,
);
