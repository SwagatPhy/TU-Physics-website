// DEVELOPMENT ONLY — never run on a real server. Refuses NODE_ENV=production.
//
// Fills an empty local database with FAKE data, for development and for
// trying the portal on your own computer:
//   npm run seed              (the database must have no users yet)
//   npm run seed -- --fresh   (deletes the database and data/uploads/ first)
//
// 1 admin, 2 faculty, 10 students, 3 courses with fake class links and notes
// (two with tiny fake files), 4 sign-ups waiting for approval, and a few
// roster rows. Every account uses SEED_PASSWORD from .env; the approved ones
// must change it at first login. Emails use the reserved ".test" domain, so
// none can be real. Nothing here comes from real people.

import { rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { hashPassword } from '../src/auth.js';
import { loadProgrammes, readRollNumber } from '../src/programmes.js';
import { parseRoster, importRoster } from '../src/roster.js';
import { storeFile } from '../src/files.js';
import { refuseIfApiRunning } from './api-is-running.js';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');

function refuse(message) {
	console.error(`Refusing to seed: ${message}`);
	process.exit(1);
}

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file — fine
}

const config = loadConfig();
if (config.isProduction) refuse('NODE_ENV is production. This fake data is for development only.');
if (config.mailMode !== 'outbox') refuse(`MAIL_MODE is "${config.mailMode}"; development data must only use MAIL_MODE=outbox.`);
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 10) refuse('set SEED_PASSWORD (at least 10 characters) in server/.env first.');

// The API must not be running: it would keep using a deleted file.
await refuseIfApiRunning(config.port);

const fresh = process.argv.includes('--fresh');
const uploadsDir = resolve(SERVER_DIR, config.uploadsDir);
if (fresh) {
	// Only ever delete inside server/data/.
	const databaseFile = resolve(SERVER_DIR, config.databasePath);
	const dataDir = join(SERVER_DIR, 'data') + '/';
	if (!databaseFile.startsWith(dataDir) || !uploadsDir.startsWith(dataDir)) {
		refuse('--fresh only works when DATABASE_PATH and UPLOADS_DIR are inside server/data/.');
	}
	for (const suffix of ['', '-wal', '-shm']) rmSync(databaseFile + suffix, { force: true });
	rmSync(uploadsDir, { recursive: true, force: true }); // the note files belonged to the old database
}

const db = openDatabase(config.databasePath);
migrate(db);
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
	refuse(`${config.databasePath} already has users. Run "npm run seed -- --fresh" to start again.`);
}

const programmes = loadProgrammes(config.programmesFile);
const now = toDbTime(new Date());
const passwordHash = await hashPassword(seedPassword);

function addUser(name, email, role, rollNumber = null) {
	const roll = rollNumber ? readRollNumber(programmes, rollNumber) : null;
	return db
		.prepare(
			`INSERT INTO users (name, email, password_hash, role, active, must_change_password, created_at, roll_number, programme, batch_year)
			 VALUES (?, ?, ?, ?, 1, 1, ?, ?, ?, ?)`,
		)
		.run(name, email, passwordHash, role, now, roll?.rollNumber ?? null, roll?.programme ?? null, roll?.batchYear ?? null).lastInsertRowid;
}

db.exec('BEGIN');

addUser('Dev Admin', 'admin@example.test', 'admin');
const facultyA = addUser('Test Faculty A', 'faculty.a@example.test', 'faculty');
const facultyB = addUser('Test Faculty B', 'faculty.b@example.test', 'faculty');
// Students 01–05: MSc, joined 2024. Students 06–10: Integrated BSc-MSc, joined 2023.
const students = [];
for (let i = 1; i <= 10; i++) {
	const number = String(i).padStart(2, '0');
	const rollNumber = i <= 5 ? `PHM24${String(900 + i)}` : `PHI23${String(900 + i)}`;
	students.push(addUser(`Test Student ${number}`, `student${number}@example.test`, 'student', rollNumber));
}

// Codes match the public course catalogue (src/content/courses).
const addCourse = db.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, 1)');
const courses = [
	{ id: addCourse.run('PHY 101', 'Classical Mechanics', 'DEV', facultyA).lastInsertRowid, code: 'phy101', owner: facultyA },
	{ id: addCourse.run('PHY 210', 'Electromagnetism', 'DEV', facultyA).lastInsertRowid, code: 'phy210', owner: facultyA },
	{ id: addCourse.run('PHY 540', 'Computational Physics', 'DEV', facultyB).lastInsertRowid, code: 'phy540', owner: facultyB },
];

