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
	for (const table of ['users', 'courses', 'offerings', 'enrollments', 'resources', 'sessions', 'audit_log', 'schema_migrations']) {
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
	assert.throws(
		() => db.prepare("INSERT INTO enrollments (offering_id, user_id, added_by, created_at) VALUES (999, 1, 'admin', ?)").run(now),
		/FOREIGN KEY/,
	);
});

test('006 fills in the batch year of existing students from their roll numbers', () => {
	const db = openDatabase(':memory:');
	migrate(db, { until: '006' });
	const now = toDbTime(new Date());
	const addUser = db.prepare('INSERT INTO users (name, email, password_hash, role, roll_number, created_at) VALUES (?, ?, ?, ?, ?, ?)');
	addUser.run('New format', 'a@example.test', 'hash', 'student', 'PHP22017', now);
	addUser.run('Integrated', 'b@example.test', 'hash', 'student', 'PHI23005', now);
	addUser.run('Old trial format', 'c@example.test', 'hash', 'student', 'PHD99001', now);
	addUser.run('Teacher', 'd@example.test', 'hash', 'faculty', null, now);

	assert.equal(migrate(db)[0], '006_user_batch_year.sql');
	const years = db.prepare('SELECT email, batch_year FROM users ORDER BY email').all().map((row) => [row.email, row.batch_year]);
	assert.deepEqual(years, [
		['a@example.test', 2022],
		['b@example.test', 2023],
		['c@example.test', null],
		['d@example.test', null],
	]);
});

test('007 turns each existing course into an offering and moves its enrolments, links and notes', () => {
	const db = openDatabase(':memory:');
	migrate(db, { until: '007' });
	const now = toDbTime(new Date());
	const addUser = db.prepare("INSERT INTO users (name, email, password_hash, role, created_at) VALUES (?, ?, 'h', ?, ?)");
	const teacher = addUser.run('Teacher', 't@example.test', 'faculty', now).lastInsertRowid;
	const alice = addUser.run('Alice', 'a@example.test', 'student', now).lastInsertRowid;
	const bob = addUser.run('Bob', 'b@example.test', 'student', now).lastInsertRowid;
	const addCourse = db.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, ?)');
	const running = addCourse.run('PHY 101', 'Mechanics', 'Autumn 2026', teacher, 1).lastInsertRowid;
	const retired = addCourse.run('PHY 999', 'Old course', 'Spring 2024', teacher, 0).lastInsertRowid;
	const enrol = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)');
	enrol.run(alice, running);
	enrol.run(bob, running);
	enrol.run(alice, retired);
	const addItem = db.prepare(
		'INSERT INTO resources (course_id, kind, title, url, created_by, updated_at, file_name, file_stored_as, file_size, file_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
	);
	const link = addItem.run(running, 'class_link', 'Class', 'https://example.com/c', teacher, now, null, null, null, null).lastInsertRowid;
	const note = addItem.run(retired, 'notes', 'Notes', null, teacher, now, 'n.pdf', 'a'.repeat(32), 10, 'application/pdf').lastInsertRowid;

	assert.equal(migrate(db)[0], '007_offerings.sql');

	const offerings = db
		.prepare('SELECT id, course_id, programme, batch_year, semester, teacher_id, status, is_elective, content_hidden FROM offerings ORDER BY course_id')
		.all()
		.map((row) => ({ ...row }));
	assert.equal(offerings.length, 2);
	const [current, finished] = offerings;
	assert.deepEqual(
		{ ...current, id: undefined },
		{ id: undefined, course_id: running, programme: null, batch_year: null, semester: 'Autumn 2026', teacher_id: teacher, status: 'active', is_elective: 0, content_hidden: 0 },
	);
	// An inactive course was invisible to students: it becomes finished with its content hidden.
	assert.deepEqual([finished.status, finished.content_hidden, finished.semester], ['finished', 1, 'Spring 2024']);

	const enrolments = db.prepare('SELECT offering_id, user_id, added_by, removed FROM enrollments ORDER BY offering_id, user_id').all().map((row) => ({ ...row }));
	assert.deepEqual(enrolments, [
		{ offering_id: current.id, user_id: alice, added_by: 'migrated', removed: 0 },
		{ offering_id: current.id, user_id: bob, added_by: 'migrated', removed: 0 },
		{ offering_id: finished.id, user_id: alice, added_by: 'migrated', removed: 0 },
	]);

	const items = db.prepare('SELECT id, offering_id, title, file_stored_as FROM resources ORDER BY id').all().map((row) => ({ ...row }));
	assert.deepEqual(items, [
		{ id: link, offering_id: current.id, title: 'Class', file_stored_as: null },
		{ id: note, offering_id: finished.id, title: 'Notes', file_stored_as: 'a'.repeat(32) },
	]);
	assert.equal(db.prepare('PRAGMA foreign_key_check').all().length, 0);
});
