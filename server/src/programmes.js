// Reads programmes.conf (which roll-number prefix belongs to which
// programme) and reads roll numbers: prefix + 2-digit joining year + 3-digit
// serial, e.g. PHP22017 (PhD, joined 2022).

import { readFileSync } from 'node:fs';

const ROLL_NUMBER = /^([A-Z]+)(\d{2})(\d{3})$/;

// Returns a Map of PREFIX -> programme name.
export function loadProgrammes(path) {
	const programmes = new Map();
	readFileSync(path, 'utf8')
		.split('\n')
		.map((line) => line.replace(/#.*/, '').trim())
		.filter(Boolean)
		.forEach((line, index) => {
			const match = line.match(/^([A-Za-z]+)\s+(.+)$/);
			if (!match) throw new Error(`${path}: can't read line ${index + 1}: "${line}"`);
			programmes.set(match[1].toUpperCase(), match[2].trim());
		});
	return programmes;
}

// Roll numbers are stored and compared trimmed and in upper case ("php22017 " -> "PHP22017").
export function normalizeRollNumber(rollNumber) {
	return String(rollNumber ?? '').trim().toUpperCase();
}

// { rollNumber, programme, batchYear } for a valid roll number, or null if the
// format is wrong or the prefix isn't in programmes.conf.
export function readRollNumber(programmes, rollNumber) {
	const clean = normalizeRollNumber(rollNumber);
	const match = clean.match(ROLL_NUMBER);
	const programme = match ? programmes.get(match[1]) : undefined;
	if (!programme) return null;
	return { rollNumber: clean, programme, batchYear: 2000 + Number(match[2]) };
}
