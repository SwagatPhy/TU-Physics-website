# Installing the portal on the university server

A guide for the university IT cell. It installs the **Student/Faculty Portal API** (a small
Node.js service) next to the department website at `https://www.tezu.ernet.in/dphy/`.
Every command is meant to be copied as it is; replace only the values in `<angle brackets>`.

## Questions for IT (please answer before we start)

1. **Server:** which operating system and version (e.g. Ubuntu 24.04, RHEL 9)? Can it run a
   long-lived background service (systemd, or pm2)?
2. **Node.js 24 or newer:** is it installed, or may we install it (from NodeSource or the
   official binaries)?
3. **Web server:** is `www.tezu.ernet.in` served by **Apache** or **nginx**, and can a rule be
   added that forwards `/dphy/api/` to a local service (section 6)?
4. **HTTPS:** is the site already on HTTPS with a valid certificate? The portal will not work
   over plain http (its login cookie is `Secure`).
5. **Email (SMTP):** the mail server's host name, port, encryption (STARTTLS on 587, or TLS on
   465), a login (user + password) for the portal, and the **From** address it may send as
   (e.g. `portal-dphy@tezu.ernet.in`). Is the certificate signed by a public CA or an internal one?
6. **Storage:** where should the database and uploaded files live (we suggest
   `/var/lib/dphy-portal/`), and how much space is there? Notes are at most 20 MB each.
7. **Backups:** where should nightly backups go, and are they copied off the server?
8. **Antivirus:** is there a scanner on the server that could check uploaded files?
9. **Firewall:** please confirm port 4400 is **not** reachable from outside (the service only
   listens on 127.0.0.1 anyway).
10. **Contact:** who in IT should we call when something needs a restart or a log?

## 1. What goes where

