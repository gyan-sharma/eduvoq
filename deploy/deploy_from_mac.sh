#!/usr/bin/env bash
# Deploy driver: laptop → SSH → Ubuntu, or server-native when run on the app host.
# Remote (macOS / Linux dev): `.env.local` with SSH_USER + SSH_HOST (Host alias from ~/.ssh/config) or DEPLOY_SSH_DESTINATION; see deploy/defaults.env.example
# Local (Ubuntu in /var/www, /root/apps, or cwd = DEPLOY_PATH): no SSH; see deploy/lib.sh (deploy_use_local_runner).
set -euo pipefail

_DEPLOY="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$_DEPLOY/.." && pwd)"
cd "$ROOT"

usage() {
  echo "Usage: bash deploy/deploy_from_mac.sh <command>"
  echo "  bootstrap   First-time server (SSH key from laptop, or sudo on Ubuntu)"
  echo "  update      Pull, merge env, build, restart (optional DEPLOY_SYNC_CADDY=1)"
  echo "  sync-env    Merge SMTP / public URL into server .env"
  echo "  sync-caddy  Optional: set DEPLOY_CADDY_SYNC_MODE=full to regenerate single-site Caddyfile (default is skip  -  never wipes multi-site)"
  echo ""
  echo "Mode: auto  -  SSH from dev machines; in-repo on server (see deploy/update.sh rules) or DEPLOY_MODE=local|remote."
}

require_env_files() {
  if [[ ! -f "$ROOT/.env.local" && ! -f "$ROOT/.env" ]]; then
    echo "Missing .env.local (or .env)." >&2
    exit 1
  fi
}

_load_lib() {
  # shellcheck disable=SC1091
  source "$_DEPLOY/lib.sh"
}

# Parse owner/repo from git@github.com:owner/repo.git or https://github.com/owner/repo
_deploy_parse_github_slug_from_git() {
  local url _s
  url=$(git -C "$ROOT" config --get remote.origin.url 2>/dev/null) || return 1
  case "$url" in
    git@github.com:*)
      _s="${url#git@github.com:}"; _s="${_s%.git}"; printf '%s\n' "$_s"; return 0 ;;
    https://github.com/*|https://www.github.com/*)
      _s="${url#*github.com/}"; _s="${_s%.git}"; printf '%s\n' "$_s"; return 0 ;;
    ssh://git@github.com/*)
      _s="${url#ssh://git@github.com/}"; _s="${_s%.git}"; printf '%s\n' "$_s"; return 0 ;;
    *) return 1 ;;
  esac
}

_resolve_github_repo_slug() {
  local s
  s="${GITHUB_REPO_SLUG:-${DEPLOY_GITHUB_REPO_SLUG:-}}"
  if [[ -z "$s" ]]; then s="$(_deploy_parse_github_slug_from_git)" || s=""; fi
  if [[ -n "$s" ]]; then printf '%s\n' "$s"; return 0; fi
  return 1
}

_resolve_deploy_git_url() {
  DEPLOY_PATH="${DEPLOY_PATH:-/var/www/app}"
  if [[ -n "${DEPLOY_GIT_URL:-}" ]]; then
    return 0
  fi
  local slug
  if ! slug=$(_resolve_github_repo_slug); then
    echo "[deploy] Set DEPLOY_GIT_URL or GITHUB_REPO_SLUG=owner/repo (or point origin at a GitHub repo)." >&2
    exit 1
  fi
  if [[ "${GITHUB_USE_SSH:-}" == "1" ]]; then
    DEPLOY_GIT_URL="git@github.com:${slug}.git"
  elif [[ -n "${GITHUB_TOKEN:-}" ]]; then
    DEPLOY_GIT_URL="https://x-access-token:${GITHUB_TOKEN}@github.com/${slug}.git"
  else
    DEPLOY_GIT_URL="https://github.com/${slug}.git"
  fi
}

