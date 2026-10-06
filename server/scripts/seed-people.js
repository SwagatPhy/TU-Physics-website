// Builds a TRIAL database from the people already on the website:
//   npm run seed:people              (needs an empty database)
//   npm run seed:people -- --fresh   (deletes server/data/portal.sqlite first)
//
// Reads src/content/people/*.json and src/content/courses/*.md. Never changes them.
//   teaching.json            -> approved faculty
//   non-teaching.json        -> approved department members (role "faculty" for now)
//   research-scholars.json   -> approved PhD students
//   research-assistants.json -> approved department members
// plus one admin (admin@example.test), 4 made-up sign-ups waiting for approval,
// courses from the catalogue, a few enrolments and sample links on example.com.
//
// What is real and what is made up:
//   - real: names and designations exactly as on the website; course codes,
//     titles and the faculty named in each course file.
//   - made up (and marked "TRIAL" in users.admin_note): every login email is
//     generated as <website id>@trial.test, so no real address is stored and
//     nothing can ever be mailed to a real person; scholars' roll numbers are
//     PHD99001, PHD99002, … because the website has none; enrolments and links.
// Every account uses SEED_PASSWORD and can log in straight away (no forced change).
//
// Safety: development only (refuses NODE_ENV=production), only writes a
// database inside server/data/, and only with MAIL_MODE=outbox.
// At the end it prints every data problem found in the JSON so it can be fixed there.

