// Sending email. A mailer is any object with `send({ to, subject, text })`.
//
// MAIL_MODE=outbox (default, development): each email is written as a text file
// to OUTBOX_DIR, so registration and password reset can be tried without a mail
// server — open the newest file and copy the link.
// MAIL_MODE=smtp: not built yet. It needs the university's SMTP host, port and
// login, which IT hasn't provided; the server refuses to start in this mode.

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { randomBytes } from 'node:crypto';

export function createMailer(config) {
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
	throw new Error(`MAIL_MODE "${config.mailMode}" isn't available yet. Use MAIL_MODE=outbox for the trial.`);
}
