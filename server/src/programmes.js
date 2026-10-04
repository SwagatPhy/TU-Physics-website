// Reads programmes.conf: which roll-number prefix belongs to which programme.

import { readFileSync } from 'node:fs';

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

// Roll numbers are compared in upper case without spaces ("phd 22017" -> "PHD22017").
export function normalizeRollNumber(rollNumber) {
	return String(rollNumber ?? '').replace(/\s+/g, '').toUpperCase();
}

// The programme for a roll number (prefix + digits), or null if the format or
// prefix isn't known.
export function programmeForRollNumber(programmes, rollNumber) {
	const match = normalizeRollNumber(rollNumber).match(/^([A-Z]+)(\d+)$/);
	return match ? (programmes.get(match[1]) ?? null) : null;
}
