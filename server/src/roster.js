// The roster: who may register. Uploaded by the admin as CSV (for the trial,
// with `npm run roster:import -- file.csv`; an admin page comes in Phase 4).
//
// CSV columns (header row required, any order):
//   email, name, roll_number, role[, programme]
// - role is "student" or "faculty" (faculty and staff register by email only).
// - students need a roll number whose prefix is in programmes.conf; the
//   programme is worked out from it. If a programme column is given it must agree.
// - faculty rows leave roll_number empty.
// No passwords: people set their own when they register.

import { toDbTime } from './db.js';
import { normalizeRollNumber, programmeForRollNumber } from './programmes.js';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COLUMNS = ['email', 'name', 'roll_number', 'role', 'programme'];

// Splits one CSV line into fields; supports "quoted, fields" and "" escapes.
function splitCsvLine(line) {
	const fields = [];
	let field = '';
	let quoted = false;
	for (let i = 0; i < line.length; i++) {
		const char = line[i];
		if (quoted && char === '"' && line[i + 1] === '"') {
			field += '"';
			i++;
		} else if (char === '"') {
			quoted = !quoted;
		} else if (char === ',' && !quoted) {
			fields.push(field);
			field = '';
		} else {
			field += char;
		}
	}
	fields.push(field);
	return fields.map((value) => value.trim());
}

// Checks a whole roster file. Returns { rows, errors }; `errors` lists every
// problem with its line number, and nothing should be imported unless it's empty.
export function parseRoster(csvText, programmes) {
	const lines = csvText.replace(/^﻿/, '').split(/\r?\n/);
	const header = splitCsvLine(lines[0] ?? '').map((name) => name.toLowerCase());
	const errors = [];

	for (const required of ['email', 'name', 'roll_number', 'role']) {
		if (!header.includes(required)) errors.push(`Line 1: missing column "${required}"`);
	}
	for (const name of header) {
		if (!COLUMNS.includes(name)) errors.push(`Line 1: unknown column "${name}"`);
	}
	if (errors.length > 0) return { rows: [], errors };

	const rows = [];
	const seenEmails = new Set();
	const seenRollNumbers = new Set();

	lines.slice(1).forEach((line, index) => {
		const lineNumber = index + 2;
		if (!line.trim()) return;
		const values = splitCsvLine(line);
		const field = (name) => values[header.indexOf(name)] ?? '';

		const email = field('email').toLowerCase();
		const name = field('name');
		const role = field('role').toLowerCase();
		const rollNumber = normalizeRollNumber(field('roll_number'));
		const problems = [];

		if (!EMAIL_PATTERN.test(email) || email.length > 254) problems.push(`invalid email "${field('email')}"`);
		else if (seenEmails.has(email)) problems.push(`email ${email} appears twice`);
		if (!name) problems.push('name is empty');
		if (!['student', 'faculty'].includes(role)) problems.push(`role must be student or faculty, not "${field('role')}"`);

		let programme = null;
		if (role === 'student') {
			programme = programmeForRollNumber(programmes, rollNumber);
			if (!rollNumber) problems.push('students need a roll number');
			else if (!programme) problems.push(`roll number "${rollNumber}" doesn't start with a prefix from programmes.conf`);
			else if (seenRollNumbers.has(rollNumber)) problems.push(`roll number ${rollNumber} appears twice`);
			const given = field('programme');
			if (programme && given && given.toLowerCase() !== programme.toLowerCase()) {
				problems.push(`programme "${given}" doesn't match roll number ${rollNumber} (${programme})`);
			}
		} else if (role === 'faculty' && rollNumber) {
			problems.push('faculty rows must not have a roll number');
		}

		if (problems.length > 0) {
			errors.push(`Line ${lineNumber}: ${problems.join('; ')}`);
			return;
		}
		seenEmails.add(email);
		if (rollNumber) seenRollNumbers.add(rollNumber);
		rows.push({ email, name, rollNumber: rollNumber || null, role, programme });
	});

	return { rows, errors };
}

// Adds new roster rows. People already on the roster (same email or roll
// number) are left as they are and reported back, never overwritten.
export function importRoster(db, rows) {
	const added = [];
	const skipped = [];
	const exists = db.prepare('SELECT 1 FROM roster WHERE email = ? OR (roll_number IS NOT NULL AND roll_number = ?)');
	const insert = db.prepare(
		`INSERT INTO roster (email, name, roll_number, role, programme, claimed, created_at)
		 VALUES (?, ?, ?, ?, ?, 0, ?)`,
	);
	const now = toDbTime(new Date());

	db.exec('BEGIN');
	try {
		for (const row of rows) {
			if (exists.get(row.email, row.rollNumber)) {
				skipped.push(row.email);
				continue;
			}
			insert.run(row.email, row.name, row.rollNumber, row.role, row.programme, now);
			added.push(row.email);
		}
		db.exec('COMMIT');
	} catch (error) {
		db.exec('ROLLBACK');
		throw error;
	}
	return { added, skipped };
}
