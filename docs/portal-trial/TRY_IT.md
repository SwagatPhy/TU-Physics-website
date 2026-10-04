# Try the portal trial on your computer

Everything here uses **fake data** (`.test` email addresses, `example.com` links). Nothing is
sent by email: emails are saved as text files you open yourself (`server/data/outbox/`).

## One-time setup

Needs **Node.js 24** or newer and this repository checked out on the `portal-trial` branch.

```sh
npm install                      # website (run in the repository folder)
cd server
npm install                      # portal API
cp .env.example .env             # local settings
npm run seed                     # creates server/data/portal.sqlite with fake people, courses and sign-ups
cd ..
```

## Every time: start the two parts

Open **two terminals** in the repository folder.

```sh
# Terminal 1 — the portal API (http://localhost:4400)
cd server
npm start
```

```sh
# Terminal 2 — the website, with the portal pages
npm run dev
```

Open the address Terminal 2 prints, followed by `login/` — usually
**http://localhost:4321/dphy/login/**. (If you use a different port, set `SITE_URL` in
`server/.env` to match, so the links in emails point to the right place.)

## Logins

All seeded accounts start with the password **`trial-password-123`**.

| Account | What happens |
|---|---|
| `admin@example.test` | Must choose a new password, then lands on **Sign-up approvals**. |
| `faculty.a@example.test`, `faculty.b@example.test` | New password first, then the faculty dashboard (their courses and links). |
| `student01@example.test` … `student10@example.test` | New password first, then their courses and links. |
| `pending01@example.test` … `pending03@example.test`, `pending.staff@example.test` | Signed up but **waiting for approval**: they can log in and see only the waiting message. |

## Things to click through

| Try this | How |
|---|---|
| **Student sees only their courses** | `student01` sees PHY 101 and PHY 540; `student08` sees PHY 210 and PHY 540 — never PHY 101. |
| **Faculty manage links** | As `faculty.a`, add, edit and delete a link in PHY 101. A `javascript:` or non-web address is refused. Log in as `student01` to see the change. |
| **Sign up as a new student** | *Sign up* from the login page: choose *student*, any name, email (e.g. `me@example.test`), roll number such as `PHM24099`, a phone number. Open the newest file in `server/data/outbox/`, copy the link into the browser, choose a password. The account now **waits for approval**. |
| **Approve it** | Log in as `admin`. The new sign-up is in the table with the seeded ones: correct the name if you like (*Save*), then *Approve* — or tick several and *Approve selected*. *Reject* asks for confirmation. Each decision writes an email to the outbox. |
| **After approval** | Log in as the new student: the portal opens (no courses yet — enrolment is a manual step for now). |
| **Rejected** | A rejected account can't log in (it gets the same answer as a wrong password). |
| **Roster match is approved at once** | Sign up as a student with `roster.student01@example.test` and roll number `PHD22011` (from `server/sample-roster.csv`). After choosing a password the account is approved immediately. |
| **Department member** | Choose *faculty / scholar / staff*: no roll number is asked; the account always waits for the admin. |
| **Bad roll number** | A roll number that doesn't start with a known prefix (`PHD`, `PHM` — temporary, see `server/programmes.conf`) is refused on the form. |
| **Email already used** | Signing up again with an existing email looks exactly the same on screen; the outbox gets a "you already have an account" note instead of a link. |
| **Forgot password** | From the login page. Open the newest outbox file and follow the link. |
| **Link only works once** | Open the same sign-up or reset link again: it is refused. |
| **Portal offline** | Stop Terminal 1 (Ctrl+C) and reload: the page says the portal isn't available; the rest of the website keeps working. |
| **Lockout** | 5 wrong passwords for one account block it for 15 minutes. |

**Start over:** stop Terminal 1, delete the folder `server/data`, run `npm run seed` in `server/`,
start again.

**Wording:** text in `[PLACEHOLDER — …]` brackets is waiting for the final copy from
Notes-manager TU. All of it lives in `src/lib/portal-copy.ts` (pages) and
`server/src/mail-templates.js` (emails).

## Look at the database

Everything the portal stores is in one file: **`server/data/portal.sqlite`** (SQLite).

- **DB Browser for SQLite** (free app, <https://sqlitebrowser.org>): *Open Database Read Only…* →
  choose `server/data/portal.sqlite` → *Browse Data* tab, pick a table.
- **Terminal** (`sqlite3` comes with macOS): from the repository folder run
  `sqlite3 -readonly -header -column server/data/portal.sqlite`, then type queries; `.tables`
  lists the tables, `.quit` leaves.

Open it **read-only** while the API is running; change data through the portal pages (or
delete `server/data` and re-seed). Passwords are stored only as argon2id hashes and session
or link tokens only as SHA-256 hashes, so nothing in the file can be used to log in.

Example read-only queries:

```sql
-- Everyone, with their status
SELECT id, name, email, role, status, roll_number, programme, phone, created_at
FROM users ORDER BY id;

-- Sign-ups waiting for approval
SELECT id, name, email, roll_number, programme, phone, created_at
FROM users WHERE status = 'pending' ORDER BY created_at;

-- Courses and their links
SELECT c.code, c.title, f.name AS faculty, r.kind, r.title AS link, r.url, r.visible_from
FROM courses c
LEFT JOIN users f ON f.id = c.faculty_id
LEFT JOIN resources r ON r.course_id = c.id
ORDER BY c.code, r.kind;

-- Who is enrolled where
SELECT c.code, u.name, u.email
FROM enrollments e JOIN courses c ON c.id = e.course_id JOIN users u ON u.id = e.user_id
ORDER BY c.code, u.name;

-- The last 20 things that happened (logins, sign-ups, approvals, link changes)
SELECT a.at, u.email AS who, a.action, a.target
FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id
ORDER BY a.id DESC LIMIT 20;

-- The optional roster and whether each row has been used
SELECT email, name, roll_number, role, programme, claimed FROM roster;
```

## Checks the developers run

```sh
cd server && npm test            # automated API tests
cd .. && npm run build && npm run check-links && node scripts/contrast-check.js
```
