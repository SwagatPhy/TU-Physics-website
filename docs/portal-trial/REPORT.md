# Student & Faculty Portal — Trial Report

Branch: `portal-trial` (worktree `.claude/worktrees/portal-trial`). Nothing here touches `main` until the owner approves.
Status: **PROPOSAL — awaiting owner approval of the plan and IT answers.**
Written: 2026-10-04 by Planning-manager TU.

---

## 1. Goal

A logged-in area on the department website where:

- **Students** sign in and see only the class links and notes links for their own courses.
- **Faculty** sign in and add, edit and remove the links for the courses they teach, plus their own details.
- **Admin** creates accounts, enrolls students and resets passwords.
- The public site stays exactly as it is: static, fast, and low-maintenance.

Owner's long-term wish: the site should live 10–15 years with as little admin work as possible. This report is honest about where that is and isn't achievable (section 9).

## 2. Why the current site can't do this alone

The site is static Astro: `npm run build` turns files into `dist/`, which is uploaded to `/dphy/` on the university server. Anything in `dist/` is public. A static site has no server code, so it cannot check a password, keep a session, or hold data that only some people may see. Hiding pages with client-side JavaScript is not security, because anyone can read the files.

So a small server-side program and a database are required. The question is only who runs them.

## 3. Options considered

