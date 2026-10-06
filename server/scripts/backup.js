// Backs up the portal: the database and the uploaded note files.
//   npm run backup -- /var/backups/dphy-portal             one backup
//   npm run backup -- /var/backups/dphy-portal --keep 14   ... and delete all but the newest 14
//
// Safe while the API is running: the database is copied with SQLite's online
// backup (a consistent snapshot), never by copying the live file. Uploaded
// files never change once written (each has its own random name), so they are
// copied as they are. Each run makes a new folder named after the date and
// time, e.g. 2026-10-06T0230/ with portal.sqlite and uploads/ inside.
// Check a backup with `npm run backup:check -- <that folder>`.

import { DatabaseSync, backup } from 'node:sqlite';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { loadConfig } from '../src/config.js';

const BACKUP_NAME = /^\d{4}-\d{2}-\d{2}T\d{4}(-\d+)?$/; // the folders this script makes

function stop(message) {
	console.error(`Backup NOT made: ${message}`);
	process.exit(1);
}

try {
	process.loadEnvFile('.env');
} catch {
	// no .env file: real environment variables only
}
const config = loadConfig();

const [target, ...options] = process.argv.slice(2);
if (!target || target.startsWith('--')) stop('give the backup folder: npm run backup -- /var/backups/dphy-portal [--keep 14]');
let keep = null;
if (options[0] === '--keep') {
	keep = Number(options[1]);
	if (!Number.isInteger(keep) || keep < 1) stop('--keep needs a whole number of backups to keep, e.g. --keep 14');
} else if (options.length > 0) {
	stop(`unknown option ${options[0]}`);
}
if (config.databasePath === ':memory:' || !existsSync(config.databasePath)) stop(`no database at ${config.databasePath}.`);

// A new folder named after the time (UTC), e.g. 2026-10-06T0230; -2, -3 … if run twice in a minute.
const stamp = new Date().toISOString().slice(0, 16).replace(':', '');
let folder = join(target, stamp);
for (let n = 2; existsSync(folder); n++) folder = join(target, `${stamp}-${n}`);
mkdirSync(folder, { recursive: true, mode: 0o700 });

const source = new DatabaseSync(config.databasePath, { readOnly: true });
await backup(source, join(folder, 'portal.sqlite'));
source.close();
if (existsSync(config.uploadsDir)) cpSync(config.uploadsDir, join(folder, 'uploads'), { recursive: true });
else mkdirSync(join(folder, 'uploads'));
console.log(`Backup made: ${resolve(folder)}`);

if (keep) {
	const old = readdirSync(target).filter((name) => BACKUP_NAME.test(name)).sort().slice(0, -keep);
	for (const name of old) rmSync(join(target, name), { recursive: true, force: true });
	if (old.length > 0) console.log(`Deleted ${old.length} older backup(s); kept the newest ${keep}.`);
}
