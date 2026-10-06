# Developing the portal (and trying it locally)

Everything here runs only on your own computer with **fake data**: no email is ever sent, and
nothing is on the live site. Installing on a real server is a different guide:
[DEPLOY_API.md](DEPLOY_API.md).

## Start it

First time: `npm install` in the repository folder, then
`cd server && npm install && cp .env.example .env && npm run seed`.

Then, in two terminals from the repository folder:

```sh
cd server && npm start                       # terminal 1: the portal API (port 4400)
npm run dev:portal                           # terminal 2: the website with the portal, port 4331
```

Open <http://localhost:4331/dphy/login/>. `npm run dev:portal` switches the portal on
(`PUBLIC_PORTAL_ENABLED=true`), so the header shows *Login* and *Register*. A plain
`npm run dev` or `npm run build` leaves the portal out.

Emailed links (sign-up, password reset) use `SITE_URL` in `server/.env`, which is
`http://localhost:4331`. If you run the website on another port, change `SITE_URL` to match
and restart terminal 1; the API's log warns you if the two don't match.

## Fake accounts

**Password for every account:** `SEED_PASSWORD` in `server/.env` (`dev-password-123` unless you
changed it). Approved accounts must choose a new password at first login.

| Who | Login | What you see |
|---|---|---|
| Admin | `admin@example.test` | *Approve Sign-Ups* with four people waiting; *Manage Course Offerings* (`/dphy/admin/offerings/`) |
| Teacher | `faculty.a@example.test` | PHY 101 (MSc 2024), PHY 210 (Integrated 2023), last year's PHY 101 (finished) |
| Teacher | `faculty.b@example.test` | PHY 540 (MSc 2024, elective) |
| Students | `student01@example.test` … `student05@example.test` | MSc 2024: PHY 101 (01–02 also the PHY 540 elective) |
| Students | `student06@example.test` … `student10@example.test` | Integrated 2023: PHY 210, and PHY 101 under *Past courses* |
| Waiting for approval | `pending01@example.test` … `pending03@example.test`, `pending.staff@example.test` | only "Your sign-up is pending" |

## Things to try

1. **Student:** log in as `student01@example.test`. Each course has *Class links* and *Notes*;
   the *FAKE notes (… file)* notes have a *Download* button. You only see your own courses.
2. **Teacher:** log in as `faculty.a@example.test`. Add a class link (title + address). Add a
   note with a file: PDF, Word `.docx`, PowerPoint `.pptx`, or `.txt`/`.md`/`.csv`, up to 20 MB,
   optionally with a link. Other files (a renamed program, an old `.doc`, a macro-enabled
   `.docm`) are refused. Log in as `student01@example.test` again: the new items are there.
3. **Admin:** log in as `admin@example.test`. Correct a name or roll number, then approve or
   reject one sign-up, or tick several and use *Approve selected* / *Reject selected*.
4. **Offerings (admin):** on *Manage Course Offerings*, create an offering for a batch (e.g.
   PHY 540, MSc, 2024, "Spring 2027", not elective): the batch's students are enrolled at once.
   *Manage students* adds or removes students by hand; *Finish* moves it to the students'
   *Past courses*, where the teacher can hide its links and notes.
5. **Sign up as a new person:** on the login page choose *create your account*. A student needs
   a roll number like `PHM24123` (MSc), `PHI23005` (Integrated BSc-MSc) or `PHP22017` (PhD):
   prefix, 2-digit joining year, 3-digit number. Use any email ending in `.test`. Instead of an
   email, the link is saved as a text file: open the newest file in `server/data/outbox/`, copy
   the link into the browser and choose a password. The account then waits for the admin.

Wording in `[PLACEHOLDER …]` brackets is waiting for the final text (content-notes/portal.md).

## Start again with clean data

1. Stop terminal 1 (Ctrl+C) — the API must not be running during a reset.
2. `cd server && npm run seed -- --fresh` (deletes `server/data/portal.sqlite` and
   `server/data/uploads/`, then adds the fake data again).
3. Start terminal 1 again (`npm start`). **Always restart the API after any reset**, also after
   deleting or replacing `server/data/portal.sqlite` by hand.

If you forget step 1, the seed refuses and tells you to stop the API. If the database file is
replaced while the API runs anyway, the API notices, stops, and the pages show "portal not
available" until you start it again — so nothing is saved to the old file.

## Look at the database

Everything is in **`server/data/portal.sqlite`**, plus uploaded note files in
**`server/data/uploads/`** (random names; the real names are in the `resources` table).

- **DB Browser for SQLite** (free, <https://sqlitebrowser.org>): *Open Database Read Only…*,
  choose that file, then *Browse Data* and pick a table.
- **Terminal:** `sqlite3 -readonly -header -column server/data/portal.sqlite`, then a query;
  `.tables` lists the tables, `.quit` leaves.

Open it read-only while the API is running. Passwords are stored only as argon2 hashes.

```sql
-- Everyone
SELECT name, email, role, status, roll_number, programme, batch_year FROM users ORDER BY role, name;

-- Sign-ups waiting for approval
SELECT name, email, roll_number, programme, phone, created_at FROM users WHERE status = 'pending';

-- Offerings, teachers, links and notes
SELECT c.code, o.programme, o.batch_year, o.semester, t.name AS teacher, r.kind, r.title, r.url, r.file_name
FROM offerings o JOIN courses c ON c.id = o.course_id LEFT JOIN users t ON t.id = o.teacher_id
LEFT JOIN resources r ON r.offering_id = o.id ORDER BY c.code, o.batch_year;

-- Offerings and who is enrolled (removed = 1: taken out by an admin)
SELECT c.code, o.programme, o.batch_year, o.semester, o.status, u.name, e.added_by, e.removed
FROM enrollments e JOIN offerings o ON o.id = e.offering_id JOIN courses c ON c.id = o.course_id
JOIN users u ON u.id = e.user_id ORDER BY c.code, o.batch_year, u.name;

-- The last 20 things that happened
SELECT a.at, u.name AS who, a.action, a.target
FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id ORDER BY a.id DESC LIMIT 20;
```

## Checks

`cd server && npm test`; then, from the repository folder,
`npm run build && npm run check-links && node scripts/contrast-check.js && npx astro check`.
More on the API, sign-up rules and security: [server/README.md](../../server/README.md).
