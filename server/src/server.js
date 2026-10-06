// Starts the API: `npm start` (from the server/ folder).

import { loadConfig } from './config.js';
import { openDatabase, migrate } from './db.js';
import { createApp } from './app.js';
import { createMailer, mailConfigProblems, describeMailError } from './mail.js';

try {
	process.loadEnvFile('.env'); // optional; real environment variables win
} catch {
	// no .env file — fine
}

function refuseToStart(lines) {
	console.error(['Refusing to start:', ...lines.map((line) => `  - ${line}`)].join('\n'));
	process.exit(1);
}

const config = loadConfig();

if (config.isProduction && !config.cookieSecure) refuseToStart(['COOKIE_SECURE must be on in production.']);

// Mail: wrong settings stop the API here, with a clear message, rather than
// failing later when someone signs up.
const mailProblems = mailConfigProblems(config);
if (mailProblems.length > 0) refuseToStart(mailProblems);
const mailer = createMailer(config);
if (config.mailMode === 'smtp') {
	try {
		await mailer.verify(); // connect, encrypt and log in; sends nothing
		console.log(`Mail: sending through ${config.smtp.host}:${config.smtp.port} (${config.smtp.security}) as ${config.mailFrom}`);
	} catch (error) {
		refuseToStart([
			`can't connect to the mail server ${config.smtp.host}:${config.smtp.port} (${config.smtp.security}): ${describeMailError(error)}`,
			'Check SMTP_HOST, SMTP_PORT, SMTP_SECURE, SMTP_USER and SMTP_PASS, then try `npm run mail:test -- you@example.org`.',
		]);
	}
} else if (config.isProduction) {
	console.warn('WARNING: MAIL_MODE is outbox, so NO emails are sent (sign-up, password reset, approvals). Set MAIL_MODE=smtp.');
}

const db = openDatabase(config.databasePath);
const applied = migrate(db);
if (applied.length > 0) console.log(`Applied migrations: ${applied.join(', ')}`);

createApp({ db, config, mailer }).listen(config.port, config.host, () => {
	console.log(`Portal API listening on http://${config.host}:${config.port}${config.basePath}/api`);
	console.log(`Links in emails will open ${config.siteUrl}${config.basePath}/… (SITE_URL in server/.env)`);
});
