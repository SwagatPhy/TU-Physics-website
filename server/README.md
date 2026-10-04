# Portal API (trial)

Small Node.js + Express API for the Student/Faculty Portal trial. Plan, data model and
security checklist: [docs/portal-trial/REPORT.md](../docs/portal-trial/REPORT.md).
The public website (Astro, in `src/`) does not depend on this folder.

**Status:** login, sessions and password changes; **open sign-up with admin approval**
(students and department members sign up, verify their email, and wait for an admin; an
optional roster approves matching students at once); forgot password; student course links;
the faculty link dashboard. The website pages (`/login`, `/register`, `/forgot-password`,
`/change-password`, `/portal`, `/faculty`, `/admin/approvals`) are in `src/pages/`.
To click through everything locally, see [docs/portal-trial/TRY_IT.md](../docs/portal-trial/TRY_IT.md).

## Run it locally

Needs Node.js 24 or newer.

```sh
cd server
npm install
cp .env.example .env     # local settings; never commit .env
npm run seed             # creates data/portal.sqlite with FAKE users, courses and roster rows
# or: npm run seed:people -- --fresh   # trial DB from the website's people (see below)
npm start                # http://localhost:4400/dphy/api/health
npm test                 # automated tests (use an in-memory database)
```

**`npm run seed:people`** builds a trial database from the people on the website
(`src/content/people/*.json`, never modified) and the course catalogue: real names and
designations, generated logins `<website id>@trial.test`, made-up roll numbers `PHD99001…`
for research scholars, an admin and four pending sign-ups; made-up values are marked
`TRIAL` in `users.admin_note`. It refuses `NODE_ENV=production`, any mail mode other than
`outbox`, and any database outside `server/data/`, and prints problems found in the JSON.
The owner's walkthrough uses it: [docs/portal-trial/TRY_IT.md](../docs/portal-trial/TRY_IT.md).

**Seeded accounts** (all fake, `.test` domain), all with `SEED_PASSWORD` from `.env`:
`admin@example.test`, `faculty.a@example.test`, `faculty.b@example.test`,
`student01@example.test` … `student10@example.test` (approved; must change the password on
first login), and `pending01@example.test` … `pending03@example.test`,
`pending.staff@example.test` (signed up, waiting for approval).

**Seeded roster** (from `sample-roster.csv`, not yet used): `roster.student01@example.test`
(roll number `PHD22011`) … `roster.student04@example.test` (`PHM24002`). A student who signs up
with one of these email + roll number pairs is approved immediately.

**Emails** aren't sent in development: each one is written as a text file to `data/outbox/`
(`MAIL_MODE=outbox`). Open the newest file to find the registration or reset link.

To start again, delete `data/` and run `npm run seed`.

## Sign-up and approval

1. **Sign up** (`/register`): a *student* gives name, email, roll number and contact number; a
   *department member* (faculty, research scholar, staff) gives name, email and contact number.
   Nobody can sign up as admin. Badly formatted details are refused at once; otherwise the
   answer is always "check your email".
2. **Programmes come from the roll-number prefix**, defined only in `programmes.conf`
   (one `PREFIX  Programme` per line). `PHD → PhD` and `PHM → MSc` are **temporary
   placeholders**; the BSc prefix isn't confirmed yet.
3. **Email link:** works **once** and expires after **30 minutes** (`LINK_MINUTES`); signing up
   again replaces the earlier link. Opening it and choosing a password creates the account.
4. **Status:** the new account is `pending`, unless a student's email *and* roll number match an
   unclaimed row of the optional roster, in which case it is `approved` at once and the row is
   claimed. Department members always start `pending`.
5. **Pending** accounts can log in, see themselves (`/me`), edit their own name and contact
   number (`/profile`), change their password and log out. Everything else answers
   `403 approval_pending`.
6. **Admin** (`/admin/approvals`) sees the pending list, can correct name / roll number / contact
   number, and approves or rejects one or many. Each decision is audit-logged and emails the
   person. **Rejected** accounts are treated like deactivated ones: sessions end and login gets
   the same answer as a wrong password.
7. **No account discovery:** an email that already has an account gets a "you already have an
   account" note in *its own* inbox; a roll number that already has an account gets a "contact
   the office" note to the address typed. The screen shows the same answer in every case and
   the timing doesn't differ (tested).
8. **Optional roster:** `npm run roster:import -- people.csv` (columns
   `email,name,roll_number,role`, optional `programme`; whole file checked first, line-numbered
   errors, existing rows never overwritten). Without a roster everyone goes to `pending`.
9. **Enrolment** in courses is not automatic yet (see REPORT.md §17).

