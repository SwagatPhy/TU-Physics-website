// @ts-check
import { defineConfig } from 'astro/config';

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
});