cmd_bootstrap_remote() {
  deploy_ssh_require_env
  prereq_laptop_ssh_deploy || exit 1

  _resolve_deploy_git_url
  DEPLOY_SITE_DOMAIN="${DEPLOY_SITE_DOMAIN:-}"
  _gh_slug="${GITHUB_REPO_SLUG:-${DEPLOY_GITHUB_REPO_SLUG:-}}"
  if [[ -z "$_gh_slug" ]]; then _gh_slug=$(_resolve_github_repo_slug 2>/dev/null) || _gh_slug=""; fi

  remote() { deploy_ssh "$@"; }

  if declare -F deploy_ui_banner >/dev/null 2>&1; then
    deploy_ui_set_total 3
    deploy_ui_banner "Deploy: bootstrap (→ $(deploy_ssh_connection_target):${DEPLOY_PATH})"
    deploy_ui_step "Run bootstrap on server (apt, Node, git clone, Caddy, systemd)"
  else
    echo "[bootstrap] $(deploy_ssh_connection_target) -> ${DEPLOY_PATH}"
  fi
  # shellcheck disable=SC2029
  deploy_ssh \
    "export DEPLOY_PATH=$(printf '%q' "$DEPLOY_PATH") DEPLOY_GIT_URL=$(printf '%q' "$DEPLOY_GIT_URL") DOMAIN=$(printf '%q' "$DEPLOY_SITE_DOMAIN") GITHUB_TOKEN=$(printf '%q' "${GITHUB_TOKEN:-}") GITHUB_USE_SSH=$(printf '%q' "${GITHUB_USE_SSH:-}") SYSTEMD_UNIT=$(printf '%q' "${DEPLOY_SYSTEMD_UNIT:-app}") DEPLOY_SYSTEMD_TEMPLATE=$(printf '%q' "${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}") GITHUB_REPO_SLUG=$(printf '%q' "$_gh_slug") APP_PORT=$(printf '%q' "${APP_PORT:-3020}") SKIP_CADDY_BOOTSTRAP=$(printf '%q' "${SKIP_CADDY_BOOTSTRAP:-0}") CADDY_SITE_FRAGMENTS=$(printf '%q' "${CADDY_SITE_FRAGMENTS:-0}") CADDY_SITE_NAME=$(printf '%q' "${CADDY_SITE_NAME:-}") CADDY_FORCE_REPLACE_MASTER=$(printf '%q' "${CADDY_FORCE_REPLACE_MASTER:-}"); bash -s" \
    <"$_DEPLOY/bootstrap-on-server.sh"

  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "server bootstrap script finished"; fi

  if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Upload .env.prod → server .env"; fi
  deploy_scp "$ROOT/.env.prod" "${DEPLOY_PATH}/.env"
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok ".env copied"; fi

  if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "First build + systemd enable (update.sh on server)"; fi
  remote "cd '${DEPLOY_PATH}' && SKIP_PULL=1 bash deploy/update.sh && systemctl enable ${DEPLOY_SYSTEMD_UNIT:-app}"
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "build + unit enabled"; fi

  if [[ "$(_deploy_effective_caddy_sync_mode)" != "skip" ]]; then
    echo "[bootstrap] Caddy  -  ensuring HTTPS site block (DEPLOY_AUTO_CADDY_SYNC)"
    cmd_sync_caddy || true
  fi

  # deploy/update.sh already prints the green success banner + Live at URL.
  if declare -F deploy_ui_dim >/dev/null 2>&1; then
    deploy_ui_dim "[bootstrap] First-time setup finished (see messages above)."
  else
    echo "[bootstrap] done."
  fi
}

