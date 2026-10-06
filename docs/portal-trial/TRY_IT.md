# Try the portal (trial)

This trial uses the **people already on the department website** (names and job titles from
the People page) plus a few made-up sign-ups. It runs only on this computer: **no email is ever
sent**, and nothing here is on the live site.

**Password for every account:** `trial-password-123`
**Login emails** are made up from the website: the person's id + `@trial.test`
(for example Rupjyoti Gogoi → `rupjyotigogoi@trial.test`). The login page has a yellow
**Trial accounts** box with a *Use* button for each one, so you don't have to type them.

## Six steps

1. **Open the login page:** <http://localhost:4331/dphy/login/>
   You see the login form and, under it, the yellow *Trial accounts* box.

2. **Log in as a student — Swagat Bordoloi** (PhD research scholar).
   You see your course **PHY 101 Classical Mechanics** with a *Class links* section and a
   *Notes* section. The two *TRIAL notes (… file)* notes have a *Download* button (tiny
   made-up text and PDF files). You only see courses you are enrolled in. Click *Log out*.

3. **Log in as a teacher — Rupjyoti Gogoi** (teaches PHY 101).
   You see PHY 101 and how many students are enrolled. Add a class link: type a title (e.g.
   *Week 1 lecture*), an address such as `https://example.com/week1`, and click *Add link*.
   Then add a note under *Notes*: a title and a file (PDF, Word .docx, PowerPoint .pptx, or a
   .txt/.md/.csv text file, up to 20 MB), optionally a link too, and click *Add note*. Other
   files (a renamed program, a .doc, a macro-enabled .docm) are refused.
   Log out, log in as Swagat Bordoloi again: the new link and note are there, and the file
   downloads.

4. **Log in as someone who just signed up — Trial Applicant One.**
   You only see a "waiting for approval" message — no courses, nothing else.

5. **Log in as the administrator — Trial Admin.**
   You land on **Sign-up approvals** with four people waiting. You can correct a name or roll
   number (*Save*), then *Approve* or *Reject* one, or tick several and *Approve selected*.
   Approve Trial Applicant One, log out, log in as Trial Applicant One: the portal now opens
   (their course list is empty, because enrolling people in courses is still done by hand).

6. **Sign up as a new person.** On the login page choose *create your account*. Pick
   *student*, fill in a name, any email ending in `.test` (e.g. `me@trial.test`), a roll number
   starting with `PHM` or `PHD` (e.g. `PHM24099`) and a phone number. Instead of an email, the
   link is saved as a text file: open the newest file in `server/data/outbox/`, copy the link
   into the browser and choose a password. Your account now waits for the administrator
   (step 5).

Wording in `[PLACEHOLDER — …]` brackets is waiting for the final text.

## What is real and what is made up

| Real (from the website) | Made up for the trial |
|---|---|
| Names and job titles of faculty, staff, research scholars and the research assistant | Every login email (`…@trial.test`) and the password |
| Course codes, titles and teachers (from the course catalogue) | Scholars' roll numbers (`PHD99001`, `PHD99002`, …) |
| | Which scholars are enrolled in which course (a teacher's own scholars), all links, the admin and the four applicants |

Every made-up item is marked `TRIAL` in the database (`users.admin_note`).

## Starting it, or starting again

The trial normally runs already. To start it yourself, open two terminals in the repository
folder:

```sh
cd server && npm start                       # terminal 1: the portal API
npm run dev:portal                           # terminal 2: the website, on port 4331
```

Emailed links (sign-up, password reset) open the address in `SITE_URL` in `server/.env`,
which is `http://localhost:4331`. If you run the website on another port, change `SITE_URL`
to match and restart terminal 1; the API's log warns you if the two don't match.

**Start again with clean data:**

1. Stop terminal 1 (Ctrl+C) — the API must not be running during a reset.
2. `cd server && npm run seed:people -- --fresh` (also empties `server/data/uploads/`)
3. Start terminal 1 again (`npm start`). **Always restart the API after any reset**, also
   after deleting or replacing `server/data/portal.sqlite` by hand.

If you forget step 1, the reset command refuses and tells you to stop the API. If the
database file is replaced while the API runs anyway, the API notices, stops, and the pages
show "portal not available" until you start it again — so nothing is saved to the old file.

The reset command also lists problems it found in the website's people files (for example
two people sharing one email), so they can be fixed there.

(`npm run seed` instead creates an older set of purely fake accounts, used by the developers.)

## Look at the database

Everything the portal stores is in one file, **`server/data/portal.sqlite`**, plus the uploaded
note files in **`server/data/uploads/`** (random names; the real names are in the `resources` table).

- **DB Browser for SQLite** (free app, <https://sqlitebrowser.org>): *Open Database Read Only…*,
  choose that file, then the *Browse Data* tab and pick a table (`users`, `courses`, …).
- **Terminal:** `sqlite3 -readonly -header -column server/data/portal.sqlite`, then type a query;
  `.tables` lists the tables, `.quit` leaves.

Open it read-only while the portal is running. Passwords are stored only as scrambled hashes,
so nothing in the file can be used to log in.

```sql
-- Everyone
SELECT name, email, role, status, designation, roll_number, programme FROM users ORDER BY role, name;

-- Sign-ups waiting for approval
SELECT name, email, roll_number, programme, phone, created_at FROM users WHERE status = 'pending';

-- Courses, teachers and links
SELECT c.code, c.title, t.name AS teacher, r.kind, r.title AS link, r.url
FROM courses c LEFT JOIN users t ON t.id = c.faculty_id LEFT JOIN resources r ON r.course_id = c.id
ORDER BY c.code;

-- Who is enrolled where
SELECT c.code, u.name FROM enrollments e
JOIN courses c ON c.id = e.course_id JOIN users u ON u.id = e.user_id ORDER BY c.code, u.name;

-- The last 20 things that happened (logins, sign-ups, approvals, link changes)
SELECT a.at, u.name AS who, a.action, a.target
FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 20;
```

## For developers

- First-time setup: `npm install`, then `cd server && npm install && cp .env.example .env`.
  `SITE_URL` in `server/.env` must match the website address (`npm run dev:portal` →
  `http://localhost:4331`) so the links in the outbox emails open the right place.
- Checks: `cd server && npm test`; then `npm run build && npm run check-links && node scripts/contrast-check.js`.
- More detail on the API, sign-up rules and security: [server/README.md](../../server/README.md).
