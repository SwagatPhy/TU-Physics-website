// Starts the API: `npm start` (from the server/ folder).

import { loadConfig } from './config.js';
import { openDatabase, migrate } from './db.js';
import { createApp } from './app.js';
import { loadProgrammes } from './programmes.js';

try {
	process.loadEnvFile('.env'); // optional; real environment variables win
} catch {
	// no .env file — fine
}

const config = loadConfig();
const db = openDatabase(config.databasePath);
const applied = migrate(db);
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(', ')}`);

if (config.isProduction && !config.cookieSecure) {
	console.error('Refusing to start: COOKIE_SECURE must be on in production.');
	process.exit(1);
}
loadProgrammes(config.programmesFile); // fail at start-up, not mid-request, if programmes.conf is broken

createApp({ db, config }).listen(config.port, () => {
	console.log(`Portal API listening on http://localhost:${config.port}${config.basePath}/api`);
});