cmd_bootstrap_local() {
  echo "[bootstrap] server-native (no SSH) → ${DEPLOY_PATH:-/var/www/app}"
  if [[ ${EUID:-0} -ne 0 ]]; then
    echo "[bootstrap] ERROR: first-time bootstrap needs root for apt, systemd, and Caddy." >&2
    echo "  From repo root: sudo bash deploy/deploy_from_mac.sh bootstrap" >&2
    exit 1
  fi
  _resolve_deploy_git_url
  export DOMAIN="${DEPLOY_SITE_DOMAIN:-}"
  export SYSTEMD_UNIT="${DEPLOY_SYSTEMD_UNIT:-app}"
  export APP_PORT="${APP_PORT:-3020}"
  export SKIP_CADDY_BOOTSTRAP="${SKIP_CADDY_BOOTSTRAP:-0}"
  export CADDY_SITE_FRAGMENTS="${CADDY_SITE_FRAGMENTS:-0}"
  export CADDY_SITE_NAME="${CADDY_SITE_NAME:-}"
  export CADDY_FORCE_REPLACE_MASTER="${CADDY_FORCE_REPLACE_MASTER:-}"
  export DEPLOY_SYSTEMD_TEMPLATE="${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}"
  _bs_slug="${GITHUB_REPO_SLUG:-${DEPLOY_GITHUB_REPO_SLUG:-}}"
  if [[ -z "$_bs_slug" ]]; then _bs_slug=$(_resolve_github_repo_slug 2>/dev/null) || _bs_slug=""; fi
  export GITHUB_REPO_SLUG="$_bs_slug"
  bash "$_DEPLOY/bootstrap-on-server.sh"

  if [[ -f "$ROOT/.env.prod" ]]; then
    echo "[bootstrap] Copying .env.prod → ${DEPLOY_PATH}/.env"
    cp "$ROOT/.env.prod" "${DEPLOY_PATH}/.env"
  else
    echo "[bootstrap] WARN: no .env.prod in repo root  -  create ${DEPLOY_PATH}/.env before update.sh" >&2
  fi

  echo "[bootstrap] First build + enable service"
  (cd "${DEPLOY_PATH}" && SKIP_PULL=1 bash deploy/update.sh && systemctl enable "${DEPLOY_SYSTEMD_UNIT:-app}")

  # deploy/update.sh already printed the green success banner + Live at URL.
  if declare -F deploy_ui_dim >/dev/null 2>&1; then
    deploy_ui_dim "[bootstrap] Server-native bootstrap finished (see messages above)."
  else
    echo "[bootstrap] done (server-native)."
  fi
}

cmd_bootstrap() {
  require_env_files
  _load_lib
  if deploy_use_local_runner; then
    if deploy_installation_exists_local; then
      echo "[deploy] Existing installation detected - using update instead of bootstrap"
      cmd_update_local
    else
      cmd_bootstrap_local
    fi
  else
    deploy_ssh_require_env
    if deploy_installation_exists_remote; then
      echo "[deploy] Existing installation detected - using update instead of bootstrap"
      cmd_update_remote
    else
      cmd_bootstrap_remote
    fi
  fi
}

cmd_update_local() {
  if declare -F deploy_ui_banner >/dev/null 2>&1; then
    deploy_ui_banner "Deploy: update (server  -  ${DEPLOY_PATH:-/var/www/app})"
  else
    echo "[deploy:update] server-native (no SSH)"
  fi
  DEPLOY_PATH="${DEPLOY_PATH:-/var/www/app}"
  _np="$(readlink -f "$ROOT" 2>/dev/null || echo "$ROOT")"
  _dp="$(readlink -f "$DEPLOY_PATH" 2>/dev/null || echo "$DEPLOY_PATH")"
  if [[ "$_np" != "$_dp" ]]; then
    echo "[deploy:update] Refusing: repo root is $_np but DEPLOY_PATH is $_dp." >&2
    echo "  Run from the clone at DEPLOY_PATH, or set DEPLOY_PATH to this directory." >&2
    exit 1
  fi
  export DEPLOY_PREREQ_DONE=1

  (
    set -euo pipefail
    cd "$DEPLOY_PATH"
    # shellcheck disable=SC1091
    source deploy/lib.sh
    deploy_git_sync_to_origin_main
  )

  (cd "$DEPLOY_PATH" && SKIP_PULL=1 bash deploy/update.sh)

  if [[ "$(_deploy_effective_caddy_sync_mode)" != "skip" ]]; then
    echo "[deploy:update] Caddy  -  applying HTTPS reverse_proxy from DEPLOY_SITE_DOMAIN (DEPLOY_AUTO_CADDY_SYNC)"
    cmd_sync_caddy || true
  fi
  # deploy/update.sh already printed success + URL; optional Caddy sync may follow.
}

