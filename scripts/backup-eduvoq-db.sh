#!/usr/bin/env bash
# mysqldump eduvoq_db only. Never --all-databases (neojn also hosts chessyi, schoolyi_db, …).
# Credentials via --defaults-extra-file or the environment — never commit passwords.
set -euo pipefail

DB_NAME="eduvoq_db"
BACKUP_DIR="${EDUVOQ_BACKUP_DIR:-/var/backups/eduvoq}"
KEEP_DAYS="${EDUVOQ_BACKUP_KEEP_DAYS:-7}"
DEFAULTS="${EDUVOQ_MYSQL_DEFAULTS:-/var/www/eduvoq/.my.cnf}"
HOST="${EDUVOQ_MYSQL_HOST:-127.0.0.1}"
USER="${EDUVOQ_MYSQL_USER:-eduvoq}"
DUMP_BIN="${EDUVOQ_MYSQLDUMP:-mysqldump}"

if [[ "$DB_NAME" != "eduvoq_db" ]]; then
  echo "backup-eduvoq-db: refusing to dump '$DB_NAME'" >&2
  exit 1
fi

if ! command -v "$DUMP_BIN" >/dev/null 2>&1; then
  echo "backup-eduvoq-db: $DUMP_BIN not found" >&2
  exit 1
fi

umask 027
mkdir -p "$BACKUP_DIR"
chmod 750 "$BACKUP_DIR"

exec 9>"$BACKUP_DIR/.lock"
if ! flock -n 9; then
  echo "backup-eduvoq-db: already running" >&2
  exit 0
fi

STAMP="$(date -u +%Y%m%dT%H%M%SZ)"
OUT="$BACKUP_DIR/${DB_NAME}-${STAMP}.sql.gz"
TMP="$OUT.partial"
trap 'rm -f "$TMP"' EXIT

dump_args=(
  --single-transaction
  --quick
  --routines
  --triggers
  --events
  --no-tablespaces
  --host="$HOST"
  --user="$USER"
)

if [[ -f "$DEFAULTS" ]]; then
  dump_args=(--defaults-extra-file="$DEFAULTS" "${dump_args[@]}")
fi

# Positional database name only — never --all-databases.
"$DUMP_BIN" "${dump_args[@]}" "$DB_NAME" | gzip -9 >"$TMP"
mv "$TMP" "$OUT"
chmod 640 "$OUT"
trap - EXIT

find "$BACKUP_DIR" -type f -name "${DB_NAME}-*.sql.gz" -mtime +"$KEEP_DAYS" -delete

echo "backup-eduvoq-db: wrote $OUT"
