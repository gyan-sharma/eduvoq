#!/usr/bin/env bash
# Deploy helpers: load env, prerequisite checks, SSH to server, git origin check.
# Source from repo root context: source "$ROOT/deploy/lib.sh"
# Generic Next.js + MySQL + Caddy pack  -  configure via .env.local / .env (see deploy/defaults.env.example).
# Runtime behavior is driven by env vars only; templated files use placeholders (e.g. __DEPLOY_PATH__), not product-specific renames.
# Do not use set -e in this file.

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source deploy/lib.sh from another script; do not execute directly." >&2
  exit 1
fi

_REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# Load deploy env for the current host:
# - Linux server updates: `.env` is canonical after `.env.prod` merge; do not let `.env.local` override it.
# - macOS / ad-hoc local runs: `.env.local` may intentionally override `.env` for laptop-specific settings.
# Call again after `merge_env_prod_into_dotenv` so exports match the merged file on disk.
deploy_reload_merged_env() {
  set -a
  if [[ -f "$_REPO_ROOT/.env" ]]; then
    # shellcheck disable=SC1091
    source "$_REPO_ROOT/.env"
  fi
  _deploy_load_local=0
  if [[ "${LOAD_DOTENV_LOCAL:-}" == "1" || "${DEPLOY_LOAD_DOTENV_LOCAL:-}" == "1" ]]; then
    _deploy_load_local=1
  elif [[ "$(uname -s)" == "Darwin" ]]; then
    _deploy_load_local=1
  fi
  if [[ "$_deploy_load_local" == "1" && -f "$_REPO_ROOT/.env.local" ]]; then
    # shellcheck disable=SC1091
    source "$_REPO_ROOT/.env.local"
  fi
  if [[ -n "${DEPLOY_SSH_PASSWORD:-}" && -z "${SSHPASS:-}" ]]; then
    export SSHPASS="$DEPLOY_SSH_PASSWORD"
  fi
  set +a
}

deploy_reload_merged_env

if [[ -f "$_REPO_ROOT/deploy/ui.sh" ]]; then
  # shellcheck disable=SC1091
  source "$_REPO_ROOT/deploy/ui.sh"
fi

# --- Generic deploy defaults (override in .env.local / merged .env on server) ---
DEPLOY_PATH="${DEPLOY_PATH:-/var/www/app}"
# systemd unit name (e.g. myapp).
DEPLOY_SYSTEMD_UNIT="${DEPLOY_SYSTEMD_UNIT:-app}"
DEPLOY_GIT_BRANCH="${DEPLOY_GIT_BRANCH:-main}"
DEPLOY_MODE="${DEPLOY_MODE:-}"
DEPLOY_SERVER_UPDATE="${DEPLOY_SERVER_UPDATE:-}"
DEPLOY_PREREQ_DONE="${DEPLOY_PREREQ_DONE:-}"
# Optional short name for user-facing messages (default: DEPLOY_SYSTEMD_UNIT).
DEPLOY_APP_LABEL="${DEPLOY_APP_LABEL:-${DEPLOY_SYSTEMD_UNIT:-app}}"

APP_PORT="${APP_PORT:-3020}"
# Caddy / first bootstrap: DOMAIN comes from DEPLOY_SITE_DOMAIN. If unset, derive hostname from PRODUCTION_PUBLIC_SITE_URL.
if [[ -z "${DEPLOY_SITE_DOMAIN:-}" && -n "${PRODUCTION_PUBLIC_SITE_URL:-}" ]]; then
  DEPLOY_SITE_DOMAIN="${PRODUCTION_PUBLIC_SITE_URL#*://}"
  DEPLOY_SITE_DOMAIN="${DEPLOY_SITE_DOMAIN%%/*}"
fi

DEPLOY_SYSTEMD_TEMPLATE="${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}"