Forgot password works the same way: ask with your email, get a one-time 30-minute link,
choose a new password. That signs out every existing session.

## Files

| Path | What it does |
|---|---|
| `src/server.js` | Entry point: reads `.env`, opens the database, applies migrations, starts listening |
| `src/app.js` | Builds the Express app: headers, JSON parsing, routes, background work, errors |
| `src/config.js` | All settings, from environment variables |
| `src/db.js` | Opens SQLite, runs migrations, date helpers |
| `src/auth.js` | Password hashing, sessions, the session cookie, auth middleware |
| `src/tokens.js` | One-time links for registration and password reset |
| `src/roster.js` | Reading, checking and importing roster CSV files |
| `src/programmes.js` | Reads `programmes.conf` (roll-number prefix → programme) |
| `src/mail.js`, `src/mail-templates.js` | Sending email (outbox files for now) and its wording |
| `src/rate-limit.js` | Attempt limits for logins and link requests |
| `src/audit.js` | Writes to `audit_log` |
| `src/routes/auth-routes.js` | `/login`, `/logout`, `/me`, `/change-password` |
| `src/routes/register-routes.js` | `/register/…`, `/password-reset/…` |
| `src/routes/student-routes.js` | `/my-courses` |
| `src/routes/faculty-routes.js` | `/teaching`, `/resources` |
| `src/routes/admin-routes.js` | `/admin/signups`, `/admin/users/:id`, `/admin/decisions` |
| `src/validate.js` | Input checks shared by routes (links must be http/https) |
| `programmes.conf` | Roll-number prefixes (TEMPORARY placeholders) |
| `sample-roster.csv` | Fake roster used by the seed; also an example of the CSV format |
| `migrations/` | Numbered SQL files (see its README for SQLite vs MySQL) |
| `scripts/` | `migrate`, `seed`, `roster:import` |
| `test/` | `node:test` tests |

## API

All paths are under `/dphy/api` (`BASE_PATH` + `/api`). Requests that change something
(`POST`, `PUT`, `DELETE`) must send `Content-Type: application/json`.

| Endpoint | Body | Success | Error codes |
|---|---|---|---|
| `GET /health` | — | `200 {status:"ok"}` | `503` |
| `POST /login` | `{email, password}` | `200 {user}` + session cookie | `400 invalid_input`, `401 invalid_credentials`, `429 too_many_attempts` |
| `POST /logout` | — | `204`, cookie cleared | — |
| `GET /me` | — | `200 {user}` | `401 not_logged_in` |
| `POST /change-password` | `{currentPassword, newPassword}` | `200 {user}` + new cookie | `400 invalid_input / wrong_current_password / password_too_short / password_too_long / password_unchanged`, `401 not_logged_in`, `429 too_many_attempts` |
| `POST /register/request` | `{kind:"student"\|"member", name, email, rollNumber (students), phone}` | `202 {status:"check_your_email"}` for any well-formed request | `400 invalid_kind / invalid_name / invalid_email / invalid_phone / invalid_roll_number`, `429 too_many_attempts` |
| `POST /register/complete` | `{token, password}` | `201 {status:"registered", approval:"pending"\|"approved"}` | `400 invalid_input / password_too_short / password_too_long / invalid_or_expired_link`, `429` |
| `PUT /profile` | `{name, phone}` | `200 {user}` (own account; pending allowed) | `400 invalid_name / invalid_phone`, `401` |
| `POST /password-reset/request` | `{email}` | `202 {status:"check_your_email"}` **always** | `400 invalid_input`, `429 too_many_attempts` |
| `POST /password-reset/complete` | `{token, password}` | `200 {status:"password_reset"}` | `400 invalid_input / password_too_short / password_too_long / invalid_or_expired_link`, `429` |
| `GET /my-courses` | — | `200 {courses:[{code,title,semester,resources:[{id,kind,title,url}]}]}` | `401 not_logged_in`, `403 password_change_required / approval_pending / students_only` |

| `GET /teaching` | — | `200 {courses:[{id,code,title,semester,studentCount,resources:[…,visibleFrom]}]}` | `401`, `403 password_change_required / not_allowed` |
| `POST /resources` | `{courseId, kind, title, url, visibleFrom?}` | `201 {id}` | `400 invalid_kind / invalid_title / invalid_url / invalid_date`, `403 not_allowed`, `404 course_not_found` |
| `PUT /resources/:id` | `{kind, title, url, visibleFrom?}` | `200 {id}` | as above, `404 resource_not_found` |
| `DELETE /resources/:id` | — | `204` | `403 not_allowed`, `404 resource_not_found` |
| `GET /admin/signups` | — | `200 {signups:[{id,name,email,role,status,rollNumber,programme,phone,createdAt}]}` | `401`, `403 not_allowed` |
| `PUT /admin/users/:id` | `{name, rollNumber? (students), phone?}` | `200 {user}` | `400 invalid_name / invalid_roll_number / invalid_phone / roll_number_taken`, `403`, `404 user_not_found` |
| `POST /admin/decisions` | `{userIds:[…], decision:"approve"\|"reject"}` | `200 {decision, done:[ids], skipped:[ids]}` | `400 invalid_decision / invalid_input`, `403` |

