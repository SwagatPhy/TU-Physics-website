// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
// Development only: forwards /dphy/api/ to the portal API (see the file).
import { portalDevProxy } from './scripts/portal-dev-proxy.mjs';

// The Student/Faculty Portal is switched on by one build-time setting,
// PUBLIC_PORTAL_ENABLED=true (`npm run dev:portal`, `npm run build:portal`).
// Off by default: a normal build has no portal pages and no Login/Register
// buttons, so the public site can go live before the portal API is hosted.
// (src/lib/portal-enabled.ts reads the same setting for the header.)
// loadEnv reads the environment (e.g. `PUBLIC_PORTAL_ENABLED=true astro build`) and any .env file.
const { PUBLIC_PORTAL_ENABLED } = loadEnv('', '.', '');
const portalEnabled = PUBLIC_PORTAL_ENABLED === 'true';

// The portal pages live in src/portal-pages/ (not src/pages/), so they are
// only built when the portal is on.
const portalRoutes = {
	'/login': './src/portal-pages/login.astro',
	'/register': './src/portal-pages/register.astro',
	'/forgot-password': './src/portal-pages/forgot-password.astro',
	'/change-password': './src/portal-pages/change-password.astro',
	'/portal': './src/portal-pages/portal.astro',
	'/faculty': './src/portal-pages/faculty.astro',
	'/admin/approvals': './src/portal-pages/admin/approvals.astro',
	'/admin/offerings': './src/portal-pages/admin/offerings.astro',
};

/** @type {import('astro').AstroIntegration} */
const portalPages = {
	name: 'portal-pages',
	hooks: {
		'astro:config:setup': ({ injectRoute }) => {
			if (!portalEnabled) return;
			for (const [pattern, entrypoint] of Object.entries(portalRoutes)) injectRoute({ pattern, entrypoint });
		},
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
	integrations: [portalPages],
	vite: { plugins: [portalDevProxy] },
});
