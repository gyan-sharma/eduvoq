# Deploy

EduVoq on **neojn** (same Ubuntu host as schoolyi / neojn.com):

| | |
| --- | --- |
| Public URL | `https://eduvoq.com` (also listens for `www.eduvoq.com`) |
| Path | `/var/www/eduvoq` |
| systemd | `eduvoq.service` |
| Port | `127.0.0.1:3110` |
| Caddy | `/etc/caddy/sites/eduvoq.caddy` |
| Database | MySQL `eduvoq_db` (do not share with other apps) |
| Files | `/var/www/eduvoq/storage` |
| Laptop | `SSH_HOST=neojn` in **`.env.local`** |

```bash
pnpm deploy    # first time (bootstrap + build)
pnpm update    # later deploys
```

Do **not** set `DEPLOY_CADDY_SYNC_MODE=full` — the droplet already has a multi-site Caddyfile.

---

# Deploy pack (shared)

Keep **production automation** here; one-off dev scripts stay in repo-root `scripts/`.

**Contents:** [New app setup](#new-app-setup-minimal-repeatable) · [Several apps on one server](#several-apps-on-one-server) · [Caddy (shared host)](#caddy-shared-host) · [From your Mac vs Ubuntu](#from-your-mac-vs-already-on-ubuntu) · [SSH from the Mac (key-based)](#ssh-from-the-mac-key-based) · [MySQL](#mysql-first-time-on-ubuntu) · [Layout](#layout-fewer-files) · [HTTPS checklist](#https-and-caddy-production-checklist) · variable checklist: **[defaults.env.example](defaults.env.example)**

## New app setup (minimal repeatable)

Use **`deploy/defaults.env.example`** as the one checklist: copy the variables you need into **`.env.local`** (and **`.env.prod`** for server defaults). Same layout works for **another** Next app if you duplicate this repo’s structure (`deploy/`, `prisma/`, `package.json` scripts).

### What to change for a new app (single place)

| You need                                      | Set in                                                   | Notes                                                                                                                           |
| --------------------------------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Clone URL                                     | **`.env.local`**: **`DEPLOY_GIT_URL`**                   | If empty, bootstrap uses this repo’s GitHub defaults. For a new repo, set it explicitly.                                        |
| Install directory on server                   | **`DEPLOY_PATH`**                                        | e.g. `/root/apps/myapp` or `/var/www/myapp`. Must match where you `cd` on the server.                                           |
| MySQL connection                              | **`DATABASE_URL`** in **`.env.local`** / **`.env.prod`** | Prisma reads this via **`prisma.config.ts`**.                                                                                   |
| systemd service name (several apps on one VM) | **`DEPLOY_SYSTEMD_UNIT`**                                | Default **`app`**. Install path: `/etc/systemd/system/${DEPLOY_SYSTEMD_UNIT}.service` from **`deploy/systemd/app.service.in`**. |
| GitHub HTTPS + token bootstrap                | **`GITHUB_REPO_SLUG`**                                   | `owner/repo` for `origin` when using **`GITHUB_TOKEN`** (see **`bootstrap-on-server.sh`**).                                     |

**Caddy / domains**: set **`DEPLOY_SITE_DOMAIN`** for bootstrap. Set **`APP_PORT`** in **`.env.local`** and **`PORT`** in **`.env.prod`** to the same value (Caddy ↔ Node). **One server, several apps:** see **[Several apps on one server](#several-apps-on-one-server)** for a full checklist (unique **`APP_PORT`** / **`PORT`**, **`DEPLOY_SYSTEMD_UNIT`**, **`CADDY_SITE_FRAGMENTS`**, **`DEPLOY_CADDY_SYNC_MODE=skip`**, etc.). Short version: prefer **`CADDY_SITE_FRAGMENTS=1`** + **`CADDY_SITE_NAME`** so bootstrap only adds **`/etc/caddy/sites/<name>.caddy`**, or edit **`/etc/caddy/Caddyfile`** by hand and use **`SKIP_CADDY_BOOTSTRAP=1`** for additional bootstraps. Details: **[Caddy (shared host)](#caddy-shared-host)**.

### Prisma setup in this project

- **Schema**: **`prisma/schema.prisma`**
- **Migrations**: **`prisma/migrations/`** (SQL checked in)
- **Config**: **`prisma.config.ts`**  -  datasource URL from **`process.env.DATABASE_URL`**
- **Client**: generated on **`npm ci`** / **`postinstall`** (`prisma generate`)

### Are MySQL migrations applied on update?

**Yes.** On the server, **`deploy/update.sh`** runs (in order):

1. `git pull` / reset (code)
2. **`.env.prod` → `.env` merge** (does not wipe **`DATABASE_URL`** if already set  -  see **`merge_env_prod_into_dotenv`** in **`deploy/lib.sh`**)
3. **`deploy/mysql.mjs check`**  -  connectivity + optional `CREATE DATABASE`
4. **`npm ci`**
5. **`npx prisma migrate deploy`** ← applies **pending** migrations from **`prisma/migrations`**
6. **`npx prisma db seed`**
7. **`npm run build`** (+ standalone static copy)
8. Refresh **systemd** unit from **`deploy/systemd/app.service.in`** when the unit already exists, then **daemon-reload** + restart (unit name from **`DEPLOY_SYSTEMD_UNIT`**, default `app`)
9. **Caddy is not rewritten** on routine update unless you opt in: from the laptop use **`DEPLOY_SYNC_CADDY=1`** with **`npm run update`**, or **`bash deploy/deploy_from_mac.sh sync-caddy`** (respect **`DEPLOY_CADDY_SYNC_MODE=skip`** on multi-app hosts  -  see **[Several apps on one server](#several-apps-on-one-server)**). After any manual Caddy change on the server: **`sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`**.

So every **`npm run update`** (or **`SKIP_PULL=1 bash deploy/update.sh`** on the server) applies migrations **before** the new build runs.

### Is the database safe when code is updated?

- **Your data** lives in MySQL. Deploy **does not** `DROP DATABASE` or delete tables unless a **migration** you wrote does that.
- **Git** only changes files in the repo; **`.env`** on the server is merged carefully so production secrets are not blindly replaced (protected keys in **`merge_env_prod_into_dotenv`** in **`deploy/lib.sh`**).
- **Risk** is mainly from **bad migrations** (e.g. dropping columns). Follow Prisma practices: test migrations locally, use backups for production MySQL.
- **`prisma migrate deploy`** is transactional per migration where MySQL allows it; if a migration **fails**, the script **stops** before **`npm run build`**, so you fix the DB/migration and re-run.

### Commands (new app)

| Goal                                | Command                             |
| ----------------------------------- | ----------------------------------- |
| First-time server                   | `npm run deploy`                    |
| Routine deploy                      | `npm run update`                    |
| On server (after manual `git pull`) | `SKIP_PULL=1 bash deploy/update.sh` |
| Check DB URL only                   | `npm run db:check`                  |

## Several apps on one server

Use this when **more than one** Next.js (or similar) app runs on the **same VM**, each with its own domain or hostname. **One Caddy** terminates TLS on **80/443**; each app listens only on **127.0.0.1** with a **unique port** (3020, 3021, …). Same pattern for any mix of apps as long as each has a distinct **`PORT`** and Caddy **`reverse_proxy`** target.

### Architecture

| Layer        | What happens                                                                                                         |
| ------------ | -------------------------------------------------------------------------------------------------------------------- |
| **Internet** | Clients hit **HTTPS (443)** and **HTTP (80)** on the server’s public IP.                                             |
| **Caddy**    | Routes by **hostname** (`www.app1.com`, `www.app2.com`, …) to `reverse_proxy 127.0.0.1:<port>`.                      |
| **Each app** | **systemd** runs `node server.js` from **`.next/standalone`** with **`HOSTNAME=127.0.0.1`** and **`PORT=<unique>`**. |

You do **not** open **3020**, **3021**, etc. on the public firewall - only **80** and **443**.

### What must differ per app

Set these in **each app’s** laptop **`.env.local`** (or export them when running `deploy/deploy_from_mac.sh`):

| Variable                      | App 1 (example)    | App 2 (example)    | Notes                                                                                     |
| ----------------------------- | ------------------ | ------------------ | ----------------------------------------------------------------------------------------- |
| **`DEPLOY_PATH`**             | `/var/www/app-one` | `/var/www/app-two` | Separate clones.                                                                          |
| **`APP_PORT`** (`.env.local`) | `3020`             | `3021`             | Caddy bootstrap; must equal **`PORT`** in that app’s `.env.prod`.                         |
| **`PORT`** (`.env.prod`)      | `3020`             | `3021`             | systemd / Node listen port; unique on the host.                                           |
| **`DEPLOY_SYSTEMD_UNIT`**     | `app-one`          | `app-two`          | systemd unit filename: `/etc/systemd/system/<name>.service`.                              |
| **`DEPLOY_SITE_DOMAIN`**      | `www.app-one.com`  | `www.app-two.com`  | Use **`www.`** prefix so bootstrap can add **apex → www** (see `bootstrap-on-server.sh`). |
| **`DEPLOY_GIT_URL`**          | that repo          | other repo         |                                                                                           |
| **`DATABASE_URL`** / DB       | own database       | own database       | Do not share DB unless intentional.                                                       |

Bootstrap still expands **`deploy/systemd/app.service.in`** (or **`${DEPLOY_SYSTEMD_TEMPLATE}`**) into **`/etc/systemd/system/${DEPLOY_SYSTEMD_UNIT}.service`**.

### Caddy: avoid overwriting the other app’s config

**Problem:** `bash deploy/deploy_from_mac.sh sync-caddy` (or `DEPLOY_SYNC_CADDY=1`) **generates** a single-site **`/etc/caddy/Caddyfile`** from **`DEPLOY_SITE_DOMAIN`** + **`APP_PORT`** and **replaces** the file on the server - fine for **one** site; it **wipes** a multi-site config.

**Recommended layout**

1. **Master** `/etc/caddy/Caddyfile` contains only:

   ```caddyfile
   import /etc/caddy/sites/*.caddy
   ```

2. **Each app** adds **one file** under **`/etc/caddy/sites/`** via bootstrap:
   - Set **`CADDY_SITE_FRAGMENTS=1`**
   - Set **`CADDY_SITE_NAME`** to a unique slug, e.g. `01-app-one`, `02-app-two`
   - Set **`DEPLOY_SITE_DOMAIN`** (and **`APP_PORT`**, etc.) for that app

   Bootstrap writes **`/etc/caddy/sites/${CADDY_SITE_NAME}.caddy`** (www + apex when the domain starts with **`www.`**).

**Second and later apps**

- Prefer **`CADDY_SITE_FRAGMENTS=1`** + **`SKIP_CADDY_BOOTSTRAP=0`** so a new fragment is created **without** replacing the master file - **if** the master already **`import`s** `sites/*.caddy`. If the master is still a single-file config, either migrate to imports first (see **[Caddy (shared host)](#caddy-shared-host)**) or **`SKIP_CADDY_BOOTSTRAP=1`** and edit Caddy by hand (multi-site snippet there).

**On every app repo that might run `sync-caddy`**

- Set **`DEPLOY_CADDY_SYNC_MODE=skip`** in **`.env.local`** so pushes do not replace the shared **`/etc/caddy/Caddyfile`**.

### Typical order of operations (multi-app)

1. Ensure **`/etc/caddy/Caddyfile`** uses **`import /etc/caddy/sites/*.caddy`** (or plan a single multi-site file; see **[Caddy (shared host)](#caddy-shared-host)**).
2. Bootstrap **app one** with fragment mode (or bootstrap once and then migrate to fragments before app two).
3. Bootstrap **app two** with a **different** **`DEPLOY_PATH`**, **`APP_PORT`**, **`DEPLOY_SYSTEMD_UNIT`**, **`CADDY_SITE_NAME`**, **`DEPLOY_SITE_DOMAIN`**.
4. On the server: **`sudo caddy validate --config /etc/caddy/Caddyfile`** and **`sudo systemctl reload caddy`**.
5. **`sudo ufw allow 80/tcp`**, **`443/tcp`** (and your cloud provider firewall) once - shared by all sites.

### Verify (multi-app)

```bash
sudo ss -tlnp | grep -E 'caddy|:3020|:3021'
curl -sI https://www.app-one.com | head -5
curl -sI https://www.app-two.com | head -5
systemctl status app-one --no-pager
systemctl status app-two --no-pager
```

## Caddy (shared host)

One **Caddy** process can serve **many** sites. Each Next app listens on **127.0.0.1** on its **own port** (`APP_PORT` in `.env.local`, default **3020**). Caddy terminates TLS and `reverse_proxy`s to that port.

### Choose a layout

| Approach                              | When to use                                                                                                                                                                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Single-file** `Caddyfile`           | One app on the server, or you edit the file by hand when adding apps. Bootstrap default (`DOMAIN` set, `CADDY_SITE_FRAGMENTS` unset).                                                                                          |
| **`import /etc/caddy/sites/*.caddy`** | Several apps from day one, or you want each app to add **one file** under `/etc/caddy/sites/` without replacing the whole `Caddyfile`. Set **`CADDY_SITE_FRAGMENTS=1`** and **`CADDY_SITE_NAME`** at bootstrap.                |
| **Manual**                            | You maintain `/etc/caddy/Caddyfile` on the server. Set **`SKIP_CADDY_BOOTSTRAP=1`** for additional bootstraps and **`DEPLOY_CADDY_SYNC_MODE=skip`** so **`bash deploy/deploy_from_mac.sh sync-caddy`** does not overwrite the server file. |

### Laptop env (`.env.local`)

- **`APP_PORT`** (laptop `.env.local`)  -  Caddy bootstrap targets `127.0.0.1:${APP_PORT}`. Must match **`PORT`** in **`.env.prod`** (merged to server `.env`), which systemd passes to Node via `EnvironmentFile`. Use a **different port per app** on the same host (e.g. `3020`, `3021`).
- **`CADDY_SITE_FRAGMENTS=1`**  -  write `/etc/caddy/sites/${CADDY_SITE_NAME}.caddy` instead of replacing the entire `Caddyfile`. Requires **`DOMAIN`** and **`CADDY_SITE_NAME`** (e.g. `01-myapp`, `02-dashboard`).
- **`SKIP_CADDY_BOOTSTRAP=1`**  -  do not change Caddy during bootstrap (typical for a **second** app when Caddy is already configured).
- **`DEPLOY_CADDY_SYNC_MODE=skip`**  -  **`bash deploy/deploy_from_mac.sh sync-caddy`** / `DEPLOY_SYNC_CADDY` will **not** overwrite `/etc/caddy/Caddyfile` (required on multi-app hosts). When sync runs, the file is **generated** from **`DEPLOY_SITE_DOMAIN`** + **`APP_PORT`** (same idea as bootstrap), not copied from a static repo file.

### Manual Caddy snippets

Bootstrap and **`sync-caddy`** write **`/etc/caddy/Caddyfile`** from **`DOMAIN`** / **`DEPLOY_SITE_DOMAIN`** and **`APP_PORT`**. Use these only when editing Caddy by hand.

**Import-only master** (fragment layout  -  one line in `/etc/caddy/Caddyfile`):

```caddyfile
import /etc/caddy/sites/*.caddy
```

**Single site, `www` + apex** (same idea as bootstrap when **`DOMAIN`** starts with **`www.`**):

```caddyfile
www.example.com {
	reverse_proxy 127.0.0.1:3020
}

example.com {
	redir https://www.example.com{uri}
}
```

**HTTP-only on `:80`** (bootstrap does this when **`DEPLOY_SITE_DOMAIN`** is unset; substitute **`APP_PORT`**):

```caddyfile
:80 {
	reverse_proxy 127.0.0.1:3020
}
```

**Two hostnames, two ports** in one file (multi-site without fragments):

```caddyfile
www.app-one.example {
	reverse_proxy 127.0.0.1:3020
}

app-one.example {
	redir https://www.app-one.example{uri}
}

www.app-two.example {
	reverse_proxy 127.0.0.1:3021
}

app-two.example {
	redir https://www.app-two.example{uri}
}
```

### Migrating an existing single-file `Caddyfile` to fragments

1. Move current site blocks into `/etc/caddy/sites/01-yourapp.caddy`.
2. Replace `/etc/caddy/Caddyfile` with the single **`import`** line above.
3. `sudo caddy validate --config /etc/caddy/Caddyfile && sudo systemctl reload caddy`

## From your Mac vs already on Ubuntu

| Situation                                             | What to run                                                                                                                                                                                                      |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Mac**  -  drive the server over SSH                   | Repo root: `**npm run deploy`** (first-time) or `**npm run update**`(routine). Set`**SSH_HOST**`, `**SSH_USER**`, `**DEPLOY_PATH**`in`**.env.local**` and use **SSH key auth** (agent or `**~/.ssh/config\*\*`). |
| **Ubuntu**  -  you already `**git clone`’d\*\* the repo | `**cd`** to the **repository root** (folder with `**package.json`** and `**deploy/**`), then `**npm run update**`. If you already `**git pull`’d**: `**SKIP_PULL=1 bash deploy/update.sh`\*\*.                   |

Do **not** run `**npm run deploy`** on the server only to refresh an existing manual clone: `**bootstrap-on-server.sh**`removes`**DEPLOY_PATH**`and reclones. Use`**npm run update**`(or`**deploy/update.sh**`) for ongoing deploys on the box. See the repo root **README\*\* for the same summary.

### SSH from the Mac (key-based)

**`npm run deploy`** and **`npm run update`** call **`ssh`** and **`scp`** from your Mac to **`SSH_USER@SSH_HOST`** (see **`deploy/lib.sh`** / **`deploy/deploy_from_mac.sh`**). They use the **same** OpenSSH setup as a normal terminal session: **no password prompts** when public-key authentication works (ssh-agent, or **`IdentityFile`** in **`~/.ssh/config`**).

1. **Add your Mac’s public key** to the server account’s **`~/.ssh/authorized_keys`** (same user as **`SSH_USER`** in **`.env.local`**), e.g. with **`ssh-copy-id`** or by pasting **`*.pub`** on the server.
2. **Verify key-only login** from the Mac (must print **`ok`** without asking for a password):

   ```bash
   ssh -o BatchMode=yes "${SSH_USER}@${SSH_HOST}" echo ok
   ```

   Replace with your real values, or run:

   ```bash
   ssh -o BatchMode=yes root@YOUR_SERVER_IP echo ok
   ```

3. **Then** run **`npm run deploy`** or **`npm run update`**  -  each remote step reuses SSH; you should not be prompted for the server password.

If **`ssh -o BatchMode=yes …`** fails, fix SSH first (wrong key: **`ssh -i ~/.ssh/your_key …`**, or a **`Host`** block in **`~/.ssh/config`** with **`IdentityFile`**). **Optional:** non-interactive **password** auth via **`sshpass`** and **`SSHPASS`** / **`DEPLOY_SSH_PASSWORD`** is documented in **[defaults.env.example](defaults.env.example)**  -  prefer keys and **unset** those if you switch to key-only auth.

## MySQL (first time on Ubuntu)

`**deploy/mysql.mjs check`** can create the database only if `**DATABASE_URL**`’s user has `**CREATE**` (rare for an app user). Grant the app user once as **MySQL admin\*\* (socket auth).

### Automated (from repo root on the server)

Requires `**mysql` client** (`apt-get install -y mysql-client` or MariaDB client). Reads `**DATABASE_URL`** from `**.env**`/`**.env.prod**`(same merge order as`**mysql.mjs check**`):

```bash
cd /root/apps/myapp   # or your DEPLOY_PATH
sudo node deploy/mysql.mjs grant
```

Or `**npm run db:grant-server**` (still run with `**sudo**` so `**mysql**` can use root socket auth).

### Diagnose “wrong password / user not allowed from this host”

All of this runs **on the Ubuntu server** (SSH), **not** on your Mac.

**1. See which `db_user` hosts exist** (you usually need **both** `@localhost` and `@127.0.0.1` when `**DATABASE_URL`\*\* uses `127.0.0.1`):

```bash
sudo mysql -e "SELECT user, host FROM mysql.user WHERE user='db_user';"
```

**2. See grants**  -  confirm the **database name** in `DATABASE_URL` (e.g. `app_db`):

```bash
sudo mysql -e "SHOW GRANTS FOR 'db_user'@'localhost';"
sudo mysql -e "SHOW GRANTS FOR 'db_user'@'127.0.0.1';"
sudo mysql -e "SHOW GRANTS FOR 'db_user'@'%';"
```

If you only have `**db_user`@`'%'**`, the `**127.0.0.1**` line can error  -  that is normal; `**%**` still matches TCP from `127.0.0.1`. You still need **`GRANT ALL`** on your app database (see `**deploy/mysql.mjs grant**`).

**3. Test login with the same password as in `.env`** (paste password when prompted):

```bash
mysql -h 127.0.0.1 -P 3306 -u db_user -p your_db -e "SELECT USER(), CURRENT_USER();"
```

**4. One command** (repo root on server, after `npm ci`):

```bash
cd /root/apps/myapp
node deploy/mysql.mjs diagnose
```

(Or `**npm run db:diagnose-server**`. Uses the MySQL user from **`DATABASE_URL`**, not a hardcoded name.)

**5. Apply password + DB + grants from `.env` / `.env.prod`** (fixes most issues):

```bash
cd /root/apps/myapp
sudo node deploy/mysql.mjs grant
```

Then `**git pull**` (if needed) and `**SKIP_PULL=1 bash deploy/update.sh**` or `**npm run update**` from your Mac.

### MySQL error 1819  -  “Your password does not satisfy the current policy requirements”

This refers to the **app user password** in `**DATABASE_URL`** / `**SQL_PASSWORD**`(what`**CREATE USER`/`ALTER USER … IDENTIFIED BY**`sets for`**db_user**`). It is **not** your Linux `**root`\*\* password or SSH password.

MySQL 8 often loads `**validate_password**` and enforces minimum length, mixed case, numbers, and special characters.

**See current rules:**

```bash
sudo mysql -e "SHOW VARIABLES LIKE 'validate_password%';"
```

**Typical fixes:**

1. `**validate_password.check_user_name = ON`** (common)  -  MySQL rejects passwords that **contain the account name** (e.g. `**db_user`** appears inside the password string, case-insensitive) or match other internal rules. **Your policy can be `LOW` and you still get 1819** because of this flag. One-time relax, then re-run **`sudo node deploy/mysql.mjs grant`\*\*:
   ```sql
   SET GLOBAL validate_password.check_user_name = OFF;
   ```
   (Or set **`DEPLOY_MYSQL_RELAX_USERNAME_CHECK=1`** with **`sudo -E`** when running grant  -  see **`mysql.mjs`**.)
2. **Change the app password** in `**.env.prod`** so it meets `**validate_password.length**`, `**mixed_case_count**`, `**number_count**`, `**special_char_count**`, and does not trip `**check_user_name**`. Use `**!**`or`**@**`as the special character if`**&**`is not accepted as “special” on your build. Update`**DATABASE_URL**` to match (in **quoted** `.env` values, `**&`** is usually fine; if anything parses wrong, encode `**&**`as`**%26**` in the URL only).
3. **Relax `validate_password.policy`** only if needed:

```sql
SET GLOBAL validate_password.policy = LOW;
```

MariaDB uses different setting names; search `**password**` in `SHOW VARIABLES` if the above is empty.

### Manual SQL (same effect)

```bash
sudo mysql
```

```sql
CREATE DATABASE IF NOT EXISTS your_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'db_user'@'localhost' IDENTIFIED BY 'same_password_as_in_.env.prod';
GRANT ALL PRIVILEGES ON your_db.* TO 'db_user'@'localhost';
FLUSH PRIVILEGES;
```

Use `**127.0.0.1**` in `**DATABASE_URL**`. In a **quoted** value, `&` in the password is fine (it is not the query string). Encode `**@`\*\* in the password if it appears (e.g. `%40`).

### Why this is not part of `bootstrap-on-server.sh`

- **MySQL may not be installed** by the web bootstrap (and installing/configuring it automatically differs per host and version).
- **Root access to MySQL** is via `**sudo mysql`\*\* (socket), not a password stored in the repo  -  a script cannot safely assume your DBA policy.
- **Grants are a one-time DBA action**; embedding them in every deploy would surprise operators and complicate shared DB hosts.

To run `**deploy/update.sh`** without the DB check while fixing MySQL, set `**SKIP_DB_CHECK=1\*\*` once.

## Layout (fewer files)

| What                                                                      | File                                                                                                                                                                                                        |
| ------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Deploy driver** (SSH from a dev machine **or** server-native on Ubuntu) | **run.sh***\*  -  `bash deploy/deploy_from_mac.sh <bootstrap                                                                                                                                                             | update | sync-env | sync-caddy>` -  auto: SSH when not on the app host; in`/var/www/…`, `/root/apps/…`, cwd = `DEPLOY_PATH`, or systemd unit present, runs in-repo (override: `DEPLOY_MODE=local`or`remote`) |
| Shared env + prereqs + SSH + git check                                    | `**lib.sh**` (source only)                                                                                                                                                                                  |
| **Ubuntu** pull / build / restart                                         | `**update.sh`\*\* (via `npm run update` or `SKIP_PULL=1 bash deploy/update.sh`)                                                                                                                             |
| First-time server (piped over SSH)                                        | `**bootstrap-on-server.sh**`                                                                                                                                                                                |
| Env merge, GitHub remote, DB check, etc.                                  | `**merge_env_prod_into_dotenv**` in `**lib.sh**`, GitHub origin + SSH helpers in `**lib.sh**`, `**mysql.mjs**` (`check` / `grant` / `diagnose`), `**github-ssh-setup.sh**` (server GitHub SSH / deploy key) |
| systemd                                                                   | `**systemd/app.service.in**` (template; override with **`DEPLOY_SYSTEMD_TEMPLATE`**)                                                                                                                        |
| Caddy                                                                     | **[Caddy (shared host)](#caddy-shared-host)**  -  layout, env, snippets                                                                                                                                       |

## App install path (`DEPLOY_PATH`)

Default clone path is `**/var/www/app`**. To use another directory (e.g. `**/root/apps/myapp\*\*`):

1. Set `**DEPLOY_PATH=/root/apps/myapp**` in laptop `**.env.local**` (and on the server in `**.env**` if tools read it).
2. Run `**npm run deploy**`  -  bootstrap clones into that path and installs **`${DEPLOY_SYSTEMD_UNIT}.service**` from **`deploy/systemd/${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}`** with `WorkingDirectory` and `EnvironmentFile` pointing at `**$DEPLOY_PATH\*\*`.
3. `**deploy/update.sh**` allows running when:

- cwd matches `**DEPLOY_PATH**`, or
- cwd is under `**/var/www/**` or `**/root/apps/**`, or
- `**/etc/systemd/system/${DEPLOY_SYSTEMD_UNIT:-app}.service**` exists, or
- `**DEPLOY_SERVER_UPDATE=1**`.

Each app listens on **127.0.0.1** using **`PORT`** in **`.env.prod`** (merged to **`.env`**; default **3020**). Bootstrap/Caddy use **`APP_PORT`** from laptop **`.env.local`**  -  **keep `APP_PORT` and `PORT` equal** so Caddy’s `reverse_proxy` matches Node. On one server, give **each app a different port** and either a **separate Caddy site block** (see **[Caddy (shared host)](#caddy-shared-host)**) or `**CADDY_SITE_FRAGMENTS=1**` so bootstrap adds `**/etc/caddy/sites/<name>.caddy**` only. Use `**SKIP_CADDY_BOOTSTRAP=1**` and `**DEPLOY_CADDY_SYNC_MODE=skip**` when Caddy is already shared across apps. **`deploy/update.sh`** refreshes **`/etc/systemd/system/${DEPLOY_SYSTEMD_UNIT}.service`** from **`deploy/systemd/${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}`** when that unit already exists.

## npm commands

| Command                      | Role                                                         |
| ---------------------------- | ------------------------------------------------------------ |
| `npm run deploy`             | First-time Ubuntu (from laptop: SSH bootstrap)               |
| `npm run update`             | Routine deploy (SSH from laptop, or in-repo on the app host) |
| `npm run db:check`           | MySQL `DATABASE_URL` check (`**mysql.mjs check**`)           |
| `npm run db:grant-server`    | `**mysql.mjs grant**` (run with **sudo** on the server)      |
| `npm run db:diagnose-server` | `**mysql.mjs diagnose**` (server troubleshooting)            |

Optional: `**bash deploy/deploy_from_mac.sh sync-env**` / `**sync-caddy**` for env or Caddy only (`DEPLOY_CADDY_SYNC_MODE=skip` on multi-app hosts). `**DEPLOY_SYNC_CADDY=1**` in env so `**npm run update**` also runs `**sync-caddy**`. `**SKIP_GIT_CHECK=1**` skips `git ls-remote` on the server. `**SKIP_DB_CHECK=1**` skips `**deploy/mysql.mjs check**` (use only while fixing MySQL).

Env loading (same order as `**prisma.config.ts**`): `**.env.local**` → `**.env**` (later overrides). **`deploy/lib.sh`** is the exception: after merge, **`SSH_HOST`** and **`SSH_USER`** are taken from **`.env.local`** when set there, so a gitignored root **`.env`** (server merge output) cannot blank them and break **`npm run update`** while **`npm run deploy`** still works.

**Local run** (not under `deploy/`, but the standard pair): `**npm run dev`** / `**npm run build**`+`**npm run start\*\*` at the repo root.

## systemd

The systemd template (default **`app.service.in`**) uses the placeholder `**__DEPLOY_PATH__**`. It is expanded at bootstrap; **`deploy/update.sh`** re-applies it when the unit already exists. **`PORT`** for **`node server.js`** comes from the merged **`.env`** (set **`PORT`** in **`.env.prod`**).

The service runs as **`www-data`**. The app directory must be **readable and executable** along the whole path (e.g. **`/var/www/app`**). **`WorkingDirectory`** under **`/root/...`** with **`User=www-data`** fails with **`status=200/CHDIR`** unless you change **`User`** or move the clone (prefer **`/var/www/...`**).

## HTTPS and Caddy (production checklist)

### What went wrong (April 2026 incident)

- **DNS** for your apex and **`www`** hostnames pointed at the server; **`http://`** on the IP and hostname worked.
- **Caddy** had been left in **HTTP-only** mode (**`:80`** → **`127.0.0.1:3020`**, bootstrap’s path when **`DEPLOY_SITE_DOMAIN`** was unset), so **nothing listened on `:443`**.
- The app sends **`Strict-Transport-Security`** on responses; after browsers saw that on **HTTP**, they forced **HTTPS**, which then **failed** (connection refused), so the site looked “down” on the domain even though **HTTP** returned **200**.

### What we did on the server

1. Confirmed the app: **`curl -sI http://127.0.0.1:3020`** and **`systemctl status`** for your unit (see **`DEPLOY_SYSTEMD_UNIT`** in env, default **`app`**).
2. Found the real tree: **`systemctl show <unit> -p WorkingDirectory --value`** → **`…/.next/standalone`**; repo root is the parent of **`.next`** (e.g. **`/var/www/app`**  -  not necessarily **`/root/apps/...`**).
3. Installed a **hostname-based** Caddyfile (same structure as bootstrap / **`sync-caddy`** with **`DEPLOY_SITE_DOMAIN`** set): **`www.example.com`** → **`reverse_proxy 127.0.0.1:3020`**, apex → redirect to **`https://www.example.com{uri}`** (replace with your **`DEPLOY_SITE_DOMAIN`**).
4. Ran **`sudo caddy validate --config /etc/caddy/Caddyfile`**, **`sudo systemctl restart caddy`**.
5. Opened **TCP 80 and 443** in **ufw** and in the **cloud provider** security group.
6. Verified: **`sudo ss -tlnp | grep ':443'`**, **`curl -sI https://www.example.com`** (your real hostname).

### How to avoid this next time

1. Set **`DEPLOY_SITE_DOMAIN=www.example.com`** (your real canonical host) in **`.env.local`** **before** **`npm run deploy`** (recommended). If you omit it but **`PRODUCTION_PUBLIC_SITE_URL`** is set (e.g. **`https://www.example.com`**), **`deploy/lib.sh`** derives the hostname for bootstrap. Bootstrap passes it as **`DOMAIN`**; when it starts with **`www.`**, **`bootstrap-on-server.sh`** writes **two** site blocks (www + apex redirect), so **Caddy enables TLS on 443** once DNS points here.
2. If **`DEPLOY_SITE_DOMAIN`** was unset at first bootstrap, fix it in **`.env.local`** and either re-bootstrap or from your laptop run **`bash deploy/deploy_from_mac.sh sync-caddy`** (respect **`DEPLOY_CADDY_SYNC_MODE=skip`** on multi-app hosts). Optionally set **`DEPLOY_SYNC_CADDY=1`** so **`npm run update`** also runs **`sync-caddy`** (it **generates** **`/etc/caddy/Caddyfile`** from env, not a static file).
3. Always confirm **inbound TCP 80 and 443** on the VM (provider firewall + **`ufw`** if enabled). Bootstrap prints a **warning** if **`ufw`** is active but **443** may be missing.

### Useful commands

```bash
# Repo root on server (replace `app` with your DEPLOY_SYSTEMD_UNIT; set HTTPS host to your domain):
systemctl show app -p WorkingDirectory --value

curl -sI http://127.0.0.1:3020 | head -5
sudo ss -tlnp | grep -E ':443|:80'
curl -sI https://www.example.com | head -10
sudo journalctl -u caddy -n 40 --no-pager
```