`/my-courses` returns only the logged-in student's enrolled, active courses; only links whose
`visible_from` has passed; and only `http(s)` links. `/teaching` and `/resources` are for faculty
(their own courses, where `courses.faculty_id` is them) and admin (all courses); a course someone
may not manage answers exactly like one that doesn't exist. Every link change is audit-logged.

`user` is `{id, name, email, role, status, phone, rollNumber, programme, mustChangePassword}` (your own details). Other codes any endpoint can return:
`415 json_required`, `400 invalid_json`, `413 request_too_large`, `404 not_found`,
`500 server_error`, `403 password_change_required`, `403 approval_pending`.

Links in emails point to the website pages `/dphy/register/#token=…` and
`/dphy/forgot-password/#token=…`. The token is after `#`, so browsers never send it to any
server or in a `Referer` header; the page reads it and posts it to `…/complete`.

The API returns **codes, not sentences**. The Astro pages map each code to wording supplied
by Notes-manager TU. Email wording in `src/mail-templates.js` is `[PLACEHOLDER]` until that
copy arrives.

## How the security pieces work

- **Passwords:** argon2id (`argon2` package defaults: 64 MB memory, 3 passes). Length 10–200.
  An unknown email takes as long to reject as a wrong password, and both get the same answer.
- **Sessions:** a random 32-byte token in the `dphy_session` cookie
  (`HttpOnly; Secure; SameSite=Lax; Path=/dphy`). The database keeps only its SHA-256 hash.
  Sessions end after 8 hours unused or 7 days in total (`SESSION_IDLE_HOURS`,
  `SESSION_MAX_DAYS`), on logout, on a password change or reset (all of the user's sessions),
  and as soon as the account is deactivated. Logging in always starts a new session.
- **One-time links:** random 32-byte tokens; only the SHA-256 hash is stored, with purpose
  (register/reset), expiry and when used. Marking a token used is a single conditional
  `UPDATE`, so a link can't be used twice even by two simultaneous requests. A registration
  link can't be used as a reset link or the other way round.
- **No account discovery:** both "request a link" endpoints answer `202 check_your_email`
  before looking anything up; the roster/account lookup and the email happen afterwards in the
  background. The answer and its timing are the same whether or not the email is known, the
  roll number matches, or the person already registered (tested).
- **First login:** seeded accounts have `must_change_password = 1`. `/me` reports it; the
  `requirePasswordChanged` middleware (for Phase 2+ endpoints) refuses everything else until
  the password is changed. Self-registered people choose their own password, so they aren't
  flagged.
- **Rate limiting** (in memory, resets on restart): 20 attempts per IP per 15 minutes (logins
  and link completions); 5 wrong passwords for one account within 15 minutes lock it for 15
  minutes; at most 3 link emails per address per 15 minutes. A password reset lifts a lockout.
- **Cross-site request forgery:** state-changing requests must be `application/json`, which a
  cross-site form can't send; plus `SameSite=Lax`. A CSRF token header is planned for Phase 5.
- **Headers:** `nosniff`, `no-referrer`, `no-store`, a deny-all CSP and no `X-Powered-By`.
- **SQL:** placeholders only (`?`), never string-built queries.
- **Audit log:** logins, failed logins, logouts, password changes, registrations, resets.

## Choices to revisit

- **SQLite via Node's built-in `node:sqlite`.** No native add-on to compile. It's still marked
  experimental in Node 24 (the warning is silenced in the npm scripts). All database access
  is in `src/db.js`, so swapping to `better-sqlite3` or MySQL touches that one file plus the
  id note in `migrations/README.md`.
- **No SMTP yet.** `MAIL_MODE=smtp` refuses to start until the university's SMTP details are
  known; then `src/mail.js` gets a real sender (e.g. the `nodemailer` package).
- **Rate limits are per process and in memory.** Fine for one server process.
- **Roster names are required** (the roster has a `name` column) because accounts need a
  display name and people shouldn't type their own.
- **Staff** register with role `faculty` (there is no separate staff role).
- **Secure cookies need HTTPS.** `.env.example` turns `COOKIE_SECURE` off for local
  `http://` development; the server refuses to start in production with it off.
