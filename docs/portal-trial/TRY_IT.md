# Try the portal trial on your computer

Everything here uses **fake data** (`.test` email addresses, `example.com` links). Nothing is
sent by email: emails are saved as text files you open yourself.

## One-time setup

Needs **Node.js 24** or newer and this repository checked out on the `portal-trial` branch.

```sh
npm install                      # website (run in the repository folder)
cd server
npm install                      # portal API
cp .env.example .env             # local settings
npm run seed                     # creates server/data/portal.sqlite with fake people and courses
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

Open **http://localhost:4321/dphy/login/** in your browser.

## Things to click through

| Try this | How |
|---|---|
| **First login** (seeded account) | Log in as `student01@example.test`, password `trial-password-123`. You must choose a new password first; then you see your courses (PHY 101 and PHY 540) with fake class and notes links. |
| **Another student sees different courses** | Log out, log in as `student08@example.test` (same starting password): PHY 210 and PHY 540 only — never PHY 101. |
| **Faculty: manage links** | Log in as `faculty.a@example.test` (change the password first). You see PHY 101 and PHY 210: add a link, edit it, delete one. A `javascript:` or non-web address is refused. Log in as a PHY 101 student to see the change. `faculty.b@example.test` only ever sees PHY 540. |
| **Register yourself** (roster) | Go to *register* from the login page. Email `roster.student01@example.test`, roll number `PHD22011`. Then open the newest file in `server/data/outbox/`, copy the link into the browser, and choose a password. New accounts have no courses yet, so the portal shows the "no courses" message. |
| **Faculty register by email only** | Register with `roster.faculty@example.test` and leave the roll number empty. |
| **Wrong roll number** | Register with `roster.student02@example.test` and roll number `PHD99999`. The page answers the same, but no email file appears. |
| **Forgot password** | From the login page, *forgot password*, any seeded email. Open the newest file in `server/data/outbox/` and follow the link. |
| **Link only works once** | Open the same registration or reset link again: it is refused and you can ask for a new one. |
| **Portal offline** | Stop Terminal 1 (Ctrl+C) and reload the page: it says the portal isn't available, and the rest of the website keeps working. |
| **Lockout** | Enter a wrong password 5 times for one account: the 6th try is blocked for 15 minutes. |

Other seeded logins (all start with `trial-password-123` and must change it): `admin@example.test`,
`faculty.a@example.test`, `faculty.b@example.test`, `student01` … `student10@example.test`.
Faculty and admin go to the faculty dashboard after logging in (admin sees every course).

**Start over:** stop Terminal 1, delete the folder `server/data`, run `npm run seed` in `server/`, start again.

**Wording:** text in `[PLACEHOLDER — …]` brackets is waiting for the final copy from
Notes-manager TU. All of it lives in `src/lib/portal-copy.ts` (pages) and
`server/src/mail-templates.js` (emails).

## Checks the developers run

```sh
cd server && npm test            # automated API tests
cd .. && npm run build && npm run check-links && node scripts/contrast-check.js
```