# Laptop → server: multiplex one SSH session so npm run deploy/update does not open a new TCP
# connection per step (each would re-prompt for password or key passphrase).
# After the first successful ssh/scp, later commands reuse the same connection (ControlMaster).
# Set DEPLOY_SSH_MUX=0 to disable. See DEPLOY_SSH_* in deploy/defaults.env.example.
mkdir -p "${HOME}/.ssh"
chmod 700 "${HOME}/.ssh" 2>/dev/null || true
SSH_OPTS=(
  -o StrictHostKeyChecking=accept-new
  -o ServerAliveInterval=30
  -o ServerAliveCountMax=4
)
if [[ ! "${DEPLOY_SSH_MUX:-1}" =~ ^(0|false|no)$ ]]; then
  _deploy_ssh_mux_path="${DEPLOY_SSH_CONTROL_PATH:-${HOME}/.ssh/deploy_mux_%C}"
  SSH_OPTS+=(
    -o ControlMaster=auto
    -o "ControlPath=${_deploy_ssh_mux_path}"
    -o ControlPersist="${DEPLOY_SSH_CONTROL_PERSIST:-600}"
  )
fi
if [[ -n "${DEPLOY_SSH_IDENTITY_FILE:-}" ]]; then
  _deploy_ssh_id="${DEPLOY_SSH_IDENTITY_FILE/#\~/$HOME}"
  SSH_OPTS+=(-o "IdentityFile=${_deploy_ssh_id}")
fi
# Fail fast with keys only (no interactive password)  -  set DEPLOY_SSH_PUBLICKEY_ONLY=1 in .env.local
if [[ "${DEPLOY_SSH_PUBLICKEY_ONLY:-0}" =~ ^(1|true|yes)$ ]]; then
  SSH_OPTS+=(-o BatchMode=yes -o PreferredAuthentications=publickey)
fi

_deploy_ssh_wrap() {
  if [[ -n "${SSHPASS:-}" ]]; then
    command -v sshpass >/dev/null 2>&1 || {
      echo "[deploy] SSHPASS is set but sshpass is not installed." >&2
      echo "  macOS: brew install hudochenkov/sshpass/sshpass" >&2
      echo "  Debian/Ubuntu: sudo apt-get install -y sshpass" >&2
      return 127
    }
    sshpass -e "$@"
  else
    "$@"
  fi
}

prereq_is_darwin() { [[ "$(uname -s)" == "Darwin" ]]; }
prereq_is_linux() { [[ "$(uname -s)" == "Linux" ]]; }

# True when deploy/deploy_from_mac.sh should run commands in the current repo (no SSH to SSH_HOST).
# Override with DEPLOY_MODE=local|server|native vs remote|ssh.
deploy_use_local_runner() {
  case "${DEPLOY_MODE:-}" in
    local|server|native) return 0 ;;
    remote|ssh) return 1 ;;
  esac
  prereq_is_darwin && return 1
  prereq_is_linux || return 1
  local _pwd _ok=0 _unit="${DEPLOY_SYSTEMD_UNIT:-app}"
  _pwd="$(pwd -P)"
  [[ -f "/etc/systemd/system/${_unit}.service" ]] && _ok=1
  [[ "$_pwd" =~ ^/var/www/ ]] && _ok=1
  [[ "$_pwd" =~ ^/root/apps/ ]] && _ok=1
  if [[ -n "${DEPLOY_PATH:-}" ]]; then
    local _np _dp
    _np="$(readlink -f "$_pwd" 2>/dev/null || echo "$_pwd")"
    _dp="$(readlink -f "$DEPLOY_PATH" 2>/dev/null || echo "$DEPLOY_PATH")"
    [[ "$_np" == "$_dp" ]] && _ok=1
  fi
  [[ "$_ok" -eq 1 ]]
}

prereq_ok() {
  local msg="$*"
  if declare -F deploy_ui_prereq_ok >/dev/null 2>&1; then deploy_ui_prereq_ok "$msg"
  else echo "[prereq] ✓ $msg"
  fi
}
prereq_warn() {
  local msg="$*"
  if declare -F deploy_ui_prereq_warn >/dev/null 2>&1; then deploy_ui_prereq_warn "$msg"
  else echo "[prereq] ⚠ $msg"
  fi
}
prereq_bad() {
  local msg="$*"
  if declare -F deploy_ui_prereq_bad >/dev/null 2>&1; then deploy_ui_prereq_bad "$msg"
  else echo "[prereq] ✗ $msg"
  fi
}
prereq_have_cmd() { command -v "$1" >/dev/null 2>&1; }

deploy_echo_green() { printf '\033[32m%s\033[0m\n' "$1"; }