cmd_update_remote() {
  deploy_ssh_require_env
  prereq_laptop_ssh_deploy || exit 1
  export DEPLOY_PREREQ_DONE=1

  if declare -F deploy_ui_banner >/dev/null 2>&1; then
    deploy_ui_banner "Deploy: update (→ $(deploy_ssh_connection_target):${DEPLOY_PATH})"
  fi

  echo "[deploy:update] sync server repo to origin/main"
  FETCH_SCRIPT="$(cat <<EOF
set -euo pipefail
$(if [[ -n "${GITHUB_TOKEN:-}" ]]; then printf 'export GITHUB_TOKEN=%q\n' "$GITHUB_TOKEN"; fi)
$(if [[ -n "${GITHUB_USE_SSH:-}" ]]; then printf 'export GITHUB_USE_SSH=%q\n' "$GITHUB_USE_SSH"; fi)
cd $(printf '%q' "$DEPLOY_PATH")
source deploy/lib.sh
deploy_git_sync_to_origin_main
EOF
)"
  deploy_ssh_bash "$FETCH_SCRIPT"

  deploy_ssh "cd $(printf '%q' "$DEPLOY_PATH") && SKIP_PULL=1 bash deploy/update.sh"

  if [[ "$(_deploy_effective_caddy_sync_mode)" != "skip" ]]; then
    echo "[deploy:update] Caddy  -  applying HTTPS reverse_proxy from DEPLOY_SITE_DOMAIN (DEPLOY_AUTO_CADDY_SYNC)"
    cmd_sync_caddy || true
  fi
  # deploy/update.sh (via SSH) already printed success + URL.
}

cmd_update() {
  require_env_files
  _load_lib
  if deploy_use_local_runner; then
    cmd_update_local
  else
    cmd_update_remote
  fi
}

_run_systemctl_restart_unit() {
  local u="${DEPLOY_SYSTEMD_UNIT:-app}"
  if systemctl restart "$u" 2>/dev/null; then return 0; fi
  if command -v sudo >/dev/null 2>&1 && sudo -n systemctl restart "$u" 2>/dev/null; then return 0; fi
  if command -v sudo >/dev/null 2>&1; then sudo systemctl restart "$u" 2>/dev/null || true; fi
}

cmd_sync_env_local() {
  LOCAL_ENV_FILE="$ROOT/.env.local"
  [[ -f "$LOCAL_ENV_FILE" ]] || LOCAL_ENV_FILE="$ROOT/.env"
  PROD_URL="${PRODUCTION_PUBLIC_SITE_URL:-https://www.example.com}"
  LOCAL_MERGE="$(mktemp)"

  for k in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS FROM_EMAIL EMAIL_RECIPIENT; do
    line="$(grep -E "^${k}=" "$LOCAL_ENV_FILE" 2>/dev/null | tail -1 || true)"
    [[ -n "$line" ]] && printf '%s\n' "$line" >>"$LOCAL_MERGE"
  done
  printf 'NEXT_PUBLIC_SITE_URL=%s\n' "$PROD_URL" >>"$LOCAL_MERGE"

  TARGET="${DEPLOY_PATH}/.env"
  echo "[sync-server-env] local  -  $TARGET"
  touch "$TARGET"
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "$line" || "$line" == \#* ]] && continue
    key="${line%%=*}"
    [[ -z "$key" ]] && continue
    grep -v "^${key}=" "$TARGET" >"${TARGET}.new" 2>/dev/null || :
    mv "${TARGET}.new" "$TARGET"
  done <"$LOCAL_MERGE"
  cat "$LOCAL_MERGE" >>"$TARGET"
  chmod 640 "$TARGET"
  chown www-data:www-data "$TARGET" 2>/dev/null || true
  rm -f "$LOCAL_MERGE"
  echo "[sync-server-env] merged into $TARGET"
  _run_systemctl_restart_unit
}

