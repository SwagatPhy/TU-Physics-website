// @ts-check
import { defineConfig } from 'astro/config';
import { request as httpRequest } from 'node:http';

// Development only: `npm run dev` forwards /dphy/api/… to the portal API
// (server/, started separately with `npm start` there), so the portal pages
// talk to the API on the same origin, as they will on the live site (where a
// web-server rule does this). Must match PORT in server/.env.
const PORTAL_API = { host: 'localhost', port: 4400 };

/** @param {import('node:http').IncomingMessage} req @param {import('node:http').ServerResponse} res @param {() => void} next */
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

/** @type {import('vite').Plugin} */
const portalDevProxy = {
	name: 'portal-dev-proxy',
	apply: 'serve',
	// Astro puts its own dev middlewares (base path, trailing slash) at the very
	// front of the stack in a post-setup step, and those answer /dphy/api/… with
	// a 404. Running our own post-setup step after Astro's puts the proxy ahead of them.
	configureServer(server) {
		return () => {
			server.middlewares.stack.unshift({ route: '', handle: forwardToPortalApi });
		};
	},
};

// https://astro.build/config
export default defineConfig({
	// Live at https://www.tezu.ernet.in/dphy/ — a subfolder of the university's
	// Apache server, uploaded as plain static files (dist/ → /dphy/).
	site: 'https://www.tezu.ernet.in',
	base: '/dphy',
	// Pages are built as folder/index.html; Apache serves them at ".../page/".
	// Links in src/ get the base and trailing slash from withBase() (src/lib/url.ts).
	trailingSlash: 'always',
	build: { format: 'directory' },
	vite: { plugins: [portalDevProxy] },
});
