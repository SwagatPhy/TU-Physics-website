// Creates or updates the database schema: `npm run migrate`.

import { loadConfig } from '../src/config.js';
import { openDatabase, migrate } from '../src/db.js';

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file — fine
}

const config = loadConfig();
const applied = migrate(openDatabase(config.databasePath));
console.log(applied.length > 0 ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
