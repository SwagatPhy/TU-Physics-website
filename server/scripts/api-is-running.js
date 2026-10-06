// Used by the seed scripts: is something (normally the portal API) listening
// on this port? Resetting the database while the API runs leaves the API
// writing to the deleted file, so the seed scripts refuse in that case.

import { createConnection } from 'node:net';

export function apiIsRunning(port, host = '127.0.0.1') {
	return new Promise((resolve) => {
		const socket = createConnection({ port, host });
		const finish = (running) => {
			socket.destroy();
			resolve(running);
		};
		socket.once('connect', () => finish(true));
		socket.once('error', () => finish(false));
		socket.setTimeout(1000, () => finish(false));
	});
}

export async function refuseIfApiRunning(port) {
	if (await apiIsRunning(port)) {
		console.error(
			`Refusing to seed: the portal API is running on port ${port}.\n` +
				'Stop it first (Ctrl+C in its terminal), run this command again, then start the API again (npm start).',
		);
		process.exit(1);
	}
}