prereq_laptop_ssh_deploy() {
  echo ""
  if declare -F deploy_ui_dim >/dev/null 2>&1; then
    deploy_ui_dim "[prereq] Local machine  -  SSH deploy (key-based: ssh-agent or ~/.ssh/config)"
  else
    echo "[prereq] Local machine  -  SSH deploy (key-based: ssh-agent or ~/.ssh/config)"
  fi
  local fail=0
  if prereq_have_cmd ssh; then prereq_ok "ssh ($(command -v ssh))"; else prereq_bad "ssh"; fail=1; fi
  if prereq_have_cmd scp; then prereq_ok "scp ($(command -v scp))"; else prereq_bad "scp"; fail=1; fi
  if [[ -n "${SSHPASS:-}" ]]; then
    if prereq_have_cmd sshpass; then prereq_ok "sshpass (non-interactive password from SSHPASS)"
    else prereq_bad "sshpass (required when SSHPASS/DEPLOY_SSH_PASSWORD is set)"; fail=1; fi
  fi
  [[ "$fail" -ne 0 ]] && return 1
  if [[ -n "${SSH_USER:-}" && -z "${SSHPASS:-}" ]] && { [[ -n "${SSH_HOST:-}" ]] || [[ -n "${DEPLOY_SSH_DESTINATION:-}" ]]; }; then
    if declare -F deploy_ui_dim >/dev/null 2>&1; then
      deploy_ui_dim "[prereq] SSH: use ~/.ssh/config Host name as SSH_HOST (or DEPLOY_SSH_DESTINATION) so your saved key is used; ssh-copy-id if needed"
    else
      echo "[prereq] SSH: set SSH_HOST to your config Host alias (or DEPLOY_SSH_DESTINATION) for automatic keys  -  see deploy/defaults.env.example"
    fi
  fi
  prereq_have_cmd ssh && prereq_have_cmd scp
}

prereq_server_update_ubuntu() {
  echo ""
  if declare -F deploy_ui_dim >/dev/null 2>&1; then
    deploy_ui_dim "[prereq] Server  -  build and git tools"
  else
    echo "[prereq] Server  -  build and git tools"
  fi
  if ! prereq_is_linux; then
    prereq_warn "not Linux  -  apt auto-install skipped; need git, Node 20+, npm"
    prereq_have_cmd git || { prereq_bad "git"; return 1; }
    prereq_ok "git"
    if prereq_have_cmd node && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" 2>/dev/null; then
      prereq_ok "Node.js $(node -v)"
    else prereq_bad "Node.js 20+"; return 1; fi
    if prereq_have_cmd npm; then prereq_ok "npm ($(npm -v 2>/dev/null))"; else prereq_bad "npm"; return 1; fi
    return 0
  fi
  local fail=0
  if prereq_have_cmd git; then prereq_ok "git ($(git --version 2>/dev/null | head -1))"
  else
    prereq_bad "git"
    if [[ ${EUID:-0} -eq 0 ]]; then apt-get update -qq && apt-get install -y -qq git && prereq_ok "git (installed via apt)"
    elif prereq_have_cmd sudo; then sudo apt-get update -qq && sudo apt-get install -y -qq git && prereq_ok "git (installed via apt)"
    else echo "[prereq] Install git: sudo apt-get install -y git" >&2; fail=1; fi
  fi
  local node_ok=0
  if prereq_have_cmd node && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" 2>/dev/null; then
    prereq_ok "Node.js $(node -v)"; node_ok=1
  else
    prereq_bad "Node.js 20+"
    if [[ ${EUID:-0} -eq 0 ]]; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | bash
      apt-get install -y -qq nodejs
      prereq_ok "Node.js $(node -v) (installed via NodeSource)"; node_ok=1
    elif prereq_have_cmd sudo; then
      curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash
      sudo apt-get install -y -qq nodejs
      prereq_ok "Node.js $(node -v) (installed via NodeSource)"; node_ok=1
    else echo "[prereq] Install Node 20 as root or with sudo." >&2; fail=1; fi
  fi
  if prereq_have_cmd npm; then prereq_ok "npm ($(npm -v 2>/dev/null))"
  elif [[ "$node_ok" -eq 1 ]]; then prereq_ok "npm (bundled with node)"
  else prereq_bad "npm"; fail=1; fi
  if prereq_have_cmd systemctl; then prereq_ok "systemctl"
  else prereq_warn "systemctl not found  -  app service restart may be skipped"; fi
  [[ "$fail" -eq 0 ]]
}

