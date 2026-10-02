// The site is served from a subfolder (https://www.tezu.ernet.in/dphy/ —
// `base` in astro.config.mjs). Every internal link and file path goes through
// withBase() so it gets that prefix:
//
//   withBase('/people')                → '/dphy/people/'
//   withBase('/Resources-files/a.pdf') → '/dphy/Resources-files/a.pdf'
//   withBase('/')                      → '/dphy/'
//
// Page links get a trailing slash (pages are built as folder/index.html, and
// Apache redirects "/dphy/people" to "/dphy/people/" anyway); file links
// (anything whose last part has a dot) don't. External links are returned as-is.

const BASE = import.meta.env.BASE_URL.replace(/\/+$/, ''); // '/dphy'

export function withBase(path: string): string {
	if (/^([a-z]+:|\/\/|#)/i.test(path)) return path; // https:, mailto:, //cdn…, #anchor

	const [, pathname, suffix] = path.match(/^([^?#]*)(.*)$/)!; // split off ?query / #hash
	let url = `${BASE}/${pathname.replace(/^\/+/, '')}`;
	const lastPart = url.split('/').pop() ?? '';
	if (!url.endsWith('/') && !lastPart.includes('.')) url += '/';
	return url + suffix;
}