cmd_sync_env_remote() {
  if [[ "${DEPLOY_PREREQ_DONE:-}" != "1" ]]; then
    prereq_laptop_ssh_deploy || exit 1
  fi

  LOCAL_ENV_FILE="$ROOT/.env.local"
  [[ -f "$LOCAL_ENV_FILE" ]] || LOCAL_ENV_FILE="$ROOT/.env"
  PROD_URL="${PRODUCTION_PUBLIC_SITE_URL:-https://www.example.com}"

  LOCAL_MERGE="$(mktemp)"
  REMOTE_SCRIPT_LOCAL="$(mktemp)"

  for k in SMTP_HOST SMTP_PORT SMTP_SECURE SMTP_USER SMTP_PASS FROM_EMAIL EMAIL_RECIPIENT; do
    line="$(grep -E "^${k}=" "$LOCAL_ENV_FILE" 2>/dev/null | tail -1 || true)"
    [[ -n "$line" ]] && printf '%s\n' "$line" >>"$LOCAL_MERGE"
  done
  printf 'NEXT_PUBLIC_SITE_URL=%s\n' "$PROD_URL" >>"$LOCAL_MERGE"
  REMOTE_MERGE="/tmp/deploy-env-merge-$$"

  cat >"$REMOTE_SCRIPT_LOCAL" <<'EOS'
set -euo pipefail
MERGE="$1"
TARGET="$2"
touch "$TARGET"
while IFS= read -r line || [[ -n "$line" ]]; do
  [[ -z "$line" || "$line" == \#* ]] && continue
  key="${line%%=*}"
  [[ -z "$key" ]] && continue
  grep -v "^${key}=" "$TARGET" >"${TARGET}.new" 2>/dev/null || :
  mv "${TARGET}.new" "$TARGET"
done < "$MERGE"
cat "$MERGE" >> "$TARGET"
chmod 640 "$TARGET"
chown www-data:www-data "$TARGET" 2>/dev/null || true
rm -f "$MERGE"
echo "[sync-server-env] merged into $TARGET"
EOS

  echo "[sync-server-env] $(deploy_ssh_connection_target):${DEPLOY_PATH}/.env"
  deploy_scp "$LOCAL_MERGE" "$REMOTE_MERGE"
  deploy_scp "$REMOTE_SCRIPT_LOCAL" "/tmp/deploy-merge-env-inner.sh"
  deploy_ssh "chmod +x /tmp/deploy-merge-env-inner.sh && bash /tmp/deploy-merge-env-inner.sh $(printf '%q' "$REMOTE_MERGE") $(printf '%q' "$DEPLOY_PATH/.env") && rm -f /tmp/deploy-merge-env-inner.sh"
  deploy_ssh "systemctl restart ${DEPLOY_SYSTEMD_UNIT:-app} 2>/dev/null || true"
  rm -f "$LOCAL_MERGE" "$REMOTE_SCRIPT_LOCAL"
}

cmd_sync_env() {
  require_env_files
  _load_lib
  if deploy_use_local_runner; then
    cmd_sync_env_local
  else
    deploy_ssh_require_env
    cmd_sync_env_remote
  fi
}

# skip | full  -  explicit DEPLOY_CADDY_SYNC_MODE wins; else DEPLOY_SYNC_CADDY=1 or DEPLOY_AUTO_CADDY_SYNC+DEPLOY_SITE_DOMAIN implies full.
_deploy_effective_caddy_sync_mode() {
  if [[ -n "${DEPLOY_CADDY_SYNC_MODE:-}" ]]; then
    printf '%s\n' "${DEPLOY_CADDY_SYNC_MODE}"
  elif [[ "${DEPLOY_SYNC_CADDY:-}" =~ ^(1|true|yes)$ ]]; then
    printf '%s\n' "full"
  elif [[ "${DEPLOY_AUTO_CADDY_SYNC:-1}" =~ ^(1|true|yes)$ ]] && [[ -n "${DEPLOY_SITE_DOMAIN:-}" ]]; then
    printf '%s\n' "full"
  else
    printf '%s\n' "skip"
  fi
}

cmd_sync_caddy_local() {
  case "$(_deploy_effective_caddy_sync_mode)" in
    skip|none|off|0|false)
      echo "[sync-caddy] DEPLOY_CADDY_SYNC_MODE=skip  -  not replacing /etc/caddy/Caddyfile (set DEPLOY_AUTO_CADDY_SYNC=0 on shared Caddy hosts)."
      return 0
      ;;
    full|replace|overwrite|1|true|yes) ;;
    *)
      echo "[sync-caddy] Unknown DEPLOY_CADDY_SYNC_MODE=${DEPLOY_CADDY_SYNC_MODE:-}  -  use skip (default) or full." >&2
      return 1
      ;;
  esac
  _cf_tmp="$(mktemp)"
  deploy_write_https_caddyfile "$_cf_tmp" || {
    rm -f "$_cf_tmp"
    return 1
  }

  if deploy_caddy_master_is_import_sites_layout /etc/caddy/Caddyfile; then
    _fp="$(deploy_caddy_sites_fragment_path)"
    if ! deploy_caddy_can_install_generated_master "$_fp"; then
      rm -f "$_cf_tmp"
      echo "[sync-caddy] Refused: fragment ${_fp}  -  set CADDY_SITE_NAME to your sites/*.caddy basename, or CADDY_FORCE_REPLACE_MASTER=1 once." >&2
      return 1
    fi
    _caddy_reload() {
      if [[ ${EUID:-0} -eq 0 ]]; then
        if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
          echo "[sync-caddy] Caddyfile valid"
          systemctl reload caddy
        else
          caddy validate --config /etc/caddy/Caddyfile
          return 1
        fi
      elif command -v sudo >/dev/null 2>&1; then
        if sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
          echo "[sync-caddy] Caddyfile valid"
          sudo systemctl reload caddy
        else
          sudo caddy validate --config /etc/caddy/Caddyfile
          return 1
        fi
      else
        echo "[sync-caddy] need root or sudo for caddy validate / systemctl reload" >&2
        return 1
      fi
    }
    if [[ ${EUID:-0} -eq 0 ]]; then
      mkdir -p /etc/caddy/sites
      install -m 644 "$_cf_tmp" "$_fp"
    elif command -v sudo >/dev/null 2>&1; then
      sudo mkdir -p /etc/caddy/sites
      sudo install -m 644 "$_cf_tmp" "$_fp"
    else
      rm -f "$_cf_tmp"
      echo "[sync-caddy] need root or sudo to write ${_fp}" >&2
      return 1
    fi
    rm -f "$_cf_tmp"
    _caddy_reload
    echo "[sync-caddy] site fragment ${_fp} (import master unchanged)  -  DEPLOY_SITE_DOMAIN=${DEPLOY_SITE_DOMAIN:-} APP_PORT=${APP_PORT:-${PORT:-3020}}"
    return 0
  fi

  if ! deploy_caddy_can_install_generated_master /etc/caddy/Caddyfile; then
    rm -f "$_cf_tmp"
    echo "[sync-caddy] Refused: /etc/caddy/Caddyfile is not deploy-managed (set CADDY_FORCE_REPLACE_MASTER=1 for single-file master)." >&2
    return 1
  fi
  _caddy_reload() {
    if [[ ${EUID:-0} -eq 0 ]]; then
      if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
        echo "[sync-caddy] Caddyfile valid"
        systemctl reload caddy
      else
        caddy validate --config /etc/caddy/Caddyfile
        return 1
      fi
    elif command -v sudo >/dev/null 2>&1; then
      if sudo caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
        echo "[sync-caddy] Caddyfile valid"
        sudo systemctl reload caddy
      else
        sudo caddy validate --config /etc/caddy/Caddyfile
        return 1
      fi
    else
      echo "[sync-caddy] need root or sudo for caddy validate / systemctl reload" >&2
      return 1
    fi
  }
  if [[ ${EUID:-0} -eq 0 ]]; then
    install -m 644 "$_cf_tmp" /etc/caddy/Caddyfile
  elif command -v sudo >/dev/null 2>&1; then
    sudo install -m 644 "$_cf_tmp" /etc/caddy/Caddyfile
  else
    rm -f "$_cf_tmp"
    echo "[sync-caddy] need root or sudo to write /etc/caddy/Caddyfile" >&2
    return 1
  fi
  rm -f "$_cf_tmp"
  _caddy_reload
  echo "[sync-caddy] reloaded Caddy (local)  -  DEPLOY_SITE_DOMAIN=${DEPLOY_SITE_DOMAIN:-} APP_PORT=${APP_PORT:-3020}"
}

