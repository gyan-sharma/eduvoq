#!/usr/bin/env bash
set -euo pipefail

# Ubuntu server: repo checkout directory (any path if it matches DEPLOY_PATH or common app dirs). See deploy/README.md.
# Usage: SKIP_PULL=1 bash deploy/update.sh  (or npm run update on the app host / from laptop via deploy/deploy_from_mac.sh)
#
# Optional skips (see deploy/README.md):
#   SKIP_DB_CHECK=1    -  skip mysql connectivity check (use while fixing DATABASE_URL / MySQL)
#   SKIP_DB_SEED=1     -  run migrations only; skip `prisma db seed` (typical for routine prod deploys)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

# shellcheck disable=SC1091
source "$ROOT/deploy/lib.sh"

# Less noisy npm / npx (progress bars and audit summaries clutter CI and deploy logs).
export NPM_CONFIG_PROGRESS="${NPM_CONFIG_PROGRESS:-false}"
export NPM_CONFIG_FUND="${NPM_CONFIG_FUND:-false}"
export NPM_CONFIG_AUDIT="${NPM_CONFIG_AUDIT:-false}"
if declare -F deploy_ui_set_total >/dev/null 2>&1; then
  deploy_ui_set_total 9
  deploy_ui_banner "Deploy: update pipeline"
fi

if [[ "${DEPLOY_SERVER_UPDATE:-}" != "1" ]]; then
  _pwd="$(pwd -P)"
  _ok=0
  _unit="${DEPLOY_SYSTEMD_UNIT:-app}"
  [[ -f "/etc/systemd/system/${_unit}.service" ]] && _ok=1
  [[ "$_pwd" =~ ^/var/www/ ]] && _ok=1
  [[ "$_pwd" =~ ^/root/apps/ ]] && _ok=1
  if [[ -n "${DEPLOY_PATH:-}" ]]; then
    _np="$(readlink -f "$_pwd" 2>/dev/null || echo "$_pwd")"
    _dp="$(readlink -f "$DEPLOY_PATH" 2>/dev/null || echo "$DEPLOY_PATH")"
    [[ "$_np" == "$_dp" ]] && _ok=1
  fi
  [[ "$_ok" -eq 1 ]] || {
    echo "[update] Refusing to run here (git reset --hard is destructive)." >&2
    echo "  From your Mac: npm run update" >&2
    echo "  Or: cwd matches DEPLOY_PATH, or is under /var/www or /root/apps, or systemd unit DEPLOY_SYSTEMD_UNIT (default app) exists." >&2
    echo "  Override once: DEPLOY_SERVER_UPDATE=1" >&2
    exit 1
  }
fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Server prerequisites (git, Node, npm)"; fi
prereq_server_update_ubuntu || exit 1
if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "tools ready"; fi

if [[ "${SKIP_PULL:-0}" != 1 ]]; then
  if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Sync repository to origin/${DEPLOY_GIT_BRANCH:-main}"; fi
  deploy_git_sync_to_origin_main || exit 1
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "repo at origin/${DEPLOY_GIT_BRANCH:-main}"; fi
else
  if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Git (SKIP_PULL=1  -  verify origin only)"; fi
  deploy_git_check || exit 1
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "origin reachable"; fi
fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Merge .env.prod into server .env"; fi
if [[ -f "$ROOT/.env.prod" ]]; then
  merge_env_prod_into_dotenv
  deploy_reload_merged_env
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "environment merged"; fi
else
  deploy_reload_merged_env
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "no .env.prod in repo (loaded .env only)"; fi
fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Install pnpm dependencies"; fi
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.34.5 --activate
pnpm install --frozen-lockfile
if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "node_modules installed"; fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Verify MySQL (DATABASE_URL)"; fi
if [[ "${SKIP_DB_CHECK:-0}" == 1 ]]; then
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "skipped (SKIP_DB_CHECK=1)"; fi
else
  # Use the env already loaded by `deploy/lib.sh` / `deploy_reload_merged_env`; do not re-merge
  # `.env.prod` during routine updates.
  node "$ROOT/deploy/mysql.mjs" check || exit 1
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "database reachable"; fi
fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Prisma migrate + seed"; fi
pnpm exec prisma generate
pnpm exec prisma migrate deploy
if [[ "${SKIP_DB_SEED:-0}" == 1 ]]; then
  if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "seed skipped (SKIP_DB_SEED=1)"; fi
else
  pnpm db:seed
fi
if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "schema up to date"; fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Production build (next build)"; fi
# shellcheck disable=SC1091
if [[ -f "$ROOT/deploy/infer-build-heap.inc.sh" ]]; then
  source "$ROOT/deploy/infer-build-heap.inc.sh"
fi
_heap="${BUILD_NODE_HEAP_MB:-}"
if [[ -z "$_heap" ]] && declare -F infer_build_heap_mb >/dev/null 2>&1; then
  _heap="$(infer_build_heap_mb)"
