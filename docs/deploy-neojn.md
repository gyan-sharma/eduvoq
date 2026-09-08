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

Then `prisma migrate deploy` against that URL (from `/var/www/eduvoq`).

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

`FILE_DRIVER=local`, `FILE_LOCAL_ROOT=/var/www/eduvoq/storage`. Uploads must survive app deploys (storage is outside `.next/standalone`). No MinIO, no Caddy `/media/*` proxy.

## App + systemd

Node from **NodeSource LTS**. Next `output: "standalone"`.

After `pnpm build` on the host (or a matching Linux builder):

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

Every 5 minutes, loopback only, `Authorization: Bearer $CRON_SECRET`. Do not expose cron on the public hostname.

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
