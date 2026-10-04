import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, migrate, toDbTime } from '../src/db.js';

test('migrations create every table and are safe to run twice', () => {
	const db = openDatabase(':memory:');
	assert.ok(migrate(db).length > 0);
	assert.deepEqual(migrate(db), []);

	const tables = db
		.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
		.all()
		.map((row) => row.name);
	for (const table of ['users', 'courses', 'enrollments', 'resources', 'sessions', 'audit_log', 'schema_migrations']) {
		assert.ok(tables.includes(table), `missing table ${table}`);
	}
});

test('the schema rejects bad roles, duplicate emails and links to missing rows', () => {
	const db = openDatabase(':memory:');
	migrate(db);
	const now = toDbTime(new Date());
	const insertUser = db.prepare(
		'INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, ?, ?, ?)',
	);

	insertUser.run('A', 'a@example.test', 'hash', 'student', now);
	assert.throws(() => insertUser.run('B', 'b@example.test', 'hash', 'superuser', now), /CHECK/);
	assert.throws(() => insertUser.run('A2', 'a@example.test', 'hash', 'student', now), /UNIQUE/);
	assert.throws(() => db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (1, 999)').run(), /FOREIGN KEY/);
});