fi
_heap="${_heap:-1536}"
if [[ "$_heap" -gt 1536 ]]; then
  _heap=1536
fi
echo "[update] next build NODE_OPTIONS=--max-old-space-size=${_heap} (crowded 8G host)"
NODE_OPTIONS="--max-old-space-size=${_heap}" NEXT_BUILD_CPUS="${NEXT_BUILD_CPUS:-1}" pnpm build
if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "build finished"; fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Copy static assets into standalone bundle"; fi
rm -rf .next/standalone/.next/static .next/standalone/public
mkdir -p .next/standalone/.next/static
cp -r .next/static .next/standalone/.next/
cp -r public .next/standalone/
if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "standalone tree ready"; fi

if declare -F deploy_ui_step >/dev/null 2>&1; then deploy_ui_step "Permissions + systemd restart"; fi
if declare -F deploy_ui_info >/dev/null 2>&1; then
  deploy_ui_info "[update] permissions (www-data can read build + env)"
else
  echo "[update] permissions (www-data can read build + env)"
fi
if id www-data >/dev/null 2>&1; then
  mkdir -p "$ROOT/storage"
  chown -R www-data:www-data "$ROOT/.next" "$ROOT/storage" || true
  chmod 0750 "$ROOT/storage" || true
  if [[ -f "$ROOT/.env" ]]; then
    chown www-data:www-data "$ROOT/.env" || true
    chmod 640 "$ROOT/.env" || true
  fi
fi

_unit="${DEPLOY_SYSTEMD_UNIT:-app}"
_tmpl="${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}"
_svc_in="$ROOT/deploy/systemd/${_tmpl}"
# Only touch systemd when this host already has the unit (avoids writing /etc on random Linux checkouts).
if [[ -f "$_svc_in" && -f "/etc/systemd/system/${_unit}.service" ]]; then
  sed "s|__DEPLOY_PATH__|${ROOT}|g" "$_svc_in" >/tmp/deploy-app.service.unit.$$
  install -m 644 /tmp/deploy-app.service.unit.$$ "/etc/systemd/system/${_unit}.service"
  rm -f /tmp/deploy-app.service.unit.$$
  if declare -F deploy_ui_info >/dev/null 2>&1; then
    deploy_ui_info "[update] refreshed /etc/systemd/system/${_unit}.service (PORT from merged .env)"
  else
    echo "[update] refreshed /etc/systemd/system/${_unit}.service (PORT from merged .env)"
  fi
fi
if [[ -f "/etc/systemd/system/${_unit}.service" ]]; then
  if declare -F deploy_ui_info >/dev/null 2>&1; then
    deploy_ui_info "[update] systemctl daemon-reload && restart ${_unit}"
  else
    echo "[update] systemctl daemon-reload && restart ${_unit}"
  fi
  systemctl daemon-reload
  systemctl restart "${_unit}" 2>/dev/null || true
else
  if declare -F deploy_ui_yellow >/dev/null 2>&1; then
    deploy_ui_yellow "[update] no /etc/systemd/system/${_unit}.service (install from deploy/systemd/${_tmpl}; set DEPLOY_SYSTEMD_UNIT)" >&2
  else
    echo "[update] no /etc/systemd/system/${_unit}.service (install from deploy/systemd/${_tmpl}; set DEPLOY_SYSTEMD_UNIT)" >&2
  fi
fi

if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "service restarted (if unit exists)"; fi

if declare -F deploy_apply_caddy_master_from_env >/dev/null 2>&1; then
  deploy_apply_caddy_master_from_env || true
fi

if [[ "${DEPLOY_VERIFY_HTTPS:-1}" =~ ^(1|true|yes)$ ]] && command -v curl >/dev/null 2>&1; then
  _probe="${PRODUCTION_PUBLIC_SITE_URL:-}"
  [[ -z "$_probe" ]] && _probe="${NEXT_PUBLIC_SITE_URL:-}"
  if [[ -n "$_probe" ]]; then
    sleep "${DEPLOY_HTTPS_PROBE_DELAY:-3}" 2>/dev/null || sleep 3
    if curl -sfIL --max-time 30 "$_probe" >/dev/null 2>&1; then
      if declare -F deploy_ui_ok >/dev/null 2>&1; then deploy_ui_ok "HTTPS reachable (${_probe})"; fi
    else
      if declare -F deploy_ui_warn >/dev/null 2>&1; then
        deploy_ui_warn "HTTPS probe failed for ${_probe}  -  ensure DNS A/AAAA → this host, ports 80/443 open, then: journalctl -u caddy -n 40"
      else
        echo "[update] WARN: HTTPS probe failed for ${_probe}" >&2
      fi
    fi
  fi
fi

if declare -F deploy_ui_success_final >/dev/null 2>&1; then
  deploy_ui_success_final "Update successful  -  app is running."
else
  deploy_echo_green "[update] Update successful."
fi