prereq_server_github_setup() {
  echo ""
  if declare -F deploy_ui_dim >/dev/null 2>&1; then
    deploy_ui_dim "[prereq] Server  -  OpenSSH (GitHub SSH key setup)"
  else
    echo "[prereq] Server  -  OpenSSH (GitHub SSH key setup)"
  fi
  local fail=0
  prereq_have_cmd ssh-keygen || { prereq_bad "ssh-keygen"; fail=1; }
  prereq_have_cmd ssh || { prereq_bad "ssh"; fail=1; }
  prereq_have_cmd git || { prereq_bad "git"; fail=1; }
  [[ "$fail" -eq 0 ]]
}

# Require SSH_USER and either SSH_HOST or DEPLOY_SSH_DESTINATION (Host alias from ~/.ssh/config).
deploy_ssh_require_env() {
  : "${SSH_USER:?Set SSH_USER in .env.local}"
  if [[ -z "${DEPLOY_SSH_DESTINATION:-}" ]]; then
    : "${SSH_HOST:?Set SSH_HOST in .env.local to the Host name from ~/.ssh/config (so IdentityFile applies), or set DEPLOY_SSH_DESTINATION}"
  fi
}

# ssh(1) / scp destination: use DEPLOY_SSH_DESTINATION when set (Host alias → IdentityFile from config),
# else SSH_USER@SSH_HOST. Full override: DEPLOY_SSH_DESTINATION=user@host
deploy_ssh_connection_target() {
  if [[ -n "${DEPLOY_SSH_DESTINATION:-}" ]]; then
    if [[ "${DEPLOY_SSH_DESTINATION}" == *@* ]]; then
      printf '%s\n' "${DEPLOY_SSH_DESTINATION}"
    else
      printf '%s\n' "${SSH_USER}@${DEPLOY_SSH_DESTINATION}"
    fi
    return 0
  fi
  printf '%s\n' "${SSH_USER}@${SSH_HOST}"
}

deploy_ssh() {
  deploy_ssh_require_env
  local _dest
  _dest="$(deploy_ssh_connection_target)"
  _deploy_ssh_wrap ssh "${SSH_OPTS[@]}" "$_dest" "$@"
}

deploy_ssh_bash() {
  deploy_ssh_require_env
  local script="$1" _dest
  _dest="$(deploy_ssh_connection_target)"
  printf '%s\n' "$script" | _deploy_ssh_wrap ssh "${SSH_OPTS[@]}" "$_dest" bash -s
}

deploy_scp() {
  deploy_ssh_require_env
  local src="$1" dest="$2" _dest
  _dest="$(deploy_ssh_connection_target)"
  _deploy_ssh_wrap scp "${SSH_OPTS[@]}" "$src" "${_dest}:$dest"
}

