# Portal API (trial)

Small Node.js + Express API for the Student/Faculty Portal trial. Plan, data model and
security checklist: [docs/portal-trial/REPORT.md](../docs/portal-trial/REPORT.md).
The public website (Astro, in `src/`) does not depend on this folder.

**Status: Phase 1 — foundation.** Login, logout, current user, password change. Course and
link endpoints come in later phases.

## Run it locally

Needs Node.js 24 or newer.

```sh
cd server
npm install
cp .env.example .env     # local settings; never commit .env
npm run seed             # creates data/portal.sqlite with FAKE users and courses
npm start                # http://localhost:4400/dphy/api/health
npm test                 # automated tests (use an in-memory database)
```

Seeded accounts (all fake, `.test` domain): `admin@example.test`, `faculty.a@example.test`,
`faculty.b@example.test`, `student01@example.test` … `student10@example.test`. All use
`SEED_PASSWORD` from `.env` and must change it on first login. To start again, delete
`data/portal.sqlite` and run `npm run seed`.

## Files

| Path | What it does |
|---|---|
| `src/server.js` | Entry point: reads `.env`, opens the database, applies migrations, starts listening |
| `src/app.js` | Builds the Express app: headers, JSON parsing, routes, error handling |
| `src/config.js` | All settings, from environment variables |
| `src/db.js` | Opens SQLite, runs migrations, date helpers |
| `src/auth.js` | Password hashing, sessions, the session cookie, auth middleware |
| `src/rate-limit.js` | Login attempt limits |
| `src/audit.js` | Writes to `audit_log` |
| `src/routes/auth-routes.js` | `/login`, `/logout`, `/me`, `/change-password` |
| `migrations/` | Numbered SQL files (see its README for SQLite vs MySQL) |
| `scripts/migrate.js`, `scripts/seed.js` | `npm run migrate`, `npm run seed` |
| `test/` | `node:test` tests |

## API (Phase 1)

All paths are under `/dphy/api` (`BASE_PATH` + `/api`). Requests that change something
(`POST`, `PUT`, `DELETE`) must send `Content-Type: application/json`.

| Endpoint | Body | Success | Error codes |
|---|---|---|---|
| `GET /health` | — | `200 {status:"ok"}` | `503` |
| `POST /login` | `{email, password}` | `200 {user}` + session cookie | `400 invalid_input`, `401 invalid_credentials`, `429 too_many_attempts` |
| `POST /logout` | — | `204`, cookie cleared | — |
| `GET /me` | — | `200 {user}` | `401 not_logged_in` |
| `POST /change-password` | `{currentPassword, newPassword}` | `200 {user}` + new cookie | `400 invalid_input / wrong_current_password / password_too_short / password_too_long / password_unchanged`, `401 not_logged_in`, `429 too_many_attempts` |

`user` is `{id, name, email, role, mustChangePassword}`. Other codes any endpoint can return:
`415 json_required`, `400 invalid_json`, `413 request_too_large`, `404 not_found`,
`500 server_error`, and (from Phase 2 endpoints) `403 password_change_required`.

The API returns **codes, not sentences**. The Astro pages map each code to wording supplied
by Notes-manager TU.

## How the security pieces work

- **Passwords:** argon2id (`argon2` package defaults: 64 MB memory, 3 passes). Length 10–200.
  An unknown email takes as long to reject as a wrong password, and both get the same answer.
- **Sessions:** a random 32-byte token in the `dphy_session` cookie
  (`HttpOnly; Secure; SameSite=Lax; Path=/dphy`). The database keeps only its SHA-256 hash.
  Sessions end after 8 hours unused or 7 days in total (`SESSION_IDLE_HOURS`,
  `SESSION_MAX_DAYS`), on logout, on password change (all of the user's sessions), and as soon
  as the account is deactivated. Logging in always starts a new session.
- **First login:** seeded/admin-created accounts have `must_change_password = 1`. `/me`
  reports it; the `requirePasswordChanged` middleware (for Phase 2+ endpoints) refuses
  everything else until the password is changed.
- **Rate limiting** (in memory, resets on restart): 20 login attempts per IP per 15 minutes;
  5 wrong passwords for one account within 15 minutes lock it for 15 minutes. Wrong current
  passwords on `/change-password` count too.
- **Cross-site request forgery:** state-changing requests must be `application/json`, which a
  cross-site form can't send; plus `SameSite=Lax`. A CSRF token header is planned for
  Phase 5 hardening.
- **Headers:** `nosniff`, `no-referrer`, `no-store`, a deny-all CSP and no `X-Powered-By`.
- **SQL:** placeholders only (`?`), never string-built queries.
- **Audit log:** logins, failed logins, logouts and password changes.

## Choices to revisit

- **SQLite via Node's built-in `node:sqlite`.** No native add-on to compile, so `npm install`
  stays simple. It's still marked experimental in Node 24 (the warning is silenced in the npm
  scripts). All database access is in `src/db.js`, so swapping to `better-sqlite3` or MySQL
  touches that one file plus the id note in `migrations/README.md`.
- **Rate limits are per process and in memory.** Fine for one server process. If the API is
  ever run as several processes, move the counts into the database.
- **Secure cookies need HTTPS.** `.env.example` turns `COOKIE_SECURE` off for local
  `http://` development; the server refuses to start in production with it off.
