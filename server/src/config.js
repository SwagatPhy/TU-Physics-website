// All settings come from environment variables (or server/.env, loaded by
// server.js). Copy .env.example to .env for local development.

function readBoolean(value, fallback) {
	if (value === undefined || value === '') return fallback;
	return ['1', 'true', 'yes'].includes(value.toLowerCase());
}

function readNumber(value, fallback) {
	const number = Number(value);
	return value === undefined || value === '' || Number.isNaN(number) ? fallback : number;
}

export function loadConfig(env = process.env) {
	const isProduction = env.NODE_ENV === 'production';
	return {
		isProduction,
		isDevelopment: env.NODE_ENV === 'development', // as set in .env.example
		port: readNumber(env.PORT, 4400),
		// Path of the SQLite database file (":memory:" for tests).
		databasePath: env.DATABASE_PATH || 'data/portal.sqlite',
		// The public site lives under /dphy/; the API is mounted at <basePath>/api.
		basePath: (env.BASE_PATH ?? '/dphy').replace(/\/+$/, ''),
		// Secure cookies need HTTPS. Only turn this off for local http:// development.
		cookieSecure: readBoolean(env.COOKIE_SECURE, true),
		// Set when the API runs behind a reverse proxy (Apache/nginx) so the
		// client IP used for rate limiting is the visitor's, not the proxy's.
		trustProxy: readBoolean(env.TRUST_PROXY, false),
		sessionIdleHours: readNumber(env.SESSION_IDLE_HOURS, 8),
		sessionMaxDays: readNumber(env.SESSION_MAX_DAYS, 7),
		// Roll-number prefix -> programme (see programmes.conf).
		programmesFile: env.PROGRAMMES_FILE || 'programmes.conf',
		// Address of the public website, used to build the links in emails
		// (e.g. https://www.tezu.ernet.in); basePath is added after it.
		siteUrl: (env.SITE_URL || 'http://localhost:4331').replace(/\/+$/, ''),
		// Registration and password-reset links stop working after this long.
		linkMinutes: readNumber(env.LINK_MINUTES, 30),
		// "outbox": write emails to files in outboxDir (development; no SMTP needed).
		// "smtp": real sending — not built yet; needs the university's SMTP details.
		mailMode: env.MAIL_MODE || 'outbox',
		outboxDir: env.OUTBOX_DIR || 'data/outbox',
		mailFrom: env.MAIL_FROM || 'portal@example.test',
		// Uploaded note files, stored under random names. Outside the web root and
		// git-ignored (inside data/); back it up together with the database.
		uploadsDir: env.UPLOADS_DIR || 'data/uploads',
		// Largest note file accepted, in MB (REPORT.md section 18).
		maxUploadBytes: readNumber(env.MAX_UPLOAD_MB, 20) * 1024 * 1024,
	};
}
