// Development only: makes `npm run dev` forward /dphy/api/… to the portal API
// (server/, started separately with `npm start` in that folder), so the portal
// pages talk to the API on the same origin, as they will on the live site
// (where a web-server rule does this job). Used in astro.config.mjs.

import { request as httpRequest } from 'node:http';

// Must match HOST and PORT in server/.env.
const PORTAL_API = { host: '127.0.0.1', port: 4400 };

function forwardToPortalApi(req, res, next) {
	if (!req.url?.startsWith('/dphy/api/')) return next();
	const forward = httpRequest({ ...PORTAL_API, path: req.url, method: req.method, headers: req.headers }, (apiResponse) => {
		res.writeHead(apiResponse.statusCode ?? 502, apiResponse.headers);
		apiResponse.pipe(res);
	});
	// API not running: answer 503 JSON, which the pages show as "portal not available".
	forward.on('error', () => {
		res.writeHead(503, { 'Content-Type': 'application/json' });
		res.end('{"error":"unavailable"}');
	});
	req.pipe(forward);
}

// A Vite plugin. Astro puts its own dev middlewares (base path, trailing slash)
// at the very front of the stack in a post-setup step, and those would answer
// /dphy/api/… with a 404. Running our post-setup step after Astro's puts the
// proxy ahead of them.
export const portalDevProxy = {
	name: 'portal-dev-proxy',
	apply: 'serve',
	configureServer(server) {
		return () => {
			server.middlewares.stack.unshift({ route: '', handle: forwardToPortalApi });
		};
	},
};
