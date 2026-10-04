// Builds the Express app. Kept separate from server.js so tests can create an
// app with an in-memory database without opening a network port themselves.

import express from 'express';
import { loadSession, requireJson } from './auth.js';
import { createLoginLimiter } from './rate-limit.js';
import { authRoutes } from './routes/auth-routes.js';

export function createApp({ db, config, loginLimiter = createLoginLimiter() }) {
	const app = express();
	app.disable('x-powered-by');
	if (config.trustProxy) app.set('trust proxy', 1);

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

	const api = express.Router();
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
