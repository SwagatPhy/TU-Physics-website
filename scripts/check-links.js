#!/usr/bin/env node
/**
 * Link check for the built site (run after `npm run build`: `npm run check-links`).
 *
 * The site is served from /dphy/ (astro.config.mjs `base`). For every page in
 * dist/ this checks each href, src, srcset and CSS url() that starts with "/":
 *   - it must start with /dphy/ (a bare "/people" would leave the subfolder), and
 *   - the file it points to must exist in dist/ (folders need an index.html,
 *     because Apache serves "page/" as "page/index.html").
 * External links (https:, mailto:) and #anchors are ignored.
 */
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const BASE = '/dphy/';

function htmlFiles(dir) {
	return readdirSync(dir).flatMap((name) => {
		const path = join(dir, name);
		if (statSync(path).isDirectory()) return htmlFiles(path);
		return name.endsWith('.html') ? [path] : [];
	});
}

// Root-relative URLs in attributes, srcset lists and url(...) inside inline styles/CSS.
function urlsIn(html) {
	const urls = [];
	for (const [, value] of html.matchAll(/\b(?:href|src|action|poster)="([^"]*)"/g)) urls.push(value);
	for (const [, list] of html.matchAll(/\bsrcset="([^"]*)"/g)) {
		urls.push(...list.split(',').map((entry) => entry.trim().split(/\s+/)[0]));
	}
	for (const [, value] of html.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)) urls.push(value);
	return urls.filter((url) => url.startsWith('/') && !url.startsWith('//'));
}

function existsInDist(url) {
	const path = decodeURIComponent(url.slice(BASE.length).split(/[?#]/)[0]);
	const target = join(DIST, path);
	if (path === '' || path.endsWith('/')) return existsSync(join(target, 'index.html'));
	return existsSync(target) && statSync(target).isFile();
}

const problems = [];
for (const file of htmlFiles(DIST)) {
	for (const url of new Set(urlsIn(readFileSync(file, 'utf8')))) {
		if (!url.startsWith(BASE)) problems.push(`${file}: "${url}" is missing the ${BASE} prefix`);
		else if (!existsInDist(url)) problems.push(`${file}: "${url}" points to nothing in dist/`);
	}
}

if (problems.length > 0) {
	console.error(`Link check failed (${problems.length}):\n` + problems.map((p) => `  - ${p}`).join('\n'));
	process.exit(1);
}
console.log(`Link check passed: ${htmlFiles(DIST).length} pages, all internal links under ${BASE}.`);
