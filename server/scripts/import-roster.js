// Adds people to the registration roster from a CSV file:
//   npm run roster:import -- path/to/roster.csv
// See src/roster.js for the columns. Nothing is imported if any line has a problem.

import { readFileSync } from 'node:fs';
import { loadConfig } from '../src/config.js';
import { openDatabase, migrate } from '../src/db.js';
import { loadProgrammes } from '../src/programmes.js';
import { parseRoster, importRoster } from '../src/roster.js';

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file — fine
}

const file = process.argv[2];
if (!file) {
	console.error('Usage: npm run roster:import -- path/to/roster.csv');
	process.exit(1);
}

const config = loadConfig();
const { rows, errors } = parseRoster(readFileSync(file, 'utf8'), loadProgrammes(config.programmesFile));
if (errors.length > 0) {
	console.error(`Nothing imported. Fix these lines in ${file}:\n` + errors.map((e) => `  - ${e}`).join('\n'));
	process.exit(1);
}

const db = openDatabase(config.databasePath);
migrate(db);
const { added, skipped } = importRoster(db, rows);
console.log(`Added ${added.length} people to the roster.`);
if (skipped.length > 0) console.log(`Already on the roster, left unchanged (${skipped.length}): ${skipped.join(', ')}`);