cmd_sync_caddy_remote() {
  if [[ "${DEPLOY_PREREQ_DONE:-}" != "1" ]]; then
    prereq_laptop_ssh_deploy || exit 1
  fi
  case "$(_deploy_effective_caddy_sync_mode)" in
    skip|none|off|0|false)
      echo "[sync-caddy] DEPLOY_CADDY_SYNC_MODE=skip  -  not replacing /etc/caddy/Caddyfile (DEPLOY_AUTO_CADDY_SYNC=0 for shared hosts)."
      return 0
      ;;
    full|replace|overwrite|1|true|yes) ;;
    *)
      echo "[sync-caddy] Unknown DEPLOY_CADDY_SYNC_MODE=${DEPLOY_CADDY_SYNC_MODE:-}  -  use skip (default) or full." >&2
      return 1
      ;;
  esac
  _cf_tmp="$(mktemp)"
  deploy_write_https_caddyfile "$_cf_tmp" || {
    rm -f "$_cf_tmp"
    return 1
  }
  _remote_master="$(mktemp)"
  # shellcheck disable=SC2029
  deploy_ssh "cat /etc/caddy/Caddyfile 2>/dev/null || true" >"$_remote_master"

  if deploy_caddy_master_is_import_sites_layout "$_remote_master"; then
    _fp="$(deploy_caddy_sites_fragment_path)"
    _remote_frag="$(mktemp)"
    # shellcheck disable=SC2029
    deploy_ssh "cat ${_fp} 2>/dev/null || true" >"$_remote_frag"
    if ! deploy_caddy_can_install_generated_master "$_remote_frag"; then
      rm -f "$_remote_master" "$_remote_frag" "$_cf_tmp"
      echo "[sync-caddy] Refused: fragment ${_fp}  -  set CADDY_SITE_NAME to match sites/*.caddy, or CADDY_FORCE_REPLACE_MASTER=1 once." >&2
      return 1
    fi
    rm -f "$_remote_master" "$_remote_frag"
    deploy_scp "$_cf_tmp" "/tmp/Caddyfile.deploy-fragment"
    rm -f "$_cf_tmp"
    # shellcheck disable=SC2029
    deploy_ssh "set -euo pipefail
