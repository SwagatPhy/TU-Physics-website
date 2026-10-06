// Sends one test email with the current mail settings, to check them:
//   npm run mail:test -- you@example.org
//
// For the IT cell when setting up the server. With MAIL_MODE=smtp it connects
// to SMTP_HOST, checks the encryption and login, and sends a short test
// message. (With MAIL_MODE=outbox it only writes the file, as in development.)
// The SMTP password is never printed.

import { loadConfig } from '../src/config.js';
import { createMailer, mailConfigProblems, describeMailError } from '../src/mail.js';
import { checkEmail } from '../src/validate.js';

function fail(lines) {
	console.error(['Test email NOT sent:', ...lines.map((line) => `  - ${line}`)].join('\n'));
	process.exit(1);
}

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file: real environment variables only
}
const config = loadConfig();

const to = checkEmail(process.argv[2]);
if (to.error) fail(['give the address to send to: npm run mail:test -- you@example.org']);

const problems = mailConfigProblems(config);
if (problems.length > 0) fail(problems);

const mailer = createMailer(config);
const where =
	config.mailMode === 'smtp'
		? `${config.smtp.host}:${config.smtp.port} (${config.smtp.security}${config.smtp.user ? `, login ${config.smtp.user}` : ', no login'})`
		: `the outbox folder ${config.outboxDir} (MAIL_MODE=outbox: nothing is really sent)`;
console.log(`Sending a test email from ${config.mailFrom} to ${to.value} through ${where} …`);

try {
	if (mailer.verify) await mailer.verify();
	await mailer.send({
		to: to.value,
		subject: 'Portal test email',
		text: `This is a test email from the Department of Physics portal server.\n\nIf you can read it, the mail settings work.\nSent at ${new Date().toISOString()}.\n`,
	});
} catch (error) {
	fail([describeMailError(error)]);
}
console.log('Done. Check the inbox (and the spam folder) of', to.value);
