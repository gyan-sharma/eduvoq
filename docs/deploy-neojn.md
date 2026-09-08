# EduVoq production on neojn

Canonical URL: `https://www.eduvoq.com`.

This runbook is for the existing DigitalOcean droplet **neojn**. Do not provision a new VPS. Do not run Docker Compose or a MinIO container on this host. Secrets stay on the droplet (`/var/www/eduvoq/.env`); never commit passwords, OAuth client secrets, or private keys.

## Host

| | |
| --- | --- |
| Droplet | **neojn**, region `blr1` (Bangalore) |
| IPv4 | `68.183.85.203` |
| Private | `10.47.0.6` |
| OS | Ubuntu 25.10 (use NodeSource LTS Node, not Ubuntu 25.10-only packages) |
| App | systemd `eduvoq.service`, bind `127.0.0.1:3110` |
| Proxy | Host Caddy (`/etc/caddy/Caddyfile` imports `/etc/caddy/sites/*.caddy`) |
| DB | Host MySQL `127.0.0.1:3306`, database **`eduvoq_db`**, user **`eduvoq`** |
| Files | Local disk `/var/www/eduvoq/storage` (`FILE_DRIVER=local`) |
| Heap | `NODE_OPTIONS=--max-old-space-size=384` (8 GB droplet, many Next apps) |

Occupied Next loopback ports include 3020–3100. EduVoq uses **3110** only. UFW already allows 22/80/443 — do not open 3110 publicly.

## DNS

At the `eduvoq.com` registrar / DNS host:

| Name | Type | Value |
| --- | --- | --- |
| `@` | A | `68.183.85.203` |
| `www` | A | `68.183.85.203` |

No AAAA unless the droplet is given a public IPv6. Apex `eduvoq.com` 301s to `https://www.eduvoq.com{uri}` in Caddy.

Point DNS only after Caddy + systemd + MySQL are up (or accept Caddy TLS issuance failing until the A records exist). Cutover is a DNS switch; rollback is revert DNS to Wix.

## MySQL

On the droplet, create a **dedicated** database and user. Do **not** reuse `chessyi`, `schoolyi_db`, or any other host database.

```sql
CREATE DATABASE eduvoq_db CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
CREATE USER 'eduvoq'@'localhost' IDENTIFIED BY '...'; -- generate on the droplet; never commit
GRANT ALL PRIVILEGES ON eduvoq_db.* TO 'eduvoq'@'localhost';
FLUSH PRIVILEGES;
```

`DATABASE_URL` on the server:

```
mysql://eduvoq:<password>@127.0.0.1:3306/eduvoq_db
```

Dump credentials for backups live in `/var/www/eduvoq/.my.cnf` (mode `0640`, not in git):

```ini
[client]
user=eduvoq
password=...
host=127.0.0.1
```

## Files on disk

```bash
mkdir -p /var/www/eduvoq/storage /var/backups/eduvoq
chown -R www-data:www-data /var/www/eduvoq /var/backups/eduvoq
chmod 0750 /var/www/eduvoq/storage /var/backups/eduvoq
install -m 0640 -o www-data -g www-data /dev/null /var/www/eduvoq/.env
```

Uploads must survive app deploys (storage is outside `.next/standalone`). No MinIO, no Caddy `/media/*` proxy.

## Required production `.env` (before enable --now)

Do **not** copy `.env.example` as-is. Dev values (`DATABASE_URL=…/eduvoq`, `AUTH_URL=http://localhost:3000`, `FILE_LOCAL_ROOT=./storage`, empty `AUTH_SECRET` / `CRON_SECRET`) will point Prisma at the wrong database, issue localhost cookies, and write uploads under `.next/standalone/storage` (wiped on the next deploy). `EnvironmentFile=-` does not fail the unit when keys are missing.

Edit `/var/www/eduvoq/.env` (mode `0640`, owner `www-data`) and set **all** of the following before any `systemctl enable --now`:

