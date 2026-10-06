// Builds the Express app. Kept separate from server.js so tests can create an
// app with an in-memory database without opening a network port themselves.

import express from 'express';
import { loadSession, requireJson } from './auth.js';
import { databaseFileIdentity } from './db.js';
import { createLoginLimiter } from './rate-limit.js';
import { createMailer } from './mail.js';
import { authRoutes } from './routes/auth-routes.js';
import { registerRoutes } from './routes/register-routes.js';
import { studentRoutes } from './routes/student-routes.js';
import { facultyRoutes } from './routes/faculty-routes.js';
import { adminRoutes } from './routes/admin-routes.js';
import { filesRoutes } from './routes/files-routes.js';
import { loadProgrammes } from './programmes.js';

export function createApp({
	db,
	config,
	loginLimiter = createLoginLimiter(),
	// Registration / reset emails: at most 3 per address per 15 minutes.
	linkRequestLimiter = createLoginLimiter({ maxFailuresPerAccount: 3 }),
	mailer = createMailer(config),
	programmes = loadProgrammes(config.programmesFile), // roll-number prefix -> programme
	// Called when the database file is found deleted or replaced (see below).
	onDatabaseReplaced = () => process.exit(1),
}) {
	const app = express();
	app.disable('x-powered-by');

	// If the database file is deleted or replaced while the API runs (a reset,
	// a restore), SQLite would keep writing to the old file nobody can see any
	// more. Check on every request; if it changed, refuse the request, say why,
	// and stop the API so it is restarted on the right file.
	const startupIdentity = databaseFileIdentity(config.databasePath);
	let replaced = false;
	app.use((req, res, next) => {
		if (!replaced && databaseFileIdentity(config.databasePath) === startupIdentity) return next();
		if (!replaced) {
			replaced = true;
			console.error(
				`[database] ${config.databasePath} was deleted or replaced while the API was running. ` +
					'Stopping now so no data goes to the old file. Start the API again (npm start).',
			);
		}
		res.on('finish', onDatabaseReplaced);
		res.status(503).json({ error: 'database_replaced' });
	});
	if (config.trustProxy) app.set('trust proxy', 1);

	// Work done after the response has been sent (roster lookups and emails, so
	// they can't affect response timing). Tests wait for it with
	// app.locals.backgroundWorkDone().
	const pending = new Set();
	function runInBackground(task) {
		const work = Promise.resolve()
			.then(task)
			.catch((error) => console.error('[background]', error))
			.finally(() => pending.delete(work));
		pending.add(work);
	}
	app.locals.backgroundWorkDone = () => Promise.all([...pending]);

	// Basic security headers for an API that only ever returns JSON.
	// (Full helmet/CSP setup is part of Phase 5 hardening.)
	app.use((req, res, next) => {
		res.set({
			'X-Content-Type-Options': 'nosniff',
			'Referrer-Policy': 'no-referrer',
			'Cache-Control': 'no-store',
			'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
		});
		next();
	});

	// Development check: the dev proxy passes on the address the browser used
	// (Host). If that isn't SITE_URL, links in emails would open the wrong
	// place, so say so in the log. (Links are never built from Host itself:
	// a forged Host header could otherwise redirect someone's reset link.)
	if (config.isDevelopment) {
		let warned = false;
		const expectedHost = new URL(config.siteUrl).host;
		app.use((req, res, next) => {
			const usedHost = req.get('host');
			if (!warned && usedHost && usedHost !== expectedHost && !usedHost.endsWith(`:${config.port}`)) {
				warned = true;
				console.warn(
					`[config] The website is being used at http://${usedHost} but SITE_URL is ${config.siteUrl}. ` +
						'Links in emails will point to the wrong place: set SITE_URL in server/.env and restart the API.',
				);
			}
			next();
		});
	}

	const api = express.Router();
	// Notes carry an uploaded file as base64 inside the JSON (a third larger
	// than the file), so /notes accepts bodies up to that size; a bigger body
	// gets the same file_too_large answer as a too-large file. Everything else
	// stays small.
	const largestNoteBody = Math.ceil((config.maxUploadBytes * 4) / 3) + 64 * 1024;
	api.use('/notes', express.json({ limit: largestNoteBody }), (error, req, res, next) =>
		error.type === 'entity.too.large' ? res.status(413).json({ error: 'file_too_large' }) : next(error),
	);
	api.use(express.json({ limit: '10kb' }));
	api.use(requireJson);
	api.use(loadSession(db, config));

	api.get('/health', (req, res) => {
		try {
			db.prepare('SELECT 1').get();
			res.json({ status: 'ok' });
		} catch {
			res.status(503).json({ status: 'database_unavailable' });
		}
	});

	api.use(authRoutes({ db, config, loginLimiter }));
	api.use(registerRoutes({ db, config, programmes, mailer, loginLimiter, linkRequestLimiter, runInBackground }));
	api.use(studentRoutes({ db }));
	api.use(facultyRoutes({ db, config }));
	api.use(filesRoutes({ db, config }));
	api.use(adminRoutes({ db, config, programmes, mailer, runInBackground }));

	api.use((req, res) => res.status(404).json({ error: 'not_found' }));

	app.use(`${config.basePath}/api`, api);
	app.use((req, res) => res.status(404).json({ error: 'not_found' }));

	// Last-resort error handler: log the detail on the server, never send it.
	app.use((error, req, res, next) => {
		if (error.type === 'entity.parse.failed') return res.status(400).json({ error: 'invalid_json' });
		if (error.type === 'entity.too.large') return res.status(413).json({ error: 'request_too_large' });
		console.error(error);
		res.status(500).json({ error: 'server_error' });
	});

	return app;
}
