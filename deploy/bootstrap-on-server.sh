#!/usr/bin/env bash
# Run on Ubuntu via deploy/deploy_from_mac.sh bootstrap (piped over SSH). See deploy/README.md.
# Prerequisite checks are self-contained here (repo is not cloned yet).
set -euo pipefail

: "${DEPLOY_PATH:?DEPLOY_PATH required}"
: "${DEPLOY_GIT_URL:?DEPLOY_GIT_URL required}"
DOMAIN="${DOMAIN:-}"
SYSTEMD_UNIT="${SYSTEMD_UNIT:-${DEPLOY_SYSTEMD_UNIT:-app}}"
APP_PORT="${APP_PORT:-3020}"
SKIP_CADDY_BOOTSTRAP="${SKIP_CADDY_BOOTSTRAP:-0}"
CADDY_SITE_FRAGMENTS="${CADDY_SITE_FRAGMENTS:-0}"
CADDY_SITE_NAME="${CADDY_SITE_NAME:-}"
CADDY_FORCE_REPLACE_MASTER="${CADDY_FORCE_REPLACE_MASTER:-}"

export DEBIAN_FRONTEND=noninteractive

# Numbered steps (this script is often piped over SSH  -  do not rely on deploy/ui.sh on disk).
_BS_TOTAL=6
_BS_N=0
_bs_step() {
  _BS_N=$((_BS_N + 1))
  echo ""
  echo "========== [${_BS_N}/${_BS_TOTAL}] $1 =========="
  local w=26
  local f=$((_BS_N * w / _BS_TOTAL))
  local i
  printf "  ["
  for ((i = 0; i < w; i++)); do
    if ((i < f)); then printf "="; else printf "."; fi
  done
  printf "] %s%%\n" $((_BS_N * 100 / _BS_TOTAL))
}

_bs_ok() {
  printf "  OK  -  %s\n" "$1"
}

_bs_caddy_validate_quiet() {
  if caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
    _bs_ok "Caddyfile valid (verbose logs hidden on success)"
    return 0
  fi
  echo "[bootstrap-on-server] caddy validate failed:" >&2
  caddy validate --config /etc/caddy/Caddyfile >&2
  exit 1
}

_bs_step "System packages (apt) and optional Apache cleanup"
APT_PKGS=(curl ca-certificates git caddy openssl build-essential)
MISSING_APT=()
for pkg in "${APT_PKGS[@]}"; do
  if dpkg -s "$pkg" &>/dev/null 2>&1; then
    :
  else
    MISSING_APT+=("$pkg")
  fi
