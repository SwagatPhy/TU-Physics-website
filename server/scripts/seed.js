// Fills an empty trial database with FAKE data: `npm run seed`.
//
// 1 admin, 2 faculty, 10 students, 3 courses, a few sample links.
// Every account uses SEED_PASSWORD (see .env.example) and must change it on
// first login. Emails use the reserved ".test" domain, so none can be real.
// To start over, delete the database file (DATABASE_PATH) and run again.

import { loadConfig } from '../src/config.js';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { readFileSync } from 'node:fs';
import { hashPassword } from '../src/auth.js';
import { loadProgrammes } from '../src/programmes.js';
import { parseRoster, importRoster } from '../src/roster.js';

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file — fine
}

const config = loadConfig();
if (config.isProduction) {
	console.error('Refusing to seed: NODE_ENV is production. Seed data is for the trial only.');
	process.exit(1);
}
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 10) {
	console.error('Set SEED_PASSWORD (at least 10 characters) in server/.env first.');
	process.exit(1);
}

const db = openDatabase(config.databasePath);
migrate(db);
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
	console.error(`The database already has users. Delete ${config.databasePath} to reseed.`);
	process.exit(1);
}

const now = toDbTime(new Date());
const passwordHash = await hashPassword(seedPassword);

function addUser(name, email, role) {
	return db
		.prepare(
			`INSERT INTO users (name, email, password_hash, role, active, must_change_password, created_at)
			 VALUES (?, ?, ?, ?, 1, 1, ?)`,
		)
		.run(name, email, passwordHash, role, now).lastInsertRowid;
}

db.exec('BEGIN');

addUser('Trial Admin', 'admin@example.test', 'admin');
const facultyA = addUser('Test Faculty A', 'faculty.a@example.test', 'faculty');
const facultyB = addUser('Test Faculty B', 'faculty.b@example.test', 'faculty');
const students = [];
for (let i = 1; i <= 10; i++) {
	const number = String(i).padStart(2, '0');
	students.push(addUser(`Test Student ${number}`, `student${number}@example.test`, 'student'));
}

// Codes match the public course catalogue (src/content/courses).
const addCourse = db.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, 1)');
const courses = [
	{ id: addCourse.run('PHY 101', 'Classical Mechanics', 'TRIAL', facultyA).lastInsertRowid, code: 'phy101' },
	{ id: addCourse.run('PHY 210', 'Electromagnetism', 'TRIAL', facultyA).lastInsertRowid, code: 'phy210' },
	{ id: addCourse.run('PHY 540', 'Computational Physics', 'TRIAL', facultyB).lastInsertRowid, code: 'phy540' },
];

// Overlapping groups, so tests can check a student only sees their own courses:
// students 01–06 → PHY 101, 04–10 → PHY 210, 01–03 and 08–10 → PHY 540.
const enroll = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)');
students.slice(0, 6).forEach((id) => enroll.run(id, courses[0].id));
students.slice(3, 10).forEach((id) => enroll.run(id, courses[1].id));
[...students.slice(0, 3), ...students.slice(7, 10)].forEach((id) => enroll.run(id, courses[2].id));

const addResource = db.prepare(
	'INSERT INTO resources (course_id, kind, title, url, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
);
for (const course of courses) {
	const owner = course.id === courses[2].id ? facultyB : facultyA;
	addResource.run(course.id, 'class_link', 'FAKE class link', `https://example.com/fake-class/${course.code}`, owner, now);
	addResource.run(course.id, 'notes', 'FAKE notes', `https://example.com/fake-notes/${course.code}.pdf`, owner, now);
}

db.exec('COMMIT');

// Unclaimed roster rows, for trying self-registration (same file as `npm run roster:import`).
const { rows, errors } = parseRoster(readFileSync('sample-roster.csv', 'utf8'), loadProgrammes(config.programmesFile));
if (errors.length > 0) throw new Error(`sample-roster.csv: ${errors.join('; ')}`);
importRoster(db, rows);

console.log(`Seeded ${config.databasePath} with fake data:
  admin    admin@example.test
  faculty  faculty.a@example.test, faculty.b@example.test
  students student01@example.test … student10@example.test
  password SEED_PASSWORD from .env (must be changed on first login)
  roster   ${rows.length} unclaimed people from sample-roster.csv, ready to register`);
