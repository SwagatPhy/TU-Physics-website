// Sending email. A mailer is any object with `send({ to, subject, text })`.
//
// MAIL_MODE=outbox (default, development): each email is written as a text file
// to OUTBOX_DIR, so registration and password reset can be tried without a mail
// server — open the newest file and copy the link. Nothing is ever sent.
// MAIL_MODE=smtp: sent through the mail server in SMTP_HOST (nodemailer).
// The connection must be encrypted (STARTTLS or TLS, certificate checked)
// unless SMTP_SECURE=none is set on purpose. The SMTP password is never logged.

import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';
import nodemailer from 'nodemailer';

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const SECURITY_MODES = ['starttls', 'tls', 'none'];

// Problems with the mail settings, as sentences for the person setting up the
// server (empty if everything is fine). Never includes the password.
export function mailConfigProblems(config) {
	const problems = [];
	if (!['outbox', 'smtp'].includes(config.mailMode)) {
		problems.push(`MAIL_MODE is "${config.mailMode}"; it must be "smtp" (real sending) or "outbox" (development).`);
	}
	if (!EMAIL_PATTERN.test(config.mailFrom)) problems.push(`MAIL_FROM "${config.mailFrom}" is not an email address.`);
	if (config.mailMode !== 'smtp') return problems;

	const { host, port, security, user, password, caFile } = config.smtp;
	if (!host) problems.push('SMTP_HOST is empty: set it to the mail server name IT gave you.');
	if (!Number.isInteger(port) || port < 1 || port > 65535) problems.push(`SMTP_PORT "${port}" is not a port number.`);
	if (!SECURITY_MODES.includes(security)) {
		problems.push(`SMTP_SECURE is "${security}"; it must be starttls (default), tls or none.`);
	}
	if (Boolean(user) !== Boolean(password)) problems.push('Set both SMTP_USER and SMTP_PASS, or neither (a server that needs no login).');
	if (caFile) {
		try {
			readFileSync(caFile);
		} catch {
			problems.push(`SMTP_CA_FILE "${caFile}" can't be read.`);
		}
	}
	return problems;
}

// The nodemailer transport for MAIL_MODE=smtp (settings already checked).
export function createSmtpTransport(config) {
	const { host, port, security, user, password, caFile } = config.smtp;
	return nodemailer.createTransport({
		host,
		port,
		secure: security === 'tls', // TLS from the start
		requireTLS: security === 'starttls', // refuse to continue if the server can't upgrade to TLS
		ignoreTLS: security === 'none',
		auth: user ? { user, pass: password } : undefined,
		tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true, ...(caFile ? { ca: readFileSync(caFile) } : {}) },
		connectionTimeout: 10_000,
		greetingTimeout: 10_000,
		socketTimeout: 30_000,
		logger: false, // nodemailer's own logging could include the login exchange
		debug: false,
	});
}

// A short, safe description of a sending error (no server dialogue, no credentials).
export function describeMailError(error) {
	return [error.code, error.responseCode, error.message?.split('\n')[0]].filter(Boolean).join(' ');
}

export function createMailer(config) {
	const problems = mailConfigProblems(config);
	if (problems.length > 0) throw new Error(`Mail settings: ${problems.join(' ')}`);

	if (config.mailMode === 'outbox') {
		return {
			async send({ to, subject, text }) {
				mkdirSync(config.outboxDir, { recursive: true });
				const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(3).toString('hex')}.txt`;
				const file = join(config.outboxDir, name);
				writeFileSync(file, `From: ${config.mailFrom}\nTo: ${to}\nSubject: ${subject}\n\n${text}\n`);
				console.log(`[mail] email to ${to} written to ${file}`);
			},
		};
	}

	const transport = createSmtpTransport(config);
	return {
		async send({ to, subject, text }) {
			try {
				await transport.sendMail({ from: config.mailFrom, to, subject, text });
				console.log(`[mail] email to ${to} sent`);
			} catch (error) {
				console.error(`[mail] email to ${to} NOT sent: ${describeMailError(error)}`);
				throw error;
			}
		},
		// Connects and logs in without sending anything (used at start-up and by mail:test).
		verify: () => transport.verify(),
	};
}
