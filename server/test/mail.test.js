// MAIL_MODE=smtp, tested only against a fake SMTP server on 127.0.0.1
// (test/fake-smtp-server.js). Nothing is ever really sent.

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadConfig } from '../src/config.js';
import { createMailer, mailConfigProblems } from '../src/mail.js';
import { startFakeSmtpServer, FAKE_SMTP_CA } from './fake-smtp-server.js';

const SERVER_DIR = join(dirname(fileURLToPath(import.meta.url)), '..');
const PASSWORD = 'smtp-secret';

function smtpEnv(port, extra = {}) {
	return {
		MAIL_MODE: 'smtp',
		MAIL_FROM: 'portal@example.test',
		SMTP_HOST: '127.0.0.1',
		SMTP_PORT: String(port),
		SMTP_USER: 'portal',
		SMTP_PASS: PASSWORD,
		SMTP_CA_FILE: FAKE_SMTP_CA,
		...extra,
	};
}

// Runs fn while collecting everything written to the console.
async function captureConsole(fn) {
	const lines = [];
	const saved = { log: console.log, error: console.error, warn: console.warn };
	for (const name of Object.keys(saved)) console[name] = (...args) => lines.push(args.join(' '));
	try {
		await fn();
	} catch {
		// the caller checks what happened
	} finally {
		Object.assign(console, saved);
	}
	return lines.join('\n');
}

describe('sending email through SMTP', () => {
	test('STARTTLS (the default): the email arrives, and the login happens only after encryption', async () => {
		const smtp = await startFakeSmtpServer();
		try {
			const mailer = createMailer(loadConfig(smtpEnv(smtp.port)));
			await mailer.send({ to: 'someone@example.test', subject: 'Hello', text: 'Line one\n.starts with a dot' });
			assert.equal(smtp.received.length, 1);
			const [message] = smtp.received;
			assert.equal(message.encrypted, true);
			assert.equal(message.login, 'portal');
			assert.equal(message.from, 'portal@example.test');
			assert.deepEqual(message.to, ['someone@example.test']);
			assert.match(message.data, /Subject: Hello/);
			assert.match(message.data, /\.starts with a dot/);
			assert.deepEqual(smtp.plainLogins, []);
		} finally {
			await smtp.close();
		}
	});

	test('TLS from the start (SMTP_SECURE=tls) works too', async () => {
		const smtp = await startFakeSmtpServer({ implicitTls: true });
		try {
			await createMailer(loadConfig(smtpEnv(smtp.port, { SMTP_SECURE: 'tls' }))).send({ to: 'a@example.test', subject: 'x', text: 'y' });
			assert.equal(smtp.received[0].encrypted, true);
		} finally {
			await smtp.close();
		}
	});

	test('a server that cannot encrypt is refused: nothing sent, the password never sent', async () => {
		const smtp = await startFakeSmtpServer({ starttls: false });
		try {
			const mailer = createMailer(loadConfig(smtpEnv(smtp.port)));
			const output = await captureConsole(() => mailer.send({ to: 'a@example.test', subject: 'x', text: 'y' }));
			assert.match(output, /NOT sent: ETLS/);
			assert.equal(smtp.received.length, 0);
			assert.deepEqual(smtp.plainLogins, []);
		} finally {
			await smtp.close();
		}
	});

	test('a certificate the system does not trust is refused (no SMTP_CA_FILE)', async () => {
		const smtp = await startFakeSmtpServer();
		try {
			const mailer = createMailer(loadConfig(smtpEnv(smtp.port, { SMTP_CA_FILE: '' })));
			await assert.rejects(mailer.send({ to: 'a@example.test', subject: 'x', text: 'y' }));
			assert.equal(smtp.received.length, 0);
		} finally {
			await smtp.close();
		}
	});

	test('unencrypted sending only when SMTP_SECURE=none is set explicitly', async () => {
		const smtp = await startFakeSmtpServer({ starttls: false });
		try {
			const config = loadConfig(smtpEnv(smtp.port, { SMTP_SECURE: 'none', SMTP_USER: '', SMTP_PASS: '' }));
			await createMailer(config).send({ to: 'a@example.test', subject: 'x', text: 'y' });
			assert.equal(smtp.received[0].encrypted, false);
		} finally {
			await smtp.close();
		}
	});

	test('a wrong password fails, and the password never appears in the logs', async () => {
		const smtp = await startFakeSmtpServer();
		try {
			const wrong = 'not-the-right-smtp-password';
			const mailer = createMailer(loadConfig(smtpEnv(smtp.port, { SMTP_PASS: wrong })));
			const output = await captureConsole(() => mailer.send({ to: 'a@example.test', subject: 'x', text: 'y' }));
			assert.match(output, /NOT sent/);
			assert.ok(!output.includes(wrong));
			assert.ok(!output.includes(Buffer.from(wrong).toString('base64')));
			assert.equal(smtp.received.length, 0);
		} finally {
			await smtp.close();
		}
	});
});