| Part | Where on the server | Notes |
|---|---|---|
| The website (`dist/` from `npm run build:portal`) | the existing `/dphy/` folder of the web server | static files, as today |
| The API (`server/`: `src/`, `migrations/`, `scripts/`, `package.json`, `package-lock.json`, `programmes.conf`) | `/opt/dphy-portal/` | read-only code |
| Settings (`.env`) | `/opt/dphy-portal/.env` | secret: readable only by the service |
| Database and uploaded notes | `/var/lib/dphy-portal/` (`portal.sqlite`, `uploads/`) | **outside the web root**, never served directly |
| Backups | `/var/backups/dphy-portal/` (or IT's backup area) | nightly, section 9 |

Do **not** copy `server/dev/`, `server/test/`, `server/data/` or any `.env` from a developer's
computer: they are for development only.

The web server keeps serving the website as static files. Only requests to
`https://www.tezu.ernet.in/dphy/api/…` are forwarded to the API on `127.0.0.1:4400`.

## 2. Node.js and a service account

```sh
node --version                     # must print v24 or higher
sudo useradd --system --home /var/lib/dphy-portal --shell /usr/sbin/nologin dphy-portal
sudo mkdir -p /opt/dphy-portal /var/lib/dphy-portal/uploads /var/backups/dphy-portal
```

## 3. Install the API

Copy the files listed in section 1 into `/opt/dphy-portal/` (e.g. with `scp` or from a git
checkout of the `server/` folder), then:

```sh
cd /opt/dphy-portal
sudo npm ci --omit=dev             # installs exactly the locked versions, no development tools
```

**File permissions:** code owned by root and read-only for the service; data writable only by
the service; settings readable only by the service.

```sh
sudo chown -R root:root /opt/dphy-portal
sudo chown -R dphy-portal:dphy-portal /var/lib/dphy-portal /var/backups/dphy-portal
sudo chmod 700 /var/lib/dphy-portal /var/lib/dphy-portal/uploads /var/backups/dphy-portal
```

## 4. Settings: `/opt/dphy-portal/.env`

Create the file (`sudo nano /opt/dphy-portal/.env`), then protect it:
`sudo chown root:dphy-portal /opt/dphy-portal/.env && sudo chmod 640 /opt/dphy-portal/.env`.

```ini
# Production mode: secure cookies are required, development seed data is refused.
NODE_ENV=production

# The API listens only on this computer; the web server forwards /dphy/api/ to it.
HOST=127.0.0.1
PORT=4400

# The website address; every link in an email starts with this.
SITE_URL=https://www.tezu.ernet.in
BASE_PATH=/dphy

# HTTPS only (the login cookie is marked Secure). Must stay true.
COOKIE_SECURE=true
# The API runs behind Apache/nginx: use the visitor's address (X-Forwarded-For)
# for the login attempt limits, not the web server's.
TRUST_PROXY=true

# Data, outside the web root. Back up both (section 9).
DATABASE_PATH=/var/lib/dphy-portal/portal.sqlite
UPLOADS_DIR=/var/lib/dphy-portal/uploads
# Largest note file, in MB. The web server limit (section 6) must allow ~1.4x this.
MAX_UPLOAD_MB=20

# Email through the university mail server (answers to question 5).
MAIL_MODE=smtp
MAIL_FROM=<portal-dphy@tezu.ernet.in>
SMTP_HOST=<smtp.tezu.ernet.in>
SMTP_PORT=587
# starttls (port 587, default) | tls (port 465) | none (only if IT says the server is a local relay)
SMTP_SECURE=starttls
SMTP_USER=<login>
SMTP_PASS=<password>
# Only if the mail server's certificate is signed by an internal CA:
# SMTP_CA_FILE=/etc/ssl/certs/<university-ca>.pem

# Sessions end after this many idle hours, and after this many days in any case.
SESSION_IDLE_HOURS=8
SESSION_MAX_DAYS=7
# Sign-up and password-reset links stop working after this many minutes.
LINK_MINUTES=30
# Roll-number prefixes (PHM, PHI, PHP) — the file shipped with the code.
PROGRAMMES_FILE=programmes.conf
```

| Setting | What it is | Production value |
|---|---|---|
| `NODE_ENV` | turns on production checks | `production` |
| `HOST`, `PORT` | where the API listens | `127.0.0.1`, `4400` |
| `SITE_URL`, `BASE_PATH` | the public address used in email links | `https://www.tezu.ernet.in`, `/dphy` |
| `COOKIE_SECURE` | login cookie only over HTTPS | `true` (the API refuses to start otherwise) |
| `TRUST_PROXY` | read the visitor's address from the web server | `true` |
| `DATABASE_PATH`, `UPLOADS_DIR` | the data | under `/var/lib/dphy-portal/` |
| `MAX_UPLOAD_MB` | largest note file | `20` |
| `MAIL_MODE` | `smtp` = real email; `outbox` = development only (nothing is sent) | `smtp` |
| `MAIL_FROM`, `SMTP_*` | the mail server and login | from IT |
| `SESSION_IDLE_HOURS`, `SESSION_MAX_DAYS`, `LINK_MINUTES` | time limits | as above |
| `PROGRAMMES_FILE` | roll-number prefixes | `programmes.conf` |

**Check the email settings** before going further (sends one email; the password is never shown):

```sh
cd /opt/dphy-portal
sudo -u dphy-portal npm run mail:test -- <your.address@tezu.ernet.in>
```

## 5. Run it as a service

### Option A: systemd (recommended)

`/etc/systemd/system/dphy-portal.service`:

```ini
[Unit]
Description=Department of Physics portal API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=dphy-portal
Group=dphy-portal
WorkingDirectory=/opt/dphy-portal
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning src/server.js
Restart=on-failure
RestartSec=5
# Hardening: the service may only write to its data and backup folders.
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/dphy-portal /var/backups/dphy-portal

[Install]
WantedBy=multi-user.target
```

(Use the path `which node` prints if it isn't `/usr/bin/node`. The API reads `.env` from
`WorkingDirectory` itself.)

```sh
sudo systemctl daemon-reload
sudo systemctl enable --now dphy-portal
sudo systemctl status dphy-portal          # "active (running)"
curl http://127.0.0.1:4400/dphy/api/health # {"status":"ok"}
```

On the first start the API creates the database and its tables. If the mail settings are wrong,
it **refuses to start** and the log (section 10) says exactly what to fix.

### Option B: pm2

```sh
sudo npm install -g pm2
cd /opt/dphy-portal
sudo -u dphy-portal pm2 start src/server.js --name dphy-portal --node-args="--disable-warning=ExperimentalWarning"
sudo -u dphy-portal pm2 save
sudo pm2 startup systemd -u dphy-portal --hp /var/lib/dphy-portal   # start again after a reboot
```

## 6. Forward `/dphy/api/` from the web server

Notes are uploaded inside the request as text (base64), which is about 1.4 times the file size,
so a 20 MB note is a request of about 28 MB. Allow **30 MB** for `/dphy/api/` only.
Requests are short except uploads; allow 120 seconds so a slow upload isn't cut off.

### Apache (inside the HTTPS `<VirtualHost *:443>` of www.tezu.ernet.in)

```apache
# Needs: a2enmod proxy proxy_http headers   (Debian/Ubuntu)
<Location /dphy/api/>
    ProxyPass        http://127.0.0.1:4400/dphy/api/ timeout=120
    ProxyPassReverse http://127.0.0.1:4400/dphy/api/
    RequestHeader set X-Forwarded-Proto "https"
    # 30 MB: a 20 MB note plus base64 overhead
    LimitRequestBody 31457280
</Location>
```

Apache adds `X-Forwarded-For` itself and passes responses through as they arrive.
Reload: `sudo apachectl configtest && sudo systemctl reload apache2` (or `httpd`).

### nginx (inside the `server { listen 443 ssl; … }` block)

```nginx
location /dphy/api/ {
    proxy_pass http://127.0.0.1:4400;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    client_max_body_size 30m;     # a 20 MB note plus base64 overhead
    proxy_read_timeout 120s;
    proxy_send_timeout 120s;
    # nginx collects an upload before passing it on (request buffering); that is fine.
    # Downloads are small enough for the default response buffering.
}
```

Reload: `sudo nginx -t && sudo systemctl reload nginx`.

**Check through the web server:**
`curl https://www.tezu.ernet.in/dphy/api/health` → `{"status":"ok"}`.

## 7. HTTPS is required

The portal sends passwords and a login cookie. It must only be reached over **HTTPS** with a
valid certificate. Plain `http://www.tezu.ernet.in/dphy/…` should redirect to `https://`
(normally already the case). The API itself refuses to start in production without
`COOKIE_SECURE=true`.

## 8. The first administrator, then the website

```sh
cd /opt/dphy-portal
sudo -u dphy-portal npm run admin:create                    # asks name, email, password (hidden)
# or, to make them choose their own password at first login:
sudo -u dphy-portal npm run admin:create -- --force-change
```

The password is typed twice and never shown, stored only as a hash, and never given on the
command line. More administrators can be added the same way.

**Switch the portal on in the website.** The public site is built with the portal **off**
(`npm run build`): no Login/Register buttons and no portal pages, so it can go live before this
API exists. Once the health check in section 6 works, the developers build with the portal
**on** and upload `dist/` to `/dphy/` as usual:

```sh
npm run build:portal          # = PUBLIC_PORTAL_ENABLED=true astro build
```

This adds *Login* and *Register* to the site header and the portal pages (`/dphy/login/`,
`/dphy/register/`, `/dphy/portal/`, `/dphy/faculty/`, `/dphy/admin/approvals/`, …). To switch the
portal off again, upload a normal `npm run build`.

## 9. Backups (nightly) and a restore test

The database must **not** be backed up by copying `portal.sqlite` while the API runs (the copy
can be half-written). Use the backup command, which takes a consistent snapshot with SQLite's
online backup and copies the uploaded notes. It is safe while the API runs.

```sh
cd /opt/dphy-portal
sudo -u dphy-portal npm run backup -- /var/backups/dphy-portal --keep 14
```

Each run makes a folder such as `/var/backups/dphy-portal/2026-10-06T0230/` with
`portal.sqlite` and `uploads/`, and deletes all but the newest 14. **Copy this folder off the
server** with IT's usual backup.

**Every night at 02:30** (systemd timer; or a cron line `30 2 * * *`):

`/etc/systemd/system/dphy-portal-backup.service`
```ini
[Unit]
Description=Back up the Department of Physics portal

[Service]
Type=oneshot
User=dphy-portal
WorkingDirectory=/opt/dphy-portal
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning scripts/backup.js /var/backups/dphy-portal --keep 14
```

`/etc/systemd/system/dphy-portal-backup.timer`
```ini
[Unit]
Description=Nightly portal backup

[Timer]
OnCalendar=*-*-* 02:30:00
Persistent=true

[Install]
WantedBy=timers.target
```

```sh
sudo systemctl daemon-reload && sudo systemctl enable --now dphy-portal-backup.timer
```

**Restore test (after the first backup, then monthly):**

```sh
sudo -u dphy-portal npm run backup:check -- /var/backups/dphy-portal/<newest folder>
# Backup OK: … N accounts, N courses, … note files (all present)
```

This opens the copy read-only, checks it for damage and checks every note file is there.

**Restoring for real** (e.g. after a disk failure):

```sh
sudo systemctl stop dphy-portal
sudo -u dphy-portal cp /var/backups/dphy-portal/<folder>/portal.sqlite /var/lib/dphy-portal/portal.sqlite
sudo rm -f /var/lib/dphy-portal/portal.sqlite-wal /var/lib/dphy-portal/portal.sqlite-shm
sudo -u dphy-portal rsync -a --delete /var/backups/dphy-portal/<folder>/uploads/ /var/lib/dphy-portal/uploads/
sudo systemctl start dphy-portal
curl http://127.0.0.1:4400/dphy/api/health
```

Always stop the API before replacing the database. If it is replaced while the API runs, the
API notices, refuses requests and stops itself, so that nothing is written to the old file.
Start it again afterwards.

## 10. Logs

- **systemd:** `sudo journalctl -u dphy-portal -n 100` (last 100 lines), `-f` to follow.
  journald rotates and limits its own logs (see `/etc/systemd/journald.conf`, `SystemMaxUse=`).
- **pm2:** `sudo -u dphy-portal pm2 logs dphy-portal`; install rotation with
  `sudo -u dphy-portal pm2 install pm2-logrotate`.

The log shows start-up, applied database changes, email sending (recipient, never content or
passwords) and errors. Who did what in the portal (logins, approvals, changes, downloads) is in
the database's `audit_log` table.

## 11. Updating

- **Website pages only** (text, pages, styles): build with `npm run build:portal` and upload
  `dist/` to `/dphy/` as usual. The API is not touched.
- **API code** (anything in `server/`):

  ```sh
  sudo -u dphy-portal npm run backup -- /var/backups/dphy-portal --keep 14   # first, always
  # copy the new server files into /opt/dphy-portal (as in section 3), then:
  cd /opt/dphy-portal && sudo npm ci --omit=dev
  sudo systemctl restart dphy-portal          # (pm2: sudo -u dphy-portal pm2 restart dphy-portal)
  curl http://127.0.0.1:4400/dphy/api/health
  ```

  Database changes are applied automatically when the API starts; the log lists them
  (`Applied migrations: …`). If the API doesn't start, restore the backup (section 9) and the
  previous code, and tell the developers.

## 12. Health check

`GET https://www.tezu.ernet.in/dphy/api/health` answers `{"status":"ok"}` (HTTP 200) when the
API is running and can read its database, and HTTP 503 otherwise. Use it for monitoring.

## Checklist for the IT cell

- [ ] Questions at the top answered (OS, Node 24, Apache/nginx, HTTPS, SMTP, storage, backups).
- [ ] Node.js 24+ installed; service user `dphy-portal` created.
- [ ] API files in `/opt/dphy-portal/`; `npm ci --omit=dev` done; permissions as in section 3.
- [ ] `/opt/dphy-portal/.env` filled in (section 4), mode 640, owner `root:dphy-portal`.
- [ ] `npm run mail:test -- <address>` received.
- [ ] Service enabled and running; `curl http://127.0.0.1:4400/dphy/api/health` → ok.
- [ ] Web server forwards `/dphy/api/` with a 30 MB limit; the public health check → ok over HTTPS.
- [ ] Port 4400 not reachable from outside.
- [ ] First administrator created with `npm run admin:create`.
- [ ] Nightly backup timer enabled; first `npm run backup:check` OK; backups copied off the server.
- [ ] Website rebuilt with `npm run build:portal` and uploaded; Login/Register appear.
- [ ] Someone in IT knows where the logs are (section 10) and how to restart the service.