| # | Option | Own data in-house | Build effort | Ongoing upkeep | Needs IT | Verdict |
|---|---|---|---|---|---|---|
| 1 | Existing tool (Google Classroom / Teams / Moodle) and link to it | depends | none | none (vendor) | no | Best if the university already has one. Ask. |
| 2 | **Own Node.js API + MySQL/SQLite, Astro front end** | yes | medium | patching, backups | **yes** | **Chosen for the trial (owner's decision to build it themselves).** |
| 3 | Supabase (hosted DB + auth) | no (vendor) | lower | low | probably not | Fallback if IT can't host Node. |
| 4 | Moodle on the university server | yes | install + config | updates | yes | Strong alternative; separate from the site. |
| 5 | WordPress + membership plugin | yes | full rebuild | highest | yes | Not recommended. |
| — | Git-based CMS (Decap/Tina) | n/a | low | low | no | Only suits *editors*; cannot hide content from the public. Not suitable here. |

Decision: build option 2 as a **trial**. Keep the design backend-agnostic enough that swapping to Supabase later only changes `server/`, not the Astro pages.

## 4. Architecture

```
Browser
  ├─ GET /dphy/…           → static Astro pages (unchanged)
  └─ fetch /dphy/api/…     → Node.js API ──► MySQL (or SQLite)
```

- **Astro (this repo, `src/`)**: adds three static pages: `/login`, `/portal` (student), `/faculty` (faculty dashboard), later `/admin`. These pages contain no private data. After login they call the API with `fetch` (credentials included) and render the result.
- **API (`server/`, new folder, same repo)**: Node.js + Express (or Fastify). The only component that talks to the database. Enforces every permission rule.
- **Database**: the source of truth for users, courses, enrollments, links.
- **Same origin**: the API is served under `/dphy/api/` via a reverse-proxy rule on the web server, so session cookies work without cross-site complications (no CORS, no third-party-cookie problems). This is one concrete request to IT. Fallback: API on a subdomain such as `portal.tezu.ernet.in` with CORS and `SameSite` configured.
- **Local development**: `astro dev` on one port, API on another, with a dev proxy so `/dphy/api` forwards to the API, matching production.

## 5. How login and sessions work

1. Browser posts email + password to `POST /api/login` over HTTPS.
2. API looks up the user, compares with the stored **argon2id** hash (bcrypt acceptable). Passwords are never stored or logged in plain text.
3. On success the API creates a **server-side session** (random ID stored in the database/session table, with expiry) and sets a cookie: `HttpOnly`, `Secure`, `SameSite=Lax`, path `/dphy`. JavaScript cannot read it.
4. Every later request carries the cookie; middleware loads the user and role, then checks the specific permission before touching data.
5. Logout deletes the session row and clears the cookie.
6. Session lifetime: 8 hours idle, 7 days absolute (adjustable).

Authorization lives **only in the API**. Page-level hiding in Astro is cosmetic.

## 6. Data model (starting point)

```
users        id, name, email (unique), password_hash, role ENUM(student,faculty,admin),
             active BOOL, must_change_password BOOL, created_at, last_login_at
courses      id, code, title, semester, faculty_id → users.id, active BOOL
enrollments  user_id → users.id, course_id → courses.id   (PK: both)
resources    id, course_id → courses.id, kind ENUM(class_link, notes, other),
             title, url, visible_from (optional), created_by → users.id, updated_at
sessions     id, user_id, expires_at, created_at, ip, user_agent
audit_log    id, actor_id, action, target, at   (who changed what; helps for 10 years)
```

Notes:
- Link to the existing public `courses` content collection by `code` so the public catalogue and the private portal agree. The public catalogue stays in Markdown; the portal tables hold only private, per-person data.
- Soft-delete (`active=false`) instead of deleting, so old batches and history are kept.
- Migrations kept as numbered SQL files in `server/migrations/` so the schema can be rebuilt from scratch.

## 7. API surface (minimum)

| Endpoint | Who | Notes |
|---|---|---|
| `POST /api/login`, `POST /api/logout`, `GET /api/me` | all | rate-limited login |
| `POST /api/change-password` | any logged in | forced on first login |
| `GET /api/my-courses` | student | courses + resources for enrolled courses only |
| `GET /api/teaching` | faculty | own courses + enrolled student count |
| `POST/PUT/DELETE /api/resources` | faculty | only for courses where `faculty_id = me`; admin may do all |
| `GET/POST/PUT /api/users` | admin | create, deactivate, reset password |
| `POST /api/users/import` | admin | CSV batch import |
| `POST/DELETE /api/enrollments` (+ CSV) | admin | enroll a batch into a course |
| `GET/POST/PUT /api/courses` | admin | |

Rules the API must enforce (each gets an automated test):
- A student never receives resources of a course they aren't enrolled in.
- A faculty member can't edit another faculty member's course.
- An inactive user cannot log in or use an existing session.
- Only `http(s)` URLs accepted for links (blocks `javascript:` links).

## 8. Security checklist

- HTTPS only; HSTS; cookie flags as above.
- Password hashing: argon2id; minimum length 10; no complexity theatre; breached-password check optional later.
- Login rate limiting and temporary lockout per account and per IP.
- CSRF protection on all state-changing requests (SameSite cookie plus a CSRF token header).
- Input validation on every endpoint (schema validation, e.g. zod); parameterized queries only (no string-built SQL).
- Output escaping in the Astro pages (render link text as text, never as HTML).
- Security headers (helmet): CSP, no-sniff, frame-ancestors.
- Secrets (DB password, session secret) in environment variables / `.env` outside the web root. Never committed (`.env` is already in `.gitignore`).
- No self-registration. Accounts are created by admin only (stops outsiders signing up).
- Audit log of admin and faculty changes.
- Nightly database backup, kept off the server, with a tested restore.
- Dependency updates reviewed at least yearly (`npm audit`).
- Student personal data minimised: name, email, enrollment. Nothing else.

**Honest limit:** a class or notes link is only as private as the link itself. A student can forward a Drive or Meet link. Login controls who sees the *page*. For stronger protection, faculty should restrict the target (Drive "specific people", Meet waiting room). The faculty dashboard will carry a short reminder about this.

## 9. The "10–15 years with no intervention" question

No dynamic system runs 10–15 years untouched. Node, MySQL, the OS and the TLS certificates all move on. What we can do is minimise and document the work:

- Keep dependencies few and boring (Express, one DB driver, one hashing library, one validation library).
- Keep the public site static, so a portal outage never takes the department website down.
- Write an **admin handbook**: restore from backup, add a batch, reset a password, renew certificates, update Node.
- Yearly 1-hour maintenance checklist: update dependencies, test restore, rotate secrets, archive old batches.
- Export of all data to plain CSV/JSON at any time, so the data is never locked into this software.
- Prefer SQLite for simplicity (single file, backup = copy). MySQL if IT already provides and maintains it.

Realistic claim: **low-maintenance, roughly an hour or two a year plus an admin who can add each new batch.** Not zero.

## 10. IT questions (blocking for production, not for the trial)

1. Can the server run Node.js (which LTS version) as a long-running process? Or PHP only?
2. Is MySQL/MariaDB available? Who administers it?
3. Can a reverse-proxy rule forward `/dphy/api/*` to the Node process (or a subdomain be provided)?
4. Who applies OS and runtime security updates, and who takes backups?
5. Is there university SSO/LDAP/Google Workspace we should use for staff and students instead of new passwords?
6. Is there a policy on storing student data (names, emails) on the department server?
7. Is SMTP available for password-reset emails?

For the trial none of these block work: it runs locally.

## 11. Build plan (trial, on branch `portal-trial`)

Each phase ends with something the owner can see and click.

**Phase 1 — Foundation**
- `server/` skeleton: Express, config from env, health endpoint.
- Database layer + migrations for all tables (SQLite for the trial; MySQL-compatible SQL).
- Seed script: one admin, two faculty, ten students, three courses, sample links (obviously fake data).
- Login, logout, `/api/me`, sessions, rate limiting, first-login password change.
- Tests for auth.

**Phase 2 — Student side**
- Astro pages `/login` and `/portal`. Reuse `Layout.astro`, existing design tokens and components; plain HTML/CSS (no Tailwind).
- All internal links/assets through `withBase()`; run `npm run check-links` after build.
- `GET /api/my-courses`; empty state; error and expired-session handling.

**Phase 3 — Faculty side**
- `/faculty` dashboard: list own courses, add/edit/delete links with validation and the "forwardable link" reminder.
- Permission tests (faculty cannot touch others' courses).

**Phase 4 — Admin tools**
- `/admin`: users, courses, enrollments, CSV import, password reset, deactivate.
- Audit log view.

**Phase 5 — Hardening and handover**
- CSRF, helmet/CSP, rate-limit tuning, accessibility pass (keyboard, contrast; run `node scripts/contrast-check.js`), mobile layout.
- Backup/restore script, admin handbook (`docs/portal-trial/ADMIN_HANDBOOK.md`), deployment notes for the reverse proxy and process manager (pm2 or systemd).
- Short owner demo and review.

Trial acceptance criteria:
- Student A cannot see student B's courses or links (tested).
- Faculty can manage only their own courses (tested).
- Fresh clone + one documented command set → working local portal with seed data.
- Public site build (`npm run build`) unchanged and `check-links` passes.
- No real student data anywhere in the repo.

## 12. Repo layout (proposed)

```
src/pages/login.astro, portal.astro, faculty.astro, admin.astro   (new)
src/components/portal/…                                           (new, small)
src/lib/api.ts                  fetch helper using withBase('/api/…')  (new)
server/                         API, migrations, seed, tests          (new)
docs/portal-trial/              this report, admin handbook           (new)
```

Rule for keeping main safe: the trial lives on `portal-trial`. Merging into `main` happens only after the owner approves, via fast-forward merge as per CLAUDE.md. Also decide before merging whether `dist/` upload includes the portal pages when the API isn't deployed (they should show a friendly "portal not available" state, not a broken page).

## 13. Team roles for this trial

- **Planning-manager TU**: owns this plan, decisions, and approval gate with the owner.
- **Script-manager TU**: builds Phases 1–5 on `portal-trial`, readable code, minimal abstraction. Sends Notes-manager a summary after each phase.
- **Notes-manager TU**: writes all user-facing copy (login page text, portal empty states, faculty reminder, error messages, password rules), the admin handbook wording, and the Session_log entries. Script-manager requests any further copy from Notes-manager; no invented text.

## 14. Risks

| Risk | Mitigation |
|---|---|
| IT can't host Node/DB | Keep Astro pages backend-agnostic; fall back to Supabase or Moodle |
| Security flaw in custom auth | Small surface, standard libraries, tests, review before production; consider SSO instead of passwords |
| Nobody maintains it after hand-off | Handbook, yearly checklist, data export, simple stack |
| Links leaked by students | Documented limit; advise restricting targets |
| Student data policy | Minimal data; get written approval before real data is loaded |
| Scope creep (chat, grades, attendance) | Out of scope for the trial |

## 15. Out of scope for the trial

Grades, attendance, assignment submission, messaging, payments, public sign-up, mobile app.

## 16. Open questions for the owner

1. SQLite for the trial (recommended) or MySQL from the start?
2. Password reset: admin-only (recommended to start) or by email?
3. Should faculty also see the list of students enrolled in their course?
4. Will students and faculty have university-issued email addresses to use as login names?
5. Approx. size: number of students per batch, faculty, and courses per semester?