// Overlapping groups, so you can check a student only sees their own courses:
// students 01–06 → PHY 101, 04–10 → PHY 210, 01–03 and 08–10 → PHY 540.
const enroll = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)');
students.slice(0, 6).forEach((id) => enroll.run(id, courses[0].id));
students.slice(3, 10).forEach((id) => enroll.run(id, courses[1].id));
[...students.slice(0, 3), ...students.slice(7, 10)].forEach((id) => enroll.run(id, courses[2].id));

const addResource = db.prepare(
	'INSERT INTO resources (course_id, kind, title, url, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
);
const addFileNote = db.prepare(
	`INSERT INTO resources (course_id, kind, title, url, created_by, updated_at, file_name, file_stored_as, file_size, file_type)
	 VALUES (?, 'notes', ?, NULL, ?, ?, ?, ?, ?, ?)`,
);
for (const course of courses) {
	addResource.run(course.id, 'class_link', 'FAKE class link', `https://example.com/fake-class/${course.code}`, course.owner, now);
	addResource.run(course.id, 'notes', 'FAKE reading', `https://example.com/fake-notes/${course.code}`, course.owner, now);
	// Two tiny fake files per course, stored like real uploads.
	const fakeText = Buffer.from(`FAKE notes for ${course.code}. Made up for development; not course material.\n`);
	const fakePdf = Buffer.from(`%PDF-1.4\n% FAKE PDF for ${course.code}; made up for development\n%%EOF\n`);
	for (const [title, name, bytes, type] of [
		['FAKE notes (text file)', 'fake-notes.txt', fakeText, 'text/plain; charset=utf-8'],
		['FAKE notes (PDF file)', 'fake-notes.pdf', fakePdf, 'application/pdf'],
	]) {
		addFileNote.run(course.id, title, course.owner, now, name, storeFile(uploadsDir, bytes), bytes.length, type);
	}
}

// Sign-ups waiting for an admin, as if they had signed up and verified their
// email themselves (so they chose their password: no forced change).
const addPending = db.prepare(
	`INSERT INTO users (name, email, password_hash, role, status, active, must_change_password, created_at, roll_number, programme, phone, batch_year)
	 VALUES (?, ?, ?, ?, 'pending', 1, 0, ?, ?, ?, ?, ?)`,
);
for (const [name, email, role, rollNumber, phone] of [
	['Pending Student 01', 'pending01@example.test', 'student', 'PHP23901', '+91 90000 00001'],
	['Pending Student 02', 'pending02@example.test', 'student', 'PHM24911', '+91 90000 00002'],
	['Pending Student 03', 'pending03@example.test', 'student', 'PHI23911', '+91 90000 00003'],
	['Pending Staff Member', 'pending.staff@example.test', 'faculty', null, '03712 000000'],
]) {
	const roll = rollNumber ? readRollNumber(programmes, rollNumber) : null;
	addPending.run(name, email, passwordHash, role, now, roll?.rollNumber ?? null, roll?.programme ?? null, phone, roll?.batchYear ?? null);
}

db.exec('COMMIT');

// Unclaimed roster rows: signing up with a matching email + roll number is approved at once.
const FAKE_ROSTER = `email,name,roll_number,role
roster.student01@example.test,Roster Student 01,PHP22911,student
roster.student02@example.test,Roster Student 02,PHM24921,student
roster.student03@example.test,Roster Student 03,PHI23921,student
roster.faculty@example.test,Roster Faculty C,,faculty
`;
const { rows, errors } = parseRoster(FAKE_ROSTER, programmes);
if (errors.length > 0) throw new Error(`fake roster: ${errors.join('; ')}`);
importRoster(db, rows);

console.log(`Seeded ${config.databasePath} with FAKE development data:
  admin    admin@example.test
  faculty  faculty.a@example.test, faculty.b@example.test
  students student01@example.test … student10@example.test (01–05 MSc 2024, 06–10 Integrated 2023)
  password SEED_PASSWORD from .env (must be changed on first login)
  pending  pending01–03@example.test, pending.staff@example.test (waiting for approval; same password, no forced change)
  roster   ${rows.length} unclaimed rows, e.g. roster.student01@example.test + PHP22911`);
