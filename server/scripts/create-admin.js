// Creates an administrator account: `npm run admin:create`
// (or `npm run admin:create -- --force-change` to make them choose a new
// password at first login).
//
// For setting up a real server, so unlike the seed scripts it works with
// NODE_ENV=production. It asks for the name, the email and the password
// (twice, not shown on screen). The password is never a command-line
// argument and is never printed or logged. It writes to the database in
// DATABASE_PATH (server/.env) and nowhere else, and is safe to run while the
// API is running.

import { createInterface } from 'node:readline';
import { Writable } from 'node:stream';
import { loadConfig } from '../src/config.js';
import { openDatabase, migrate, toDbTime } from '../src/db.js';
import { hashPassword, checkNewPassword, PASSWORD_MIN_LENGTH, PASSWORD_MAX_LENGTH } from '../src/auth.js';
import { checkName, checkEmail } from '../src/validate.js';
import { logAudit } from '../src/audit.js';

function stop(message) {
	console.error(`Not created: ${message}`);
	process.exit(1);
}

const args = process.argv.slice(2);
const unknown = args.filter((arg) => arg !== '--force-change');
if (unknown.length > 0) {
	stop(`unknown option ${unknown[0]}. The only option is --force-change; the name, email and password are asked for, never given on the command line.`);
}
const forceChange = args.includes('--force-change');

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file: real environment variables only
}
const config = loadConfig();

// ---- Asking questions -------------------------------------------------------
// One reader for every answer. While a password is typed, what readline would
// echo to the screen is thrown away. (When input is piped in, as in the tests,
// nothing is echoed anyway.)

let hideTyping = false;
const screen = new Writable({
	write(chunk, encoding, done) {
		if (!hideTyping) process.stdout.write(chunk, encoding);
		done();
	},
});
const reader = createInterface({ input: process.stdin, output: screen, terminal: Boolean(process.stdin.isTTY) });
const lines = reader[Symbol.asyncIterator]();

async function ask(question, { hidden = false } = {}) {
	process.stdout.write(question);
	hideTyping = hidden;
	const { value, done } = await lines.next();
	hideTyping = false;
	if (hidden && process.stdin.isTTY) process.stdout.write('\n');
	if (done) stop('the input ended before every question was answered.');
	return value;
}

// ---- Create the account -----------------------------------------------------

console.log(`Creating an administrator in ${config.databasePath}`);
const db = openDatabase(config.databasePath);
migrate(db);

const name = checkName(await ask('Full name: '));
if (name.error) stop('that name is not valid.');
const email = checkEmail(await ask('Email: '));
if (email.error) stop('that email address is not valid.');
if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email.value)) {
	stop(`an account with ${email.value} already exists.`);
}

const password = await ask(`Password (${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} characters, not shown): `, { hidden: true });
const passwordError = checkNewPassword(password);
if (passwordError === 'password_too_short') stop(`the password must have at least ${PASSWORD_MIN_LENGTH} characters.`);
if (passwordError) stop(`the password must have at most ${PASSWORD_MAX_LENGTH} characters.`);
if ((await ask('Password again: ', { hidden: true })) !== password) stop('the two passwords are different.');
reader.close();

const id = Number(
	db
		.prepare(
			`INSERT INTO users (name, email, password_hash, role, status, active, must_change_password, created_at)
			 VALUES (?, ?, ?, 'admin', 'approved', 1, ?, ?)`,
		)
		.run(name.value, email.value, await hashPassword(password), forceChange ? 1 : 0, toDbTime(new Date())).lastInsertRowid,
);
logAudit(db, { action: 'admin_created', target: `user:${id} (command line${forceChange ? ', must change password' : ''})` });

console.log(`Administrator created: ${name.value} <${email.value}>${forceChange ? '. They must choose a new password when they first log in.' : '.'}`);
