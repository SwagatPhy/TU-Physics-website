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
		// The API only listens on this computer by default; the web server (Apache/nginx)
		// forwards /dphy/api/ to it. Don't change HOST unless IT asks for it.
		host: env.HOST || '127.0.0.1',
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
		// "outbox": write emails to files in outboxDir (development; nothing is sent).
		// "smtp": send through the university's mail server (settings below).
		mailMode: env.MAIL_MODE || 'outbox',
		outboxDir: env.OUTBOX_DIR || 'data/outbox',
		mailFrom: env.MAIL_FROM || 'portal@example.test',
		smtp: {
			host: env.SMTP_HOST || '',
			port: readNumber(env.SMTP_PORT, 587),
			// "starttls" (default): connect, then require an upgrade to TLS before logging in.
			// "tls": TLS from the first byte (usually port 465).
			// "none": no encryption at all — only if IT explicitly says so (e.g. a relay on localhost).
			security: (env.SMTP_SECURE || 'starttls').toLowerCase(),
			user: env.SMTP_USER || '',
			password: env.SMTP_PASS || '',
			// Optional: a PEM file with the CA that signed the mail server's certificate,
			// if it isn't one the system already trusts (e.g. a university-internal CA).
			caFile: env.SMTP_CA_FILE || '',
		},
		// Uploaded note files, stored under random names. Outside the web root and
		// git-ignored (inside data/); back it up together with the database.
		uploadsDir: env.UPLOADS_DIR || 'data/uploads',
		// Enrol PhD students (roll numbers PHP…) automatically like other batches?
		// Off: an admin enrols them by hand (REPORT.md section 19).
		autoEnrolPhd: readBoolean(env.AUTO_ENROL_PHD, false),
		// Largest note file accepted, in MB (REPORT.md section 18).
		maxUploadBytes: readNumber(env.MAX_UPLOAD_MB, 20) * 1024 * 1024,
	};
}
