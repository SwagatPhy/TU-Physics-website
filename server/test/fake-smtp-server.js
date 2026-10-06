// A tiny fake SMTP server for the mail tests, listening on 127.0.0.1 only.
// Nothing it receives goes anywhere: messages are just kept in `received`.
//
// Options: starttls (offer STARTTLS; default true), implicitTls (TLS from the
// first byte, like port 465), password (the accepted SMTP password).
// It records, for each message, whether the connection was encrypted and
// which login was used, so tests can check that a password is never sent
// unencrypted. Uses a self-signed test certificate (test/fixtures/).

import { createServer } from 'node:net';
import { TLSSocket, createServer as createTlsServer } from 'node:tls';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
export const FAKE_SMTP_CA = join(FIXTURES, 'fake-smtp-cert.pem');
const tlsOptions = { key: readFileSync(join(FIXTURES, 'fake-smtp-key.pem')), cert: readFileSync(FAKE_SMTP_CA) };

export async function startFakeSmtpServer({ starttls = true, implicitTls = false, user = 'portal', password = 'smtp-secret' } = {}) {
	const received = []; // { from, to, data, encrypted, login }
	const plainLogins = []; // logins attempted on an unencrypted connection

	function handle(socket, encrypted) {
		const session = { encrypted, login: null, from: null, to: [], inData: false, data: '' };
		let buffer = '';
		const reply = (line) => socket.write(`${line}\r\n`);

		function checkLogin(given, pass) {
			if (!session.encrypted) plainLogins.push(given);
			if (given === user && pass === password) {
				session.login = given;
				return reply('235 Authentication successful');
			}
			return reply('535 Authentication failed');
		}

		function onLine(line) {
			if (session.inData) {
				if (line === '.') {
					session.inData = false;
					received.push({ from: session.from, to: session.to, data: session.data, encrypted: session.encrypted, login: session.login });
					session.to = [];
					session.data = '';
					return reply('250 Queued');
				}
				session.data += `${line.startsWith('..') ? line.slice(1) : line}\n`;
				return;
			}
			if (session.awaitingLogin) {
				const step = session.awaitingLogin;
				const value = Buffer.from(line, 'base64').toString();
				if (step === 'user') {
					session.loginUser = value;
					session.awaitingLogin = 'pass';
					return reply(`334 ${Buffer.from('Password:').toString('base64')}`);
				}
				session.awaitingLogin = null;
				return checkLogin(session.loginUser, value);
			}
			const [command, ...rest] = line.split(' ');
			const argument = rest.join(' ');
			switch (command.toUpperCase()) {
				case 'EHLO':
				case 'HELO':
					return socket.write(
						['250-fake.smtp.test', ...(starttls && !session.encrypted ? ['250-STARTTLS'] : []), '250-AUTH PLAIN LOGIN', '250 OK']
							.map((l) => `${l}\r\n`)
							.join(''),
					);
				case 'STARTTLS': {
					if (!starttls || session.encrypted) return reply('502 Not available');
					reply('220 Ready to start TLS');
					socket.removeAllListeners('data');
					const secure = new TLSSocket(socket, { isServer: true, ...tlsOptions });
					return handle(secure, true);
				}
				case 'AUTH': {
					const [mechanism, initial] = argument.split(' ');
					if (mechanism.toUpperCase() === 'PLAIN') {
						const [, given, pass] = Buffer.from(initial ?? '', 'base64').toString().split('\u0000');
						return checkLogin(given, pass);
					}
					session.awaitingLogin = 'user';
					return reply(`334 ${Buffer.from('Username:').toString('base64')}`);
				}
				case 'MAIL':
					session.from = argument.replace(/^FROM:\s*/i, '').replace(/[<>]/g, '').split(' ')[0];
					return reply('250 OK');
				case 'RCPT':
					session.to.push(argument.replace(/^TO:\s*/i, '').replace(/[<>]/g, ''));
					return reply('250 OK');
				case 'DATA':
					session.inData = true;
					return reply('354 End data with <CR><LF>.<CR><LF>');
				case 'RSET':
				case 'NOOP':
					return reply('250 OK');
				case 'QUIT':
					reply('221 Bye');
					return socket.end();
				default:
					return reply('502 Unknown command');
			}
		}

		socket.on('data', (chunk) => {
			buffer += chunk.toString('utf8');
			let index;
			while ((index = buffer.indexOf('\r\n')) >= 0) {
				const line = buffer.slice(0, index);
				buffer = buffer.slice(index + 2);
				onLine(line);
			}
		});
		socket.on('error', () => {});
		if (!encrypted || implicitTls) reply('220 fake.smtp.test ESMTP');
	}

	const server = implicitTls
		? createTlsServer(tlsOptions, (socket) => handle(socket, true))
		: createServer((socket) => handle(socket, false));
	await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));

	return {
		port: server.address().port,
		received,
		plainLogins,
		close: () => new Promise((resolve) => server.close(resolve)),
	};
}