describe('mail settings are checked', () => {
	const problems = (env) => mailConfigProblems(loadConfig({ MAIL_MODE: 'smtp', SMTP_HOST: 'mail.example.test', ...env }));

	test('good settings, and outbox (the default) need nothing else', () => {
		assert.deepEqual(problems({}), []);
		assert.deepEqual(mailConfigProblems(loadConfig({})), []);
		assert.equal(loadConfig({}).mailMode, 'outbox');
	});

	test('missing host, bad port, unknown security, half a login, bad sender, unknown mode', () => {
		assert.match(problems({ SMTP_HOST: '' }).join(), /SMTP_HOST is empty/);
		assert.match(problems({ SMTP_PORT: '99999' }).join(), /SMTP_PORT/);
		assert.match(problems({ SMTP_SECURE: 'maybe' }).join(), /SMTP_SECURE/);
		assert.match(problems({ SMTP_USER: 'portal' }).join(), /both SMTP_USER and SMTP_PASS/);
		assert.match(problems({ MAIL_FROM: 'not an address' }).join(), /MAIL_FROM/);
		assert.match(problems({ SMTP_CA_FILE: '/no/such/file.pem' }).join(), /SMTP_CA_FILE/);
		assert.match(mailConfigProblems(loadConfig({ MAIL_MODE: 'smpt' })).join(), /MAIL_MODE/);
	});

	test('the API refuses to start with broken SMTP settings, and says why', () => {
		const run = spawnSync(process.execPath, ['--disable-warning=ExperimentalWarning', 'src/server.js'], {
			cwd: SERVER_DIR,
			encoding: 'utf8',
			env: { ...process.env, DATABASE_PATH: ':memory:', MAIL_MODE: 'smtp', SMTP_HOST: '', SMTP_PASS: PASSWORD },
			timeout: 10_000,
		});
		assert.equal(run.status, 1);
		assert.match(run.stderr, /Refusing to start/);
		assert.match(run.stderr, /SMTP_HOST is empty/);
		assert.ok(!run.stderr.includes(PASSWORD) && !run.stdout.includes(PASSWORD));
	});

	test('the API refuses to start when it cannot reach the mail server', async () => {
		const smtp = await startFakeSmtpServer({ starttls: false }); // can't encrypt
		try {
			const run = await spawnAsync(['src/server.js'], { DATABASE_PATH: ':memory:', PORT: '0', ...smtpEnv(smtp.port) }).done;
			assert.equal(run.status, 1);
			assert.match(run.stderr, /can't connect to the mail server/);
			assert.ok(!run.stderr.includes(PASSWORD));
		} finally {
			await smtp.close();
		}
	});
});

// Like spawnSync, but lets this process keep serving the fake SMTP server meanwhile.
function spawnAsync(args, env) {
	const child = spawn(process.execPath, ['--disable-warning=ExperimentalWarning', ...args], { cwd: SERVER_DIR, env: { ...process.env, ...env } });
	let stdout = '';
	let stderr = '';
	child.stdout.on('data', (chunk) => (stdout += chunk));
	child.stderr.on('data', (chunk) => (stderr += chunk));
	const timer = setTimeout(() => child.kill(), 15_000);
	child.done = new Promise((resolve) =>
		child.on('close', (status) => {
			clearTimeout(timer);
			resolve({ status, stdout, stderr });
		}),
	);
	return child;
}

describe('npm run mail:test', () => {
	test('sends one test email through the configured server', async () => {
		const smtp = await startFakeSmtpServer();
		try {
			const run = await spawnAsync(['scripts/mail-test.js', 'it.cell@example.test'], smtpEnv(smtp.port)).done;
			assert.equal(run.status, 0, run.stderr);
			assert.match(run.stdout, /Done/);
			assert.equal(smtp.received.length, 1);
			assert.deepEqual(smtp.received[0].to, ['it.cell@example.test']);
			assert.match(smtp.received[0].data, /Subject: Portal test email/);
			assert.ok(!(run.stdout + run.stderr).includes(PASSWORD));
		} finally {
			await smtp.close();
		}
	});

	test('explains what is wrong instead of sending', async () => {
		const noAddress = await spawnAsync(['scripts/mail-test.js'], smtpEnv(1)).done;
		assert.equal(noAddress.status, 1);
		assert.match(noAddress.stderr, /give the address/);

		const badSettings = await spawnAsync(['scripts/mail-test.js', 'a@example.test'], smtpEnv(1, { SMTP_SECURE: 'maybe' })).done;
		assert.equal(badSettings.status, 1);
		assert.match(badSettings.stderr, /SMTP_SECURE/);
	});
});
