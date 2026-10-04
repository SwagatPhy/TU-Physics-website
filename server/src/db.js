// Database access. The trial uses SQLite through Node's built-in node:sqlite
// module (no native add-on to install). Every query elsewhere goes through
// `db.prepare(sql).run/get/all(...params)` with ? placeholders — never by
// building SQL strings from user input.
//
// Moving to MySQL later means replacing this file (same prepare/run/get/all
// shape) and the small dialect notes in migrations/README.md.

import { DatabaseSync } from 'node:sqlite';
import { readdirSync, readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS_DIR = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');

export function openDatabase(path) {
	if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
	const db = new DatabaseSync(path);
	db.exec('PRAGMA foreign_keys = ON');
	if (path !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
	return db;
}

// Applies migrations/NNN_name.sql files that haven't run yet, in number order.
// Returns the names of the files it applied.
export function migrate(db) {
	db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (
		name VARCHAR(255) PRIMARY KEY,
		applied_at DATETIME NOT NULL
	)`);
	const done = new Set(db.prepare('SELECT name FROM schema_migrations').all().map((row) => row.name));
	const files = readdirSync(MIGRATIONS_DIR).filter((file) => /^\d+_.*\.sql$/.test(file)).sort();
	const applied = [];

	for (const file of files) {
		if (done.has(file)) continue;
		const sql = readFileSync(join(MIGRATIONS_DIR, file), 'utf8');
		db.exec('BEGIN');
		try {
			db.exec(sql);
			db.prepare('INSERT INTO schema_migrations (name, applied_at) VALUES (?, ?)').run(file, toDbTime(new Date()));
			db.exec('COMMIT');
		} catch (error) {
			db.exec('ROLLBACK');
			throw new Error(`Migration ${file} failed: ${error.message}`);
		}
		applied.push(file);
	}
	return applied;
}

// Dates are stored as UTC text "YYYY-MM-DD HH:MM:SS", which works in SQLite
// and in a MySQL DATETIME column alike.
export function toDbTime(date) {
	return date.toISOString().slice(0, 19).replace('T', ' ');
}

export function fromDbTime(text) {
	return new Date(`${text.replace(' ', 'T')}Z`);
}
