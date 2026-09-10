#!/usr/bin/env node
/**
 * MySQL helpers for deploy:
 * - `deploy/update.sh` should use the current process env already loaded from server `.env`
 * - ad-hoc script runs can fall back to loading root `.env`
 *
 *   node deploy/mysql.mjs check      -  connectivity + optional CREATE DATABASE (update.sh)
 *   sudo node deploy/mysql.mjs grant  -  one-time grants via socket root (server)
 *   node deploy/mysql.mjs diagnose  -  server troubleshooting, then check
 */
import { config } from "dotenv";
import { existsSync, readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import mysql from "mysql2/promise";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

/** Green success lines when TTY or FORCE_COLOR / DEPLOY_FORCE_COLOR (matches deploy/ui.sh). */
function deployLogGreen(line) {
  if (process.env.NO_COLOR) {
    console.log(line);
    return;
  }
  if (
    process.env.FORCE_COLOR ||
    process.env.DEPLOY_FORCE_COLOR ||
    process.stdout.isTTY
  ) {
    console.log(`\x1b[32m${line}\x1b[0m`);
    return;
  }
  console.log(line);
}

function loadEnvIfNeeded() {
  if (process.env.DATABASE_URL?.trim()) return;
  config({ path: resolve(root, ".env") });
}

function parseMysqlUrl(urlStr) {
  try {
    const u = new URL(urlStr.replace(/^mysql:\/\//i, "http://"));
    const db = u.pathname.replace(/^\//, "").split("?")[0];
    const rawUser = u.username;
    if (rawUser == null || rawUser === "") {
      return null;
    }
    return {
      user: decodeURIComponent(rawUser),
      password: u.password ? decodeURIComponent(u.password) : "",
      host: u.hostname || "127.0.0.1",
      port: Number(u.port) || 3306,
      database: db || null,
    };
  } catch {
    return null;
  }
}

function sqlIdentUser(user) {
  if (!/^[a-zA-Z0-9_-]+$/.test(user)) {
    throw new Error(`Invalid MySQL user name for diagnose: ${user}`);
  }
  return user;
}

// --- check ---

function safeIdent(name) {
  if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
    throw new Error(`Invalid database name in URL: ${name}`);
  }
  return name;
}

function isMissingDatabaseOrAccessError(e) {
  const errno = e.errno ?? e.code;
  if (errno === 1049 || e.code === "ER_BAD_DB_ERROR") return true;
  if (errno === 1044 || e.code === "ER_DBACCESS_DENIED_ERROR") return true;
  const msg = String(e.message || "");
  if (/Unknown database/i.test(msg)) return true;
  if (/Access denied for user .+ to database/i.test(msg)) return true;
  return false;
}

function printGrantHelp(parts) {
  console.error(
    "[db] Fix on the **same machine as MySQL** (SSH to your Ubuntu server, then):",
  );
  console.error(`    cd ${root} && sudo node deploy/mysql.mjs grant`);
  console.error(
    "[db] That command grants both '…'@'localhost' and '…'@'127.0.0.1' (required when DATABASE_URL uses 127.0.0.1).",
  );
  console.error(
    "[db] Or run SQL as `sudo mysql`  -  see deploy/README.md (MySQL).",
  );
  console.error(
    `[db] Ensure DATABASE_URL password matches IDENTIFIED BY for user '${parts.user}'.`,
  );
}

async function runCheck() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) {
    console.log("[db] ⚠ DATABASE_URL not set  -  skip (admin CMS will not use Prisma)");
    console.log("    Set DATABASE_URL in the current server env / .env.");
    return;
  }

  const parts = parseMysqlUrl(url);
  if (!parts) {
    console.error(
      "[db] ✗ Invalid DATABASE_URL or missing MySQL user name (use mysql://USER:PASS@host:3306/db).",
    );
    process.exit(1);
  }
  if (!parts.database) {
    console.error("[db] ✗ DATABASE_URL must include a database name, e.g. …/your_db");
    process.exit(1);
  }

  const dbName = safeIdent(parts.database);

  let baseConn;
  try {
    baseConn = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.password,
    });
    const [rows] = await baseConn.query("SELECT USER() AS u, CURRENT_USER() AS c");
    deployLogGreen(
      `[db] ✓ MySQL accepts user/password → ${rows[0]?.c ?? rows[0]?.u ?? "connected"}`,
    );
    await baseConn.end();
    baseConn = null;
  } catch (e) {
    const errno = e.errno ?? e.code;
    if (errno === 1045 || e.code === "ER_ACCESS_DENIED_ERROR") {
      console.error(
        "[db] ✗ Wrong password or user not allowed from this host (check USER() vs DATABASE_URL host).",
      );
      console.error(
        "    If DATABASE_URL uses 127.0.0.1, MySQL must have 'user'@'127.0.0.1' (not only 'user'@'localhost').",
      );
      printGrantHelp(parts);
      process.exit(1);
    }
    if (errno === "ECONNREFUSED" || errno === -111) {
      console.error("[db] ✗ Connection refused  -  is MySQL running? host/port in DATABASE_URL?");
      process.exit(1);
    }
    if (errno === "ENOTFOUND") {
      console.error("[db] ✗ Host not found  -  check DATABASE_URL host");
      process.exit(1);
    }
    console.error("[db] ✗", e.message || e);
    process.exit(1);
  }

  let conn;
  try {
    conn = await mysql.createConnection(url);
    await conn.query("SELECT 1 AS ok");
    deployLogGreen(
      `[db] ✓ Database ${dbName} reachable with full DATABASE_URL`,
    );
    await conn.end();
    return;
  } catch (e) {
    if (conn) {
      try {
        await conn.end();
      } catch {
        /* ignore */
      }
    }

    const errno = e.errno ?? e.code;
    if (errno === 1045 || e.code === "ER_ACCESS_DENIED_ERROR") {
      console.error("[db] ✗ Access denied  -  unexpected after step 1; check DATABASE_URL encoding.");
      process.exit(1);
    }

    if (!isMissingDatabaseOrAccessError(e)) {
      console.error("[db] ✗", e.message || e);
      process.exit(1);
    }
  }

  console.log(
    `[db] Cannot open database "${dbName}"  -  trying CREATE DATABASE IF NOT EXISTS as app user…`,
  );

  let admin;
  try {
    admin = await mysql.createConnection({
      host: parts.host,
      port: parts.port,
      user: parts.user,
      password: parts.password,
    });
    await admin.query(
      `CREATE DATABASE IF NOT EXISTS \`${dbName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    );
    await admin.end();
  } catch (e) {
    console.error("[db] ✗ Could not create database:", e.message || e);
    printGrantHelp(parts);
    process.exit(1);
  }

  try {
    conn = await mysql.createConnection(url);
    await conn.query("SELECT 1");
    deployLogGreen(`[db] ✓ Database "${dbName}" ready`);
    await conn.end();
  } catch (e) {
    console.error("[db] ✗ After CREATE DATABASE, still failing:", e.message || e);
    printGrantHelp(parts);
    process.exit(1);
  }
}

// --- grant ---

function sqlEscape(str) {
  return str.replace(/\\/g, "\\\\").replace(/'/g, "''");
}

function runGrant() {
  const urlStr = process.env.DATABASE_URL?.trim();
  if (!urlStr) {
    console.error("[mysql-grant] DATABASE_URL not set in current env / .env.");
    process.exit(1);
  }

  let u;
  try {
    u = new URL(urlStr.replace(/^mysql:\/\//i, "http://"));
  } catch {
    console.error("[mysql-grant] Invalid DATABASE_URL.");
    process.exit(1);
  }

  const db = u.pathname.replace(/^\//, "").split("?")[0];
  if (!/^[a-zA-Z0-9_-]+$/.test(db)) {
    console.error("[mysql-grant] Refusing unsafe database name:", db);
    process.exit(1);
  }

  const user = decodeURIComponent(u.username || "");
  if (!/^[a-zA-Z0-9_-]+$/.test(user)) {
    console.error("[mysql-grant] Refusing unsafe user name:", user);
    process.exit(1);
  }

  const password = u.password ? decodeURIComponent(u.password) : "";
  const passSql = sqlEscape(password);

  const relaxUsernameCheck = process.env.DEPLOY_MYSQL_RELAX_USERNAME_CHECK === "1";
  const policyPrefix = relaxUsernameCheck
    ? "SET GLOBAL validate_password.check_user_name = OFF;\n"
    : "";

  const sql = `${policyPrefix}
CREATE DATABASE IF NOT EXISTS \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${sqlEscape(user)}'@'localhost' IDENTIFIED BY '${passSql}';
ALTER USER '${sqlEscape(user)}'@'localhost' IDENTIFIED BY '${passSql}';
GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${sqlEscape(user)}'@'localhost';
CREATE USER IF NOT EXISTS '${sqlEscape(user)}'@'127.0.0.1' IDENTIFIED BY '${passSql}';
ALTER USER '${sqlEscape(user)}'@'127.0.0.1' IDENTIFIED BY '${passSql}';
GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${sqlEscape(user)}'@'127.0.0.1';
CREATE USER IF NOT EXISTS '${sqlEscape(user)}'@'%' IDENTIFIED BY '${passSql}';
ALTER USER '${sqlEscape(user)}'@'%' IDENTIFIED BY '${passSql}';
GRANT ALL PRIVILEGES ON \`${db}\`.* TO '${sqlEscape(user)}'@'%';
FLUSH PRIVILEGES;
`;

  const useSudo = process.getuid?.() !== 0;
  const bin = useSudo ? "sudo" : "mysql";
  const args = useSudo ? ["mysql"] : [];

  const r = spawnSync(bin, args, {
    input: sql,
    encoding: "utf8",
    stdio: ["pipe", "inherit", "inherit"],
    cwd: root,
  });

  if (r.status !== 0) {
    console.error("[mysql-grant] mysql failed. Install client: apt-get install -y mysql-client");
    console.error(
      "[mysql-grant] If ERROR 1819: the password from DATABASE_URL failed validate_password (not Linux root).",
    );
    console.error(
      "[mysql-grant] Common: validate_password.check_user_name=ON rejects passwords containing the account name (e.g. db_user). Try:",
    );
    console.error(
      "[mysql-grant]   DEPLOY_MYSQL_RELAX_USERNAME_CHECK=1 sudo -E node deploy/mysql.mjs grant",
    );
    console.error(
      "[mysql-grant] Or: sudo mysql -e \"SET GLOBAL validate_password.check_user_name = OFF;\"",
    );
    console.error(
      "[mysql-grant] Also ensure password has mixed case, digit, and a special char MySQL accepts (try ! if & fails).",
    );
    console.error("[mysql-grant] Policy: sudo mysql -e \"SHOW VARIABLES LIKE 'validate_password%';\"");
    process.exit(r.status ?? 1);
  }

  if (relaxUsernameCheck) {
    console.log("[mysql-grant] note: ran with DEPLOY_MYSQL_RELAX_USERNAME_CHECK=1 (check_user_name OFF for this session’s SET GLOBAL)");
  }
  console.log("[mysql-grant] ✓ Database + grants applied for", user, "→", db);
}

// --- diagnose ---

function maskDatabaseUrlLine(line) {
  // Same idea as: sed 's#://[^:]*:[^@]*@#://USER:***@#'
  return line.replace(/:\/\/[^:]*:[^@]*@/, "://USER:***@");
}

function runMysqlSudo(args) {
  const useSudo = process.getuid?.() !== 0;
  const bin = useSudo ? "sudo" : "mysql";
  const fullArgs = useSudo ? ["mysql", ...args] : args;
  return spawnSync(bin, fullArgs, {
    encoding: "utf8",
    stdio: "inherit",
    cwd: root,
  });
}

function runDiagnose() {
  const urlStr = process.env.DATABASE_URL?.trim();
  if (!urlStr) {
    console.error("[mysql-diagnose] DATABASE_URL not set  -  set it in current env / .env first.");
    process.exit(1);
  }
  const parts = parseMysqlUrl(urlStr);
  if (!parts?.user) {
    console.error("[mysql-diagnose] DATABASE_URL must include a MySQL user name.");
    process.exit(1);
  }
  let mysqlUser;
  try {
    mysqlUser = sqlIdentUser(parts.user);
  } catch (e) {
    console.error("[mysql-diagnose]", e.message);
    process.exit(1);
  }

  console.log("");
  console.log(
    `=== [1] MySQL accounts named ${mysqlUser} (need @localhost and @127.0.0.1 when DATABASE_URL host is 127.0.0.1) ===`,
  );
  const whichMysql = spawnSync("sh", ["-c", "command -v mysql"], { encoding: "utf8" });
  if (whichMysql.status !== 0) {
    console.error("[mysql-diagnose] Install client: apt-get install -y mysql-client");
    process.exit(1);
  }
  const q1 = runMysqlSudo([
    "-e",
    `SELECT user, host, plugin FROM mysql.user WHERE user='${sqlEscape(mysqlUser)}';`,
  ]);
  if (q1.status !== 0) {
    console.error("[mysql-diagnose] sudo mysql failed  -  run as root or fix sudo.");
    process.exit(1);
  }

  console.log("");
  console.log(`=== [2] SHOW GRANTS for ${mysqlUser}@localhost ===`);
  runMysqlSudo(["-e", `SHOW GRANTS FOR '${sqlEscape(mysqlUser)}'@'localhost';`]);

  console.log("");
  console.log(
    `=== [3] SHOW GRANTS for ${mysqlUser}@127.0.0.1 (skip if you use ${mysqlUser}@'%' only) ===`,
  );
  runMysqlSudo(["-e", `SHOW GRANTS FOR '${sqlEscape(mysqlUser)}'@'127.0.0.1';`]);

  console.log("");
  console.log(`=== [3b] SHOW GRANTS for ${mysqlUser}@% ===`);
  runMysqlSudo(["-e", `SHOW GRANTS FOR '${sqlEscape(mysqlUser)}'@'%';`]);

  console.log("");
  console.log("=== [4] DATABASE_URL in .env (password hidden) ===");
  const envPath = resolve(root, ".env");
  if (existsSync(envPath)) {
    const text = readFileSync(envPath, "utf8");
    const line = text.split("\n").find((l) => l.startsWith("DATABASE_URL="));
    if (line) console.log(maskDatabaseUrlLine(line));
    else console.log("(DATABASE_URL not in .env)");
  } else {
    console.log("(no .env)");
  }

  console.log("");
  console.log("=== [5] App DB check (needs: npm ci already ran) ===");
  const mysql2Pkg = resolve(root, "node_modules/mysql2/package.json");
  if (existsSync(mysql2Pkg)) {
    const checkScript = resolve(root, "deploy/mysql.mjs");
    const r = spawnSync(process.execPath, [checkScript, "check"], {
      cwd: root,
      stdio: "inherit",
      env: process.env,
    });
    if (r.status === 0) {
      console.log("[mysql-diagnose] mysql.mjs check: OK");
    } else {
      console.log("[mysql-diagnose] mysql.mjs check: FAILED");
      process.exit(1);
    }
  } else {
    console.log("Skip  -  run: npm ci && node deploy/mysql.mjs check");
  }

  console.log("");
  console.log("=== Fix (applies password + grants from DATABASE_URL in current env / .env) ===");
  console.log(`  cd ${root} && sudo node deploy/mysql.mjs grant`);
  console.log("");
}

// --- cli ---

const USAGE = `Usage: node deploy/mysql.mjs <command>

Commands:
  check     Verify DATABASE_URL (used by deploy/update.sh)
  grant     One-time DB + user grants (run on server: sudo node deploy/mysql.mjs grant)
  diagnose  Show mysql.user / grants for DATABASE_URL user, then run check
`;

async function main() {
  const cmd = (process.argv[2] || "").toLowerCase();
  loadEnvIfNeeded();

  if (cmd === "check" || cmd === "") {
    await runCheck().catch((e) => {
      console.error("[db] ✗", e);
      process.exit(1);
    });
    return;
  }

  if (cmd === "grant") {
    runGrant();
    return;
  }

  if (cmd === "diagnose") {
    runDiagnose();
    return;
  }

  if (cmd === "-h" || cmd === "--help" || cmd === "help") {
    console.log(USAGE);
    process.exit(0);
  }

  console.error(`[mysql] Unknown command: ${process.argv[2]}\n`);
  console.error(USAGE.trim());
  process.exit(1);
}

main();