```
DATABASE_URL=mysql://eduvoq:<password>@127.0.0.1:3306/eduvoq_db
AUTH_SECRET=                 # openssl rand -base64 32  (≥ 32 bytes; required)
AUTH_URL=https://www.eduvoq.com
AUTH_COOKIE_DOMAIN=.eduvoq.com
CRON_SECRET=                 # openssl rand -hex 32
FILE_DRIVER=local
FILE_LOCAL_ROOT=/var/www/eduvoq/storage
EMAIL_FROM=hello@eduvoq.com
CONTACT_TO=hello@eduvoq.com
```

Also set SMTP, OAuth, Turnstile, Razorpay, and Stripe keys on the droplet as needed. `PORT` / `HOSTNAME` / `NODE_OPTIONS` are forced by `eduvoq.service`. `NEXT_PUBLIC_*` must be present at `pnpm build` if the client bundle needs them.

Do not start systemd until `DATABASE_URL` contains `eduvoq_db`, `AUTH_URL` is `https://www.eduvoq.com`, `FILE_LOCAL_ROOT` is `/var/www/eduvoq/storage`, and `AUTH_SECRET` / `CRON_SECRET` are non-empty.

Then `prisma migrate deploy` against that `DATABASE_URL` (from `/var/www/eduvoq`).

## App + systemd

Node from **NodeSource LTS**. Next `output: "standalone"`.

After the `.env` above is filled and `pnpm build` on the host (or a matching Linux builder):

```bash
# repo checkout at /var/www/eduvoq
cp -a .next/static .next/standalone/.next/static
cp -a public .next/standalone/public
chown -R www-data:www-data /var/www/eduvoq
install -m 0644 deploy/eduvoq.service /etc/systemd/system/eduvoq.service
systemctl daemon-reload
systemctl enable --now eduvoq.service
```

Unit: `User=www-data`, `WorkingDirectory=/var/www/eduvoq/.next/standalone`, `ExecStart` → `node server.js`, `PORT=3110`, `HOSTNAME=127.0.0.1`, `NODE_OPTIONS=--max-old-space-size=384`, `EnvironmentFile=-/var/www/eduvoq/.env`.

## Caddy

```bash
install -m 0644 caddy/eduvoq.caddy /etc/caddy/sites/eduvoq.caddy
systemctl reload caddy
```

`www.eduvoq.com` reverse-proxies `127.0.0.1:3110`. `eduvoq.com` 301s to `https://www.eduvoq.com{uri}`. Do not add a second Caddy container.

## Cron (`GET /api/cron`)

Every 5 minutes, loopback only, `Authorization: Bearer $CRON_SECRET`. Do not expose cron on the public hostname. `CRON_SECRET` must already be set in `/var/www/eduvoq/.env` (see above) — do not enable the timer against an empty file.

```bash
install -m 0644 scripts/eduvoq-cron.service /etc/systemd/system/eduvoq-cron.service
install -m 0644 scripts/eduvoq-cron.timer /etc/systemd/system/eduvoq-cron.timer
systemctl daemon-reload
systemctl enable --now eduvoq-cron.timer
```

Crontab alternative (skip the timer if you use this):

```
# /etc/cron.d/eduvoq
*/5 * * * * www-data . /var/www/eduvoq/.env && /usr/bin/curl -fsS --max-time 60 -H "Authorization: Bearer ${CRON_SECRET}" http://127.0.0.1:3110/api/cron >/dev/null
```

## Backups

RPO 24h / RTO 4h. `scripts/backup-eduvoq-db.sh` dumps **`eduvoq_db` only**.

```bash
install -m 0750 scripts/backup-eduvoq-db.sh /usr/local/sbin/backup-eduvoq-db.sh
```

Daily (crontab):

```
# /etc/cron.d/eduvoq-backup
15 2 * * * root /usr/local/sbin/backup-eduvoq-db.sh
```

Restore is `gunzip -c /var/backups/eduvoq/eduvoq_db-*.sql.gz | mysql -u eduvoq -h 127.0.0.1 eduvoq_db` (password via `.my.cnf`).

## What not to do

- Do not `docker compose up` on neojn.
- Do not start MinIO (or any new container) for EduVoq.
- Do not bind Next on `0.0.0.0:3110`.
- Do not grant the `eduvoq` user access to other databases.
- Do not put `RAZORPAY_*`, `STRIPE_*`, `AUTH_*` secrets, or MySQL passwords in git.