# Rewrites origin to SSH or HTTPS+token so non-interactive fetch works (was deploy/ensure-github-fetch-origin.sh).
deploy_ensure_github_fetch_origin() {
  if ! command -v git >/dev/null 2>&1; then
    echo "[prereq] ✗ git is required for deploy_ensure_github_fetch_origin" >&2
    return 1
  fi
  local O path owner repo token new_url use_ssh
  O=$(git remote get-url origin 2>/dev/null || true)
  if [[ ! "$O" =~ github\.com[:/](.+)$ ]]; then
    return 0
  fi
  path="${BASH_REMATCH[1]}"
  path=${path%.git}
  owner=${path%%/*}
  repo=${path#*/}
  token="${GITHUB_TOKEN:-}"
  token="${token#"${token%%[![:space:]]*}"}"
  token="${token%"${token##*[![:space:]]}"}"
  use_ssh=0
  if [[ "${GITHUB_USE_SSH:-}" == "1" ]] || [[ -z "$token" ]]; then
    use_ssh=1
  fi
  if [[ "$use_ssh" == "1" ]]; then
    new_url="git@github.com:${owner}/${repo}.git"
  else
    new_url="https://x-access-token:${token}@github.com/${owner}/${repo}.git"
  fi
  if [[ "$O" == "$new_url" ]]; then
    echo "[ensure-github-fetch-origin] origin already set for $([[ "$use_ssh" == 1 ]] && echo SSH || echo HTTPS+token)"
    return 0
  fi
  git remote set-url origin "$new_url" || return 1
  if [[ "$use_ssh" == "1" ]]; then
    echo "[ensure-github-fetch-origin] origin set to SSH (git@github.com:${owner}/${repo}.git)"
  else
    echo "[ensure-github-fetch-origin] origin set to HTTPS with token (non-interactive)"
  fi
}

# Sets GIT_SSH_COMMAND from GITHUB_DEPLOY_KEY_PATH in .env.prod (was deploy/load-github-deploy-key-git-ssh.sh).
deploy_load_github_deploy_key_git_ssh() {
  local _PROD _val line
  _PROD="$_REPO_ROOT/.env.prod"
  [[ -f "$_PROD" ]] || return 0
  _val=""
  while IFS= read -r line || [[ -n "$line" ]]; do
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    if [[ "$line" =~ ^[[:space:]]*GITHUB_DEPLOY_KEY_PATH=(.*)$ ]]; then
      _val="${BASH_REMATCH[1]}"
      _val="${_val#"${_val%%[![:space:]]*}"}"
      _val="${_val%"${_val##*[![:space:]]}"}"
      _val="${_val#\"}"
      _val="${_val%\"}"
      _val="${_val#\'}"
      _val="${_val%\'}"
      break
    fi
  done <"$_PROD"
  if [[ -n "$_val" && -f "$_val" ]]; then
    export GITHUB_DEPLOY_KEY_PATH="$_val"
    export GIT_SSH_COMMAND="ssh -i ${_val} -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new"
    echo "[github-deploy-key] GIT_SSH_COMMAND using ${_val}" >&2
  fi
}

# Merge committed `.env.prod` into `.env` (after `git pull`). Compatible with bash 3.2 and 4+.
# Non-protected keys from `.env.prod` always apply. Protected keys: if already non-empty in `.env`, keep them.
# Extra keys in `.env` not in `.env.prod` are appended. Uses `_REPO_ROOT` (repo containing `deploy/`).
merge_env_prod_into_dotenv() {
  (
    set -euo pipefail
    if ! command -v grep >/dev/null 2>&1 || ! command -v mktemp >/dev/null 2>&1; then
      echo "[merge-env-prod] ✗ grep and mktemp are required" >&2
      exit 1
    fi
    PROD="$_REPO_ROOT/.env.prod"
    TARGET="$_REPO_ROOT/.env"
    PROTECTED=(DATABASE_URL SQL_USERNAME SQL_PASSWORD CMS_ADMIN_PASSWORD CMS_ADMIN_SESSION_SECRET)

    [[ -f "$PROD" ]] || {
      echo "[merge-env-prod] no .env.prod, skip"
      exit 0
    }

    protected_file="$(mktemp)"
    trap 'rm -f "$protected_file"' EXIT

    if [[ -f "$TARGET" ]]; then
      for pk in "${PROTECTED[@]}"; do
        line="$(grep -E "^${pk}=" "$TARGET" 2>/dev/null | tail -1 || true)"
        if [[ -n "$line" ]]; then
          val="${line#*=}"
          keep_existing=1
          if [[ "$pk" == "DATABASE_URL" ]] && [[ "$val" =~ mysql://root@localhost ]]; then
            keep_existing=0
          fi
          if [[ -n "$val" && "$keep_existing" -eq 1 ]]; then
            printf '%s\n' "$line" >>"$protected_file"
          fi
        fi
      done
    fi

    tmp="$(mktemp)"
    trap 'rm -f "$protected_file" "$tmp"' EXIT

    while IFS= read -r line || [[ -n "$line" ]]; do
      if [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]]; then
        printf '%s\n' "$line" >>"$tmp"
        continue
      fi
      [[ "$line" =~ ^([^=]+)=(.*)$ ]] || {
        printf '%s\n' "$line" >>"$tmp"
        continue
      }
      key="${BASH_REMATCH[1]}"
      skip=0
      for pk in "${PROTECTED[@]}"; do
        if [[ "$key" == "$pk" ]]; then
          kept="$(grep -E "^${pk}=" "$protected_file" 2>/dev/null | tail -1 || true)"
          if [[ -n "$kept" ]]; then
            printf '%s\n' "$kept" >>"$tmp"
            skip=1
          fi
          break
        fi
      done
      [[ "$skip" -eq 1 ]] && continue
      printf '%s\n' "$line" >>"$tmp"
    done <"$PROD"

    if [[ -f "$TARGET" ]]; then
      while IFS= read -r line || [[ -n "$line" ]]; do
        [[ -z "$line" || "$line" =~ ^[[:space:]]*# ]] && continue
        [[ "$line" =~ ^([^=]+)=(.*)$ ]] || continue
        key="${BASH_REMATCH[1]}"
        if ! grep -qE "^${key}=" "$PROD" 2>/dev/null; then
          if ! grep -qE "^${key}=" "$tmp" 2>/dev/null; then
            printf '%s\n' "$line" >>"$tmp"
          fi
        fi
      done <"$TARGET"
    fi

    mv "$tmp" "$TARGET"
    trap 'rm -f "$protected_file"' EXIT
    chmod 640 "$TARGET" 2>/dev/null || true
    chown www-data:www-data "$TARGET" 2>/dev/null || true
    echo "[merge-env-prod] merged .env.prod into .env"
  )
}

# Run from repo root (pwd); respects SKIP_GIT_CHECK=1
deploy_git_check() {
  if [[ "${SKIP_GIT_CHECK:-0}" == "1" ]]; then
    echo "[git] SKIP_GIT_CHECK=1  -  skipping origin check"
    return 0
  fi
  if ! command -v git >/dev/null 2>&1; then echo "[git] ✗ git is required" >&2; return 1; fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "[git] ✗ not a git repository" >&2; return 1; fi
  echo "[git] Configuring origin for non-interactive fetch…"
  deploy_ensure_github_fetch_origin || return 1
  deploy_load_github_deploy_key_git_ssh
  echo "[git] Verifying read access to origin (git ls-remote)…"
  if ! git ls-remote -q origin HEAD >/dev/null 2>&1; then
    echo "[git] ✗ Cannot read from origin. Fix GITHUB_TOKEN, deploy key, or network." >&2
    return 1
  fi
  echo "[git] ✓ Origin reachable"
}

_deploy_git_restore_stashed_untracked_env() {
  local bk="$1"
  [[ -n "$bk" && -s "$bk" ]] || return 0
  if [[ ! -f .env ]]; then
    cp "$bk" .env
    echo "[git] restored stashed untracked .env after failed sync step" >&2
  fi
  rm -f "$bk"
}

# Run from repository root (pwd). Resets to origin/$DEPLOY_GIT_BRANCH (default main).
deploy_git_sync_to_origin_main() {
  if ! command -v git >/dev/null 2>&1; then echo "[git] ✗ git is required" >&2; return 1; fi
  if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then echo "[git] ✗ not a git repository" >&2; return 1; fi

  local _br="${DEPLOY_GIT_BRANCH:-main}"
  local ENV_PULL_BK=""
  if [[ -f .env ]] && ! git ls-files --error-unmatch .env >/dev/null 2>&1; then
    ENV_PULL_BK="$(mktemp)"
    cp .env "$ENV_PULL_BK"
    rm .env
    echo "[git] moved aside untracked .env so pull can apply tracked copy from the repo"
  fi

  if ! deploy_git_check; then
    _deploy_git_restore_stashed_untracked_env "$ENV_PULL_BK"
    return 1
  fi
  if ! git fetch -q origin; then
    _deploy_git_restore_stashed_untracked_env "$ENV_PULL_BK"
    return 1
  fi
  if ! git reset --hard -q "origin/${_br}"; then
    _deploy_git_restore_stashed_untracked_env "$ENV_PULL_BK"
    return 1
  fi

  if [[ ! -f .env && -n "$ENV_PULL_BK" && -s "$ENV_PULL_BK" ]]; then
    cp "$ENV_PULL_BK" .env
    echo "[git] restored previous .env (remote tree has no .env file)"
  fi
  rm -f "$ENV_PULL_BK"
}

# Returns 0 if it is OK to replace /etc/caddy/Caddyfile with a generated single-site file.
# Any existing non-empty file is treated as potentially multi-site  -  blocked unless
# CADDY_FORCE_REPLACE_MASTER=1 (explicit wipe of the master file).
deploy_caddy_master_replace_allowed() {
  local f="${1:-/etc/caddy/Caddyfile}"
  if [[ "${CADDY_FORCE_REPLACE_MASTER:-}" =~ ^(1|true|yes)$ ]]; then
    return 0
  fi
  if [[ ! -f "$f" || ! -s "$f" ]]; then
    return 0
  fi
  return 1
}

# Written into Caddyfiles we generate; allows non-interactive replace on later deploys.
DEPLOY_CADDY_MANAGED_MARKER='# neojn-deploy-managed'

# 0 = safe to install deploy_write_https_caddyfile() over this master file (auto updates).
deploy_caddy_can_install_generated_master() {
  local f="${1:-/etc/caddy/Caddyfile}"
  if deploy_caddy_master_replace_allowed "$f"; then
    return 0
  fi
  if [[ "${DEPLOY_CADDY_TRUST_AUTO_OVERWRITE:-1}" =~ ^(0|false|no)$ ]]; then
    return 1
  fi
  if [[ -f "$f" ]] && grep -qF 'neojn-deploy-managed' "$f" 2>/dev/null; then
    return 0
  fi
  # Legacy: bootstrap HTTP-only stub when DOMAIN was unset (tiny :80 { reverse_proxy ... }).
  local sz
  sz=$(wc -c <"$f" 2>/dev/null | tr -d ' ' || echo 99999)
  if [[ "${sz:-99999}" -lt 450 ]] && grep -qE '^:80[[:space:]]*\{' "$f" 2>/dev/null && grep -q 'reverse_proxy 127\.0\.0\.1:' "$f" 2>/dev/null; then
    return 0
  fi
  return 1
}

# True if master only imports site fragments (multi-site safe  -  we update a file under sites/).
deploy_caddy_master_is_import_sites_layout() {
  local f="${1:-/etc/caddy/Caddyfile}"
  [[ -f "$f" ]] && grep -qF 'import /etc/caddy/sites' "$f" 2>/dev/null
}

# Fragment path for this app (CADDY_SITE_NAME without .caddy suffix; default neojn).
deploy_caddy_sites_fragment_path() {
  local n="${CADDY_SITE_NAME:-neojn}"
  n="${n%.caddy}"
  printf '%s\n' "/etc/caddy/sites/${n}.caddy"
}

# On the app host: refresh Caddy during server-native update (root only).
# Import layout: write /etc/caddy/sites/${CADDY_SITE_NAME}.caddy only. Single-file layout: replace master when allowed.
deploy_apply_caddy_master_from_env() {
  [[ "${DEPLOY_CADDY_APPLY_ON_SERVER_UPDATE:-1}" =~ ^(1|true|yes)$ ]] || return 0
  [[ -n "${DEPLOY_SITE_DOMAIN:-}" ]] || return 0
  command -v caddy >/dev/null 2>&1 || return 0
  if [[ "$(id -u)" -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    return 0
  fi
  local tmp mf="/etc/caddy/Caddyfile"
  tmp="$(mktemp)"
  if ! deploy_write_https_caddyfile "$tmp"; then
    rm -f "$tmp"
    return 0
  fi

  if deploy_caddy_master_is_import_sites_layout "$mf"; then
    local fp
    fp="$(deploy_caddy_sites_fragment_path)"
    if ! deploy_caddy_can_install_generated_master "$fp"; then
      rm -f "$tmp"
      echo "[update:caddy] fragment ${fp} not updated (not deploy-managed). Set CADDY_SITE_NAME to match your file, or CADDY_FORCE_REPLACE_MASTER=1 once." >&2
      return 0
    fi
    if [[ "$(id -u)" -eq 0 ]]; then
      mkdir -p /etc/caddy/sites
      install -m 644 "$tmp" "$fp"
    else
      sudo mkdir -p /etc/caddy/sites
      sudo install -m 644 "$tmp" "$fp"
    fi
    rm -f "$tmp"
    if caddy validate --config "$mf" >/dev/null 2>&1; then
      if [[ "$(id -u)" -eq 0 ]]; then systemctl reload caddy 2>/dev/null || true; else sudo systemctl reload caddy 2>/dev/null || true; fi
      echo "[update] Caddy: site fragment ${fp} (import master unchanged)"
    else
      echo "[update:caddy] caddy validate failed after fragment write" >&2
      return 1
    fi
    return 0
  fi

  if ! deploy_caddy_can_install_generated_master "$mf"; then
    rm -f "$tmp"
    echo "[update:caddy] /etc/caddy/Caddyfile not overwritten (not deploy-managed)." >&2
    return 0
  fi
  if [[ "$(id -u)" -eq 0 ]]; then
    install -m 644 "$tmp" "$mf"
  else
    sudo install -m 644 "$tmp" "$mf"
  fi
  rm -f "$tmp"
  if caddy validate --config "$mf" >/dev/null 2>&1; then
    if [[ "$(id -u)" -eq 0 ]]; then systemctl reload caddy 2>/dev/null || true; else sudo systemctl reload caddy 2>/dev/null || true; fi
    echo "[update] Caddy: HTTPS site refreshed from DEPLOY_SITE_DOMAIN + APP_PORT"
  else
    echo "[update:caddy] caddy validate failed  -  restore manually if needed" >&2
    return 1
  fi
}

# Single-site TLS Caddyfile (same shape as bootstrap-on-server.sh). Uses env:
#   DEPLOY_SITE_DOMAIN  -  required (or set PRODUCTION_PUBLIC_SITE_URL so lib derives it)
#   APP_PORT  -  upstream Node (default 3020)
# Callers must use deploy_caddy_master_replace_allowed before installing to /etc/caddy/Caddyfile.
deploy_write_https_caddyfile() {
  local out="$1"
  [[ -n "$out" ]] || {
    echo "[deploy:caddy] output path required" >&2
    return 1
  }
  local domain="${DEPLOY_SITE_DOMAIN:-}"
  local port="${APP_PORT:-${PORT:-3020}}"
  if [[ -z "$domain" ]]; then
    echo "[deploy:caddy] Set DEPLOY_SITE_DOMAIN or PRODUCTION_PUBLIC_SITE_URL for HTTPS Caddy config." >&2
    return 1
  fi
  local _dl
  _dl=$(printf '%s' "$domain" | tr '[:upper:]' '[:lower:]')
  if [[ "$_dl" == www.* ]]; then
    local _apex="${domain:4}"
    cat >"$out" <<CF
${DEPLOY_CADDY_MANAGED_MARKER} v1

${domain} {
	reverse_proxy 127.0.0.1:${port}
}

${_apex} {
	redir https://${domain}{uri}
}
CF
  else
    cat >"$out" <<CF
${DEPLOY_CADDY_MANAGED_MARKER} v1

${domain} {
	reverse_proxy 127.0.0.1:${port}
}
CF
  fi
}


# Existing installs must use the non-destructive update path. Bootstrap is
# reserved for a new target and otherwise removes the deployment directory.
deploy_installation_exists_local() {
  local path="${DEPLOY_PATH:-/var/www/app}"
  local unit="${DEPLOY_SYSTEMD_UNIT:-app}"
  if [[ -d "$path/.git" || -f "$path/package.json" || -f "/etc/systemd/system/${unit}.service" ]]; then
    return 0
  fi
  [[ -d "$path" ]] || return 1
  shopt -s nullglob dotglob
  local entries=("$path"/*)
  (( ${#entries[@]} > 0 ))
}

deploy_installation_exists_remote() {
  local path_arg unit_arg result
  path_arg="$(printf '%q' "${DEPLOY_PATH:-/var/www/app}")"
  unit_arg="$(printf '%q' "${DEPLOY_SYSTEMD_UNIT:-app}")"
  result="$(
    deploy_ssh \
      "if [ -d ${path_arg}/.git ] || [ -f ${path_arg}/package.json ] || [ -f /etc/systemd/system/${unit_arg}.service ] || { [ -d ${path_arg} ] && [ -n \"\$(ls -A -- ${path_arg} 2>/dev/null)\" ]; }; then printf existing; else printf new; fi"
  )"
  [[ "$result" == "existing" ]]
}

