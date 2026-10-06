import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDatabase, migrate } from '../src/db.js';
import { loadProgrammes, readRollNumber } from '../src/programmes.js';
import { parseRoster, importRoster } from '../src/roster.js';

const programmes = loadProgrammes('programmes.conf');

test('roll numbers: prefix from programmes.conf + 2-digit joining year + 3-digit serial', () => {
	assert.deepEqual(readRollNumber(programmes, 'PHP22017'), { rollNumber: 'PHP22017', programme: 'PhD', batchYear: 2022 });
	assert.deepEqual(readRollNumber(programmes, ' phm24123 '), { rollNumber: 'PHM24123', programme: 'MSc', batchYear: 2024 });
	assert.deepEqual(readRollNumber(programmes, 'PHI23005'), { rollNumber: 'PHI23005', programme: 'Integrated BSc-MSc', batchYear: 2023 });
	for (const wrong of ['PHD22017', 'PHP2201', 'PHP220170', 'PHP-22017', 'PHP22-017', 'PHP 22017', 'XYZ22017', 'PHP', '22017PHP']) {
		assert.equal(readRollNumber(programmes, wrong), null, wrong);
	}
});

test('a valid roster is read, with programmes filled in', () => {
	const csv = 'email,name,roll_number,role\nA@Example.test,Asha,php22017,student\nf@example.test,"Bora, Dr",,faculty\n';
	const { rows, errors } = parseRoster(csv, programmes);
	assert.deepEqual(errors, []);
	assert.deepEqual(rows, [
		{ email: 'a@example.test', name: 'Asha', rollNumber: 'PHP22017', role: 'student', programme: 'PhD' },
		{ email: 'f@example.test', name: 'Bora, Dr', rollNumber: null, role: 'faculty', programme: null },
	]);
});

test('every problem is reported with its line number', () => {
	const csv = [
		'email,name,roll_number,role,programme',
		'not-an-email,X,PHP22001,student,',
		'b@example.test,B,XYZ123,student,',
		'c@example.test,C,,student,',
		'd@example.test,D,PHP22005,faculty,',
		'e@example.test,E,PHP22006,student,MSc',
		'f@example.test,F,PHP22007,admin,',
		'g@example.test,G,PHP22008,student,',
		'g@example.test,G2,PHP22009,student,',
	].join('\n');
	const { errors } = parseRoster(csv, programmes);
	assert.equal(errors.length, 7);
	assert.match(errors[0], /^Line 2: invalid email/);
	assert.match(errors[1], /^Line 3: .*prefix/);
	assert.match(errors[2], /^Line 4: students need a roll number/);
	assert.match(errors[3], /^Line 5: faculty rows must not have a roll number/);
	assert.match(errors[4], /^Line 6: programme "MSc" doesn't match/);
	assert.match(errors[5], /^Line 7: role must be student or faculty/);
	assert.match(errors[6], /^Line 9: email g@example.test appears twice/);
});

test('missing or unknown columns are reported', () => {
	assert.match(parseRoster('email,name,role\n', programmes).errors[0], /missing column "roll_number"/);
	assert.match(parseRoster('email,name,roll_number,role,password\n', programmes).errors[0], /unknown column "password"/);
});

test('importing never overwrites people already on the roster', () => {
	const db = openDatabase(':memory:');
	migrate(db);
	const first = parseRoster('email,name,roll_number,role\na@example.test,A,PHP22001,student\n', programmes).rows;
	assert.deepEqual(importRoster(db, first), { added: ['a@example.test'], skipped: [] });
	const again = parseRoster('email,name,roll_number,role\na@example.test,Changed,PHP22001,student\nb@example.test,B,PHP22002,student\n', programmes).rows;
	assert.deepEqual(importRoster(db, again), { added: ['b@example.test'], skipped: ['a@example.test'] });
	assert.equal(db.prepare('SELECT name FROM roster WHERE email = ?').get('a@example.test').name, 'A');
});