mkdir -p /etc/caddy/sites
install -m 644 /tmp/Caddyfile.deploy-fragment ${_fp}
if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then echo '[sync-caddy] Caddyfile valid'
else caddy validate --config /etc/caddy/Caddyfile || exit 1
fi
systemctl reload caddy"
    echo "[sync-caddy] site fragment ${_fp} on $(deploy_ssh_connection_target) (import master unchanged)  -  DEPLOY_SITE_DOMAIN=${DEPLOY_SITE_DOMAIN:-} APP_PORT=${APP_PORT:-${PORT:-3020}}"
    return 0
  fi

  if ! deploy_caddy_can_install_generated_master "$_remote_master"; then
    rm -f "$_remote_master" "$_cf_tmp"
    echo "[sync-caddy] Refused: existing /etc/caddy/Caddyfile is not deploy-managed (set CADDY_FORCE_REPLACE_MASTER=1 on single-file masters)." >&2
    return 1
  fi
  rm -f "$_remote_master"

  deploy_scp "$_cf_tmp" "/tmp/Caddyfile.deploy-sync"
  rm -f "$_cf_tmp"
  # shellcheck disable=SC2029
  deploy_ssh "set -euo pipefail
install -m 644 /tmp/Caddyfile.deploy-sync /etc/caddy/Caddyfile
if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then echo '[sync-caddy] Caddyfile valid'
else caddy validate --config /etc/caddy/Caddyfile || exit 1
fi
systemctl reload caddy"
  echo "[sync-caddy] reloaded Caddy on $(deploy_ssh_connection_target)  -  DEPLOY_SITE_DOMAIN=${DEPLOY_SITE_DOMAIN:-} APP_PORT=${APP_PORT:-${PORT:-3020}}"
}

cmd_sync_caddy() {
  require_env_files
  _load_lib
  if deploy_use_local_runner; then
    cmd_sync_caddy_local
  else
    deploy_ssh_require_env
    cmd_sync_caddy_remote
  fi
}

case "${1:-}" in
  bootstrap) cmd_bootstrap ;;
  update) cmd_update ;;
  sync-env) cmd_sync_env ;;
  sync-caddy) cmd_sync_caddy ;;
  -h|--help|help) usage ;;
  *) usage; exit 1 ;;
esac
