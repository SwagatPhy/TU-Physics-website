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
	};
}