import { readFileSync, readdirSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { hashPassword } from '../src/auth.js';

const SERVER_DIR = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const REPO_DIR = resolve(SERVER_DIR, '..');
const PEOPLE_DIR = join(REPO_DIR, 'src/content/people');
const COURSES_DIR = join(REPO_DIR, 'src/content/courses');
const TRIAL_NOTE = 'TRIAL: login email generated from the website id';

try {
	process.loadEnvFile(join(SERVER_DIR, '.env'));
} catch {
	// no .env file — fine
}

// ---- Safety checks --------------------------------------------------------

const config = loadConfig();
function refuse(message) {
	console.error(`Refusing to seed: ${message}`);
	process.exit(1);
}
if (config.isProduction) refuse('NODE_ENV is production. This is trial data.');
if (config.mailMode !== 'outbox') refuse(`MAIL_MODE is "${config.mailMode}"; trial data must only ever use MAIL_MODE=outbox.`);
const databaseFile = resolve(SERVER_DIR, config.databasePath);
if (!databaseFile.startsWith(join(SERVER_DIR, 'data') + '/')) {
	refuse(`DATABASE_PATH must be a file inside server/data/ (it is ${config.databasePath}).`);
}
const seedPassword = process.env.SEED_PASSWORD;
if (!seedPassword || seedPassword.length < 10) refuse('set SEED_PASSWORD (at least 10 characters) in server/.env first.');

if (process.argv.includes('--fresh')) {
	for (const suffix of ['', '-wal', '-shm']) rmSync(databaseFile + suffix, { force: true });
}
const db = openDatabase(databaseFile);
migrate(db);
if (db.prepare('SELECT COUNT(*) AS n FROM users').get().n > 0) {
	refuse(`${config.databasePath} already has users. Run "npm run seed:people -- --fresh" to start from scratch.`);
}

// ---- Read the website data ------------------------------------------------

const readPeople = (file) => JSON.parse(readFileSync(join(PEOPLE_DIR, file), 'utf8'));
const teaching = readPeople('teaching.json');
const nonTeaching = readPeople('non-teaching.json');
const scholars = readPeople('research-scholars.json');
const assistants = readPeople('research-assistants.json');

// Course files are Markdown with a small frontmatter block (title, code, faculty).
function readCourse(file) {
	const text = readFileSync(join(COURSES_DIR, file), 'utf8');
	const value = (key) => text.match(new RegExp(`^${key}:\\s*"?(.*?)"?\\s*$`, 'm'))?.[1] ?? '';
	return { file, title: value('title'), code: value('code'), faculty: value('faculty') };
}
const courses = readdirSync(COURSES_DIR).filter((file) => file.endsWith('.md')).sort().map(readCourse);

// ---- Look for problems in the JSON (reported at the end, never fixed here) --

const problems = [];
const looksLikeEmail = (email) => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
const allPeople = [
	...teaching.map((p) => ({ ...p, file: 'teaching.json' })),
	...nonTeaching.map((p) => ({ ...p, file: 'non-teaching.json' })),
	...scholars.map((p) => ({ ...p, file: 'research-scholars.json' })),
	...assistants.map((p) => ({ ...p, file: 'research-assistants.json' })),
];
const byEmail = new Map();
for (const person of allPeople) {
	const email = (person.email ?? '').trim().toLowerCase();
	if (!email) problems.push(`${person.file}: ${person.name} (${person.id}) has no email`);
	else if (!looksLikeEmail(email)) problems.push(`${person.file}: ${person.name} (${person.id}) email "${person.email}" is not a valid address`);
	else if (/^(xyz|test|example|placeholder)@/.test(email) || email.includes('placeholder')) {
		problems.push(`${person.file}: ${person.name} (${person.id}) email "${person.email}" looks like a placeholder`);
	}
	if (email) byEmail.set(email, [...(byEmail.get(email) ?? []), person]);
	if (!person.name?.trim().includes(' ')) problems.push(`${person.file}: "${person.name}" (${person.id}) has only one name`);
}
for (const [email, people] of byEmail) {
	if (people.length > 1) problems.push(`${email} is used by ${people.map((p) => `${p.name} (${p.file})`).join(' and ')}`);
}
const seenCodes = new Map();
for (const course of courses) {
	if (seenCodes.has(course.code)) {
		problems.push(`courses: ${course.file} and ${seenCodes.get(course.code)} both have code "${course.code}" — only the first was added`);
	} else {
		seenCodes.set(course.code, course.file);
	}
}

// ---- Create the accounts ----------------------------------------------------

const now = toDbTime(new Date());
const passwordHash = await hashPassword(seedPassword);
const insertUser = db.prepare(
	`INSERT INTO users (name, email, password_hash, role, status, active, must_change_password, created_at,
	                    roll_number, programme, phone, designation, admin_note)
	 VALUES (?, ?, ?, ?, ?, 1, 0, ?, ?, ?, ?, ?, ?)`,
);
const loginEmail = (person) => `${person.id}@trial.test`;
const userIdByName = new Map(); // "rupjyoti gogoi" -> id, for courses and supervisors
const created = [];

function add(person, { role, status = 'approved', rollNumber = null, programme = null, note = TRIAL_NOTE }) {
	const email = loginEmail(person);
	const id = Number(
		insertUser.run(
			person.name.trim(),
			email,
			passwordHash,
			role,
			status,
			now,
			rollNumber,
			programme,
			person.phone || person.contact || null,
			person.designation ?? null,
			note,
		).lastInsertRowid,
	);
	userIdByName.set(person.name.trim().toLowerCase(), id);
	created.push({ group: person.file ?? '', name: person.name, email, role, status, rollNumber });
	return id;
}

db.exec('BEGIN');

db.prepare(
	`INSERT INTO users (name, email, password_hash, role, status, active, must_change_password, created_at, admin_note)
	 VALUES ('Trial Admin', 'admin@example.test', ?, 'admin', 'approved', 1, 0, ?, 'TRIAL: made-up admin account')`,
).run(passwordHash, now);

for (const person of teaching) add({ ...person, file: 'teaching' }, { role: 'faculty' });
for (const person of nonTeaching) add({ ...person, file: 'non-teaching' }, { role: 'faculty' });
for (const person of assistants) add({ ...person, file: 'research-assistant', designation: 'Research Assistant' }, { role: 'faculty' });
scholars.forEach((person, index) => {
	const rollNumber = `PHD${99001 + index}`;
	add(
		{ ...person, file: 'research-scholar', designation: 'Research Scholar' },
		{ role: 'student', rollNumber, programme: 'PhD', note: `TRIAL: roll number ${rollNumber} made up; login email generated from the website id` },
	);
});

// Made-up sign-ups waiting for the admin.
const pendingPeople = [
	{ id: 'trial.applicant1', name: 'Trial Applicant One', rollNumber: 'PHM99101', programme: 'MSc', role: 'student' },
	{ id: 'trial.applicant2', name: 'Trial Applicant Two', rollNumber: 'PHM99102', programme: 'MSc', role: 'student' },
	{ id: 'trial.applicant3', name: 'Trial Applicant Three', rollNumber: 'PHD99901', programme: 'PhD', role: 'student' },
	{ id: 'trial.staff', name: 'Trial Staff Applicant', rollNumber: null, programme: null, role: 'faculty' },
];
for (const person of pendingPeople) {
	add(
		{ ...person, file: 'pending sign-up', phone: '+91 90000 00000' },
		{ ...person, status: 'pending', note: 'TRIAL: made-up sign-up' },
	);
}

// ---- Courses, enrolments and sample links ---------------------------------

// "Dr. Rupjyoti Gogoi" -> the account for Rupjyoti Gogoi.
const facultyId = (name) => userIdByName.get(name.replace(/^(Dr|Prof)\.?\s+/i, '').trim().toLowerCase());
const addCourse = db.prepare('INSERT INTO courses (code, title, semester, faculty_id, active) VALUES (?, ?, ?, ?, 1)');
const enroll = db.prepare('INSERT INTO enrollments (user_id, course_id) VALUES (?, ?)');
const addLink = db.prepare(
	'INSERT INTO resources (course_id, kind, title, url, created_by, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
);
const courseSummary = [];

for (const course of courses) {
	if (seenCodes.get(course.code) !== course.file) continue; // duplicate code, reported above
	const teacher = facultyId(course.faculty);
	if (!teacher) problems.push(`courses: ${course.file} names faculty "${course.faculty}", who is not in teaching.json — added without a teacher`);
	const courseId = Number(addCourse.run(course.code, course.title, 'TRIAL', teacher ?? null).lastInsertRowid);
	const slug = course.code.replace(/\s+/g, '').toLowerCase();
	addLink.run(courseId, 'class_link', 'TRIAL class link', `https://example.com/trial-class/${slug}`, teacher ?? null, now);
	addLink.run(courseId, 'notes', 'TRIAL notes', `https://example.com/trial-notes/${slug}.pdf`, teacher ?? null, now);

	// Trial enrolments: the research scholars supervised by the course's teacher.
	const teacherName = course.faculty.replace(/^(Dr|Prof)\.?\s+/i, '').trim().toLowerCase();
	const enrolled = scholars.filter((s) => s.supervisor?.trim().toLowerCase() === teacherName);
	for (const scholar of enrolled) enroll.run(userIdByName.get(scholar.name.trim().toLowerCase()), courseId);
	courseSummary.push(`${course.code} ${course.title} — ${course.faculty || 'no teacher'} — ${enrolled.length} scholars enrolled`);
}

db.exec('COMMIT');

// ---- Report ------------------------------------------------------------------

const count = (filter) => created.filter(filter).length;
console.log(`Trial database ready: ${config.databasePath}
Password for every account: SEED_PASSWORD from server/.env (no forced change).
Links in emails will open ${config.siteUrl}${config.basePath}/… — run the website there (npm run dev:portal).

Accounts (login email = <website id>@trial.test):
  admin            admin@example.test
  faculty          ${count((p) => p.group === 'teaching')} from teaching.json, e.g. rupjyotigogoi@trial.test
  staff            ${count((p) => p.group === 'non-teaching')} from non-teaching.json, e.g. narayansharma@trial.test
  research asst.   ${count((p) => p.group === 'research-assistant')} from research-assistants.json
  scholars (PhD)   ${count((p) => p.group === 'research-scholar')} from research-scholars.json, roll numbers PHD99001… (made up), e.g. swagatbordoloi@trial.test
  pending          ${pendingPeople.map((p) => `${p.id}@trial.test`).join(', ')}

Courses (from src/content/courses):
${courseSummary.map((line) => `  ${line}`).join('\n')}

Problems found in the website data (fix these in the JSON / course files; nothing was changed there):
${problems.length ? problems.map((p) => `  - ${p}`).join('\n') : '  none'}`);
