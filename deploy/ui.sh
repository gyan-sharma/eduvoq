#!/usr/bin/env bash
# Pretty deploy output (numbered steps, optional progress bar). Source from deploy/lib.sh only.
# Disable: DEPLOY_PRETTY=0 or NO_COLOR=1 (colors only; steps still print).

if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
  echo "Source deploy/ui.sh; do not execute directly." >&2
  exit 1
fi

[[ "${DEPLOY_UI_LOADED:-}" == "1" ]] && return 0
DEPLOY_UI_LOADED=1

DEPLOY_UI_STEP=0
DEPLOY_UI_TOTAL="${DEPLOY_UI_TOTAL:-0}"

deploy_ui_pretty() {
  [[ "${DEPLOY_PRETTY:-1}" =~ ^(1|true|yes)$ ]]
}

# Colors when pretty is on and (stdout is a TTY, or FORCE_COLOR / DEPLOY_FORCE_COLOR is set).
deploy_ui_tty_color() {
  deploy_ui_pretty || return 1
  [[ -n "${NO_COLOR:-}" ]] && return 1
  [[ -n "${FORCE_COLOR:-}" || -n "${DEPLOY_FORCE_COLOR:-}" ]] && return 0
  [[ -t 1 ]]
}

deploy_ui_bold() {
  if deploy_ui_tty_color; then printf '\033[1m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

deploy_ui_green() {
  if deploy_ui_tty_color; then printf '\033[32m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

deploy_ui_dim() {
  if deploy_ui_tty_color; then printf '\033[2m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

deploy_ui_cyan() {
  if deploy_ui_tty_color; then printf '\033[36m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

deploy_ui_yellow() {
  if deploy_ui_tty_color; then printf '\033[33m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

deploy_ui_red() {
  if deploy_ui_tty_color; then printf '\033[31m%s\033[0m\n' "$1"; else printf '%s\n' "$1"; fi
}

# Dim informational line (e.g. sub-steps in update.sh).
deploy_ui_info() {
  deploy_ui_dim "     $1"
}

# Prerequisite lines (sourced from deploy/lib.sh).
deploy_ui_prereq_ok() {
  local msg="$1"
  if deploy_ui_tty_color; then printf '\033[32m[prereq] ✓ %s\033[0m\n' "$msg"
  else printf '[prereq] ✓ %s\n' "$msg"; fi
}

deploy_ui_prereq_warn() {
  local msg="$1"
  if deploy_ui_tty_color; then printf '\033[33m[prereq] ⚠ %s\033[0m\n' "$msg"
  else printf '[prereq] ⚠ %s\n' "$msg"; fi
}

deploy_ui_prereq_bad() {
  local msg="$1"
  if deploy_ui_tty_color; then printf '\033[31m[prereq] ✗ %s\033[0m\n' "$msg"
  else printf '[prereq] ✗ %s\n' "$msg"; fi
}

# Canonical public URL for success banner (env from .env.local / merged .env).
deploy_ui_resolve_public_url() {
  local u d
  u="${PRODUCTION_PUBLIC_SITE_URL:-}"
  [[ -z "$u" ]] && u="${NEXT_PUBLIC_SITE_URL:-}"
  u="${u#"${u%%[![:space:]]*}"}"
  u="${u%"${u##*[![:space:]]}"}"
  if [[ -n "$u" ]]; then
    if [[ ! "$u" =~ ^https?:// ]]; then u="https://${u#//}"; fi
    printf '%s\n' "$u"
    return 0
  fi
  d="${DEPLOY_SITE_DOMAIN:-}"
  d="${d#https://}"
  d="${d#http://}"
  d="${d%%/*}"
  if [[ -n "$d" ]]; then
    printf 'https://%s\n' "$d"
    return 0
  fi
  printf '%s\n' ""
}

# Call before first deploy_ui_step to enable [n/total] and the bar.
deploy_ui_set_total() {
  DEPLOY_UI_TOTAL="$1"
  DEPLOY_UI_STEP=0
}

deploy_ui_banner() {
  local title="$1"
  echo ""
  if deploy_ui_tty_color; then
    printf '\033[35m%s\033[0m\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf '\033[1;35m  %s\033[0m\n' "$title"
    printf '\033[35m%s\033[0m\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  else
    printf '%s\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    printf '%s\n' "  ${title}"
    printf '%s\n' "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  fi
  echo ""
}

deploy_ui_bar() {
  deploy_ui_pretty || return 0
  local cur="${1:-$DEPLOY_UI_STEP}" tot="${2:-$DEPLOY_UI_TOTAL}"
  [[ "$tot" -lt 1 ]] && return 0
  local w=24
  local filled=$((cur * w / tot))
  local i
  printf '  ['
  for ((i = 0; i < w; i++)); do
    if (( i < filled )); then
      if deploy_ui_tty_color; then printf '\033[32m█\033[0m'; else printf '█'; fi
    else
      if deploy_ui_tty_color; then printf '\033[2m·\033[0m'; else printf '·'; fi
    fi
  done
  if deploy_ui_tty_color; then
    printf '\033[36m] %s%%\033[0m\n' "$((cur * 100 / tot))"
  else
    printf '] %s%%\n' "$((cur * 100 / tot))"
  fi
}

deploy_ui_step() {
  local label="$1"
  DEPLOY_UI_STEP=$((DEPLOY_UI_STEP + 1))
  echo ""
  if [[ "${DEPLOY_UI_TOTAL:-0}" -gt 0 ]]; then
    if deploy_ui_tty_color; then
      printf '  \033[1;36m[%s/%s]\033[0m \033[1m%s\033[0m\n' "$DEPLOY_UI_STEP" "$DEPLOY_UI_TOTAL" "$label"
    else
      printf '  [%s/%s] %s\n' "$DEPLOY_UI_STEP" "$DEPLOY_UI_TOTAL" "$label"
    fi
    deploy_ui_bar "$DEPLOY_UI_STEP" "$DEPLOY_UI_TOTAL"
  else
    if deploy_ui_tty_color; then
      printf '  \033[1;36m→\033[0m \033[1m%s\033[0m\n' "$label"
    else
      printf '  → %s\n' "$label"
    fi
  fi
}

deploy_ui_ok() {
  local msg="${1:-done}"
  if deploy_ui_tty_color; then
    printf '     \033[32m✓\033[0m \033[32m%s\033[0m\n' "$msg"
  else
    printf '     ✓ %s\n' "$msg"
  fi
}

deploy_ui_warn() {
  if deploy_ui_tty_color; then printf '\033[33m     ! %s\033[0m\n' "$1" >&2
  else printf '%s\n' "     ! ${1}" >&2; fi
}

# Caddy: on success print one line; on failure show validate output (no silent failures).
deploy_ui_caddy_validate_quiet() {
  local cfg="${1:-/etc/caddy/Caddyfile}"
  if caddy validate --config "$cfg" >/dev/null 2>&1; then
    deploy_ui_ok "Caddyfile valid"
    return 0
  fi
  echo "" >&2
  echo "[deploy] caddy validate failed:" >&2
  caddy validate --config "$cfg" >&2
  return 1
}

# Args: [message] [optional explicit URL  -  otherwise from PRODUCTION_PUBLIC_SITE_URL / DEPLOY_SITE_DOMAIN]
deploy_ui_success_final() {
  local msg="${1:-Deploy finished successfully.}"
  local url="${2:-}"
  [[ -z "$url" ]] && url="$(deploy_ui_resolve_public_url)"
  echo ""
  deploy_ui_green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  deploy_ui_green "  ${msg}"
  if [[ -n "$url" ]]; then
    deploy_ui_green "  Live at: ${url}"
    deploy_ui_dim "  (URL is from env  -  not tested. HTTPS needs DNS → this host, :80/:443 open, and Caddy certs OK.)"
  else
    deploy_ui_dim "  Tip: set PRODUCTION_PUBLIC_SITE_URL or DEPLOY_SITE_DOMAIN to show the link here."
  fi
  deploy_ui_green "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
}