done
if [[ ${#MISSING_APT[@]} -gt 0 ]]; then
  echo "  Installing: ${MISSING_APT[*]}"
  apt-get update -qq
  apt-get install -y -qq "${MISSING_APT[@]}"
fi
_bs_ok "packages ready (${APT_PKGS[*]})"

if systemctl is-active apache2 >/dev/null 2>&1; then
  echo "  Stopping apache2 (it holds :80/:443; Caddy will serve HTTP/S)."
  systemctl stop apache2
  systemctl disable apache2
fi

_bs_step "Node.js 20+"
if command -v node >/dev/null 2>&1 && node -e "process.exit(Number(process.versions.node.split('.')[0]) >= 20 ? 0 : 1)" 2>/dev/null; then
  _bs_ok "Node.js $(node -v)"
else
  echo "  Installing Node.js via NodeSource…"
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y -qq nodejs
  _bs_ok "Node.js $(node -v) (installed)"
fi

_bs_ok "enabling pnpm via corepack"
corepack enable >/dev/null 2>&1 || true
corepack prepare pnpm@10.34.5 --activate
_bs_ok "pnpm $(pnpm --version 2>/dev/null || echo ready)"

_bs_step "Stop old app service, prepare paths, clone repository"
systemctl stop "${SYSTEMD_UNIT}" 2>/dev/null || true
rm -rf "$DEPLOY_PATH" /var/www/md-to-word
mkdir -p "$(dirname "$DEPLOY_PATH")"
if [[ "$DEPLOY_GIT_URL" == git@github.com:* ]]; then
  mkdir -p /root/.ssh
  chmod 700 /root/.ssh
  ssh-keyscan -t ed25519,rsa,ecdsa github.com >>/root/.ssh/known_hosts 2>/dev/null || true
fi
echo "  git clone → ${DEPLOY_PATH}"
git clone --depth 1 "$DEPLOY_GIT_URL" "$DEPLOY_PATH"
_bs_ok "repository cloned"

_bs_step "GitHub credentials (if any) and merge .env.prod → .env"
if [[ -n "${GITHUB_TOKEN:-}" ]]; then
  : "${GITHUB_REPO_SLUG:?Set GITHUB_REPO_SLUG=owner/repo in .env.local when using GITHUB_TOKEN (HTTPS clone + credential store)}"
  printf 'https://x-access-token:%s@github.com\n' "$GITHUB_TOKEN" >/root/.git-deploy-creds
  chmod 600 /root/.git-deploy-creds
  git config --global credential.helper 'store --file=/root/.git-deploy-creds'
  _gh_slug="$GITHUB_REPO_SLUG"
  git -C "$DEPLOY_PATH" remote set-url origin "https://github.com/${_gh_slug}.git"
  _bs_ok "HTTPS credential helper configured"
fi

if [[ -f "$DEPLOY_PATH/.env.prod" ]]; then
  echo "  merge .env.prod → .env (includes PORT for systemd EnvironmentFile)"
  # shellcheck disable=SC1091
  source "$DEPLOY_PATH/deploy/lib.sh"
  merge_env_prod_into_dotenv || {
    echo "[bootstrap-on-server] WARN: merge failed  -  create .env before systemctl start" >&2
  }
  _bs_ok "environment merged"
else
  echo "[bootstrap-on-server] WARN: no .env.prod  -  add .env with PORT= before starting the app" >&2
fi

_DEPLOY_SYS_TMPL="${DEPLOY_SYSTEMD_TEMPLATE:-app.service.in}"
sed "s|__DEPLOY_PATH__|${DEPLOY_PATH}|g" \
  "$DEPLOY_PATH/deploy/systemd/${_DEPLOY_SYS_TMPL}" >/tmp/deploy-app.service.unit
install -m 644 /tmp/deploy-app.service.unit "/etc/systemd/system/${SYSTEMD_UNIT}.service"
rm -f /tmp/deploy-app.service.unit
systemctl daemon-reload
_bs_ok "systemd unit ${SYSTEMD_UNIT}.service installed"

if [[ -f "$DEPLOY_PATH/deploy/lib.sh" ]]; then
  # shellcheck disable=SC1091
  source "$DEPLOY_PATH/deploy/lib.sh"
fi

_bs_step "Caddy reverse proxy (TLS / HTTP)"
if [[ "${SKIP_CADDY_BOOTSTRAP}" =~ ^(1|true|yes)$ ]]; then
  echo "  SKIP_CADDY_BOOTSTRAP  -  leaving /etc/caddy unchanged"
  _bs_ok "skipped"
elif [[ "${CADDY_SITE_FRAGMENTS}" =~ ^(1|true|yes)$ ]]; then
  if [[ -z "$DOMAIN" ]]; then
    echo "[bootstrap-on-server] ERROR: CADDY_SITE_FRAGMENTS=1 requires DOMAIN (and CADDY_SITE_NAME)" >&2
    exit 1
  fi
  if [[ -z "$CADDY_SITE_NAME" ]]; then
    echo "[bootstrap-on-server] ERROR: CADDY_SITE_NAME is required when CADDY_SITE_FRAGMENTS=1 (e.g. 01-myapp)" >&2
    exit 1
  fi
  echo "  Site fragment: DOMAIN=$DOMAIN → /etc/caddy/sites/${CADDY_SITE_NAME}.caddy → 127.0.0.1:${APP_PORT}"
  mkdir -p /etc/caddy/sites
  if [[ "${DOMAIN,,}" == www.* ]]; then
    _apex="${DOMAIN:4}"
    cat >"/etc/caddy/sites/${CADDY_SITE_NAME}.caddy" <<CF
${DEPLOY_CADDY_MANAGED_MARKER} fragment v1

$DOMAIN {
	reverse_proxy 127.0.0.1:${APP_PORT}
}

${_apex} {
	redir https://$DOMAIN{uri}
}
CF
  else
    cat >"/etc/caddy/sites/${CADDY_SITE_NAME}.caddy" <<CF
${DEPLOY_CADDY_MANAGED_MARKER} fragment v1

$DOMAIN {
	reverse_proxy 127.0.0.1:${APP_PORT}
}
CF
  fi
  chmod 644 "/etc/caddy/sites/${CADDY_SITE_NAME}.caddy"
  if [[ ! -s /etc/caddy/Caddyfile ]]; then
    echo "  Empty /etc/caddy/Caddyfile  -  writing import-only master (see deploy/README.md  -  Caddy)"
    printf '%s\n' 'import /etc/caddy/sites/*.caddy' >/etc/caddy/Caddyfile
  elif ! grep -qF 'import /etc/caddy/sites/*.caddy' /etc/caddy/Caddyfile 2>/dev/null; then
    echo "[warn] /etc/caddy/Caddyfile does not import /etc/caddy/sites/*.caddy  -  add that line (or merge the new site block). See deploy/README.md  -  Caddy"
  fi
  _bs_caddy_validate_quiet
  systemctl enable caddy
  systemctl restart caddy
elif [[ -n "$DOMAIN" ]]; then
  if declare -F deploy_caddy_master_replace_allowed >/dev/null 2>&1 &&
    ! deploy_caddy_master_replace_allowed /etc/caddy/Caddyfile; then
    echo "[bootstrap-on-server] Not overwriting existing /etc/caddy/Caddyfile (protects multi-site and other apps)." >&2
    echo "  Use CADDY_SITE_FRAGMENTS=1 + CADDY_SITE_NAME=..., or SKIP_CADDY_BOOTSTRAP=1, or CADDY_FORCE_REPLACE_MASTER=1 to replace the master file." >&2
    _bs_ok "Caddy master file left unchanged"
  elif [[ "${DOMAIN,,}" == www.* ]]; then
    _apex="${DOMAIN:4}"
    echo "  Single-file Caddyfile  -  canonical $DOMAIN, apex ${_apex} → 127.0.0.1:${APP_PORT}"
    cat >/etc/caddy/Caddyfile <<CF
${DEPLOY_CADDY_MANAGED_MARKER} v1

$DOMAIN {
	reverse_proxy 127.0.0.1:${APP_PORT}
}

${_apex} {
	redir https://$DOMAIN{uri}
}
CF
    _bs_caddy_validate_quiet
    systemctl enable caddy
    systemctl restart caddy
  else
    echo "  Single-file Caddyfile  -  DOMAIN=$DOMAIN → 127.0.0.1:${APP_PORT}"
    cat >/etc/caddy/Caddyfile <<CF
${DEPLOY_CADDY_MANAGED_MARKER} v1

$DOMAIN {
	reverse_proxy 127.0.0.1:${APP_PORT}
}
CF
    _bs_caddy_validate_quiet
    systemctl enable caddy
    systemctl restart caddy
  fi
else
  echo "  WARN: No DOMAIN (DEPLOY_SITE_DOMAIN unset)  -  Caddy is HTTP-only on :80 → 127.0.0.1:${APP_PORT}"
  echo "  No listener on :443 until you set DEPLOY_SITE_DOMAIN and re-bootstrap, or run sync-caddy from your laptop (see deploy/README.md)."
  if declare -F deploy_caddy_master_replace_allowed >/dev/null 2>&1 &&
    ! deploy_caddy_master_replace_allowed /etc/caddy/Caddyfile; then
    echo "[bootstrap-on-server] Not overwriting existing /etc/caddy/Caddyfile (protects multi-site and other apps)." >&2
    echo "  Use SKIP_CADDY_BOOTSTRAP=1 or CADDY_FORCE_REPLACE_MASTER=1 to force a single-site HTTP-only config." >&2
    _bs_ok "Caddy master file left unchanged"
  else
    cat >/etc/caddy/Caddyfile <<CF
${DEPLOY_CADDY_MANAGED_MARKER} v1-http-bootstrap

:80 {
	reverse_proxy 127.0.0.1:${APP_PORT}
}
CF
    _bs_caddy_validate_quiet
    systemctl enable caddy
    systemctl restart caddy
  fi
fi

if [[ ! "${SKIP_CADDY_BOOTSTRAP}" =~ ^(1|true|yes)$ ]]; then
  if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -qi "Status: active"; then
    if ! ufw status 2>/dev/null | grep -qE '443/tcp.*ALLOW| 443 .*ALLOW'; then
      echo "[bootstrap-on-server] WARN: ufw is active  -  ensure 80/tcp and 443/tcp are allowed (e.g. sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && sudo ufw reload) or HTTPS will fail."
    fi
  fi
  echo "  Cloud firewall: allow inbound TCP 80 and 443 on this VM (in addition to ufw)."
fi

_bs_step "Bootstrap complete"
echo ""
echo "  Next (on server): cd ${DEPLOY_PATH} && SKIP_PULL=1 bash deploy/update.sh && systemctl enable --now ${SYSTEMD_UNIT}"
echo "  App path: ${DEPLOY_PATH}"
echo ""
