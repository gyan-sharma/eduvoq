#!/usr/bin/env bash
# Run once on the Ubuntu server (as root or the user that owns $DEPLOY_PATH).
# Standard GitHub SSH setup: create a key, wire ssh(1) to use it for github.com, set git origin to SSH.
# Add the printed *public* key in GitHub: Repo → Settings → Deploy keys (read-only)  -  same key type as any GitHub SSH key.
#
# Usage: cd /path/to/repo && bash deploy/github-ssh-setup.sh
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"
# shellcheck disable=SC1091
source "$REPO_ROOT/deploy/lib.sh"
prereq_server_github_setup || exit 1

KEY="${GITHUB_DEPLOY_KEY_PATH:-$HOME/.ssh/github_deploy_ed25519}"

mkdir -p "$HOME/.ssh"
chmod 700 "$HOME/.ssh"

if [[ ! -f "$KEY" ]]; then
  echo "[github-ssh] generating $KEY"
  ssh-keygen -t ed25519 -C "github-ssh-$(hostname)" -f "$KEY" -N ""
else
  echo "[github-ssh] using existing key $KEY"
fi

chmod 600 "$KEY" 2>/dev/null || true
chmod 644 "${KEY}.pub" 2>/dev/null || true

# github.com host key (non-interactive git fetch)
if ! grep -q '^github\.com' "$HOME/.ssh/known_hosts" 2>/dev/null; then
  ssh-keyscan -t ed25519,rsa,ecdsa github.com >>"$HOME/.ssh/known_hosts" 2>/dev/null || true
fi

# Force this key for GitHub (avoids ssh trying other keys first)
CONFIG_BLOCK="# GitHub SSH (added by deploy/github-ssh-setup.sh)
Host github.com
  HostName github.com
  User git
  IdentityFile $KEY
  IdentitiesOnly yes
"
if [[ -f "$HOME/.ssh/config" ]] && grep -qF "$KEY" "$HOME/.ssh/config" 2>/dev/null; then
  echo "[github-ssh] ~/.ssh/config already references $KEY"
else
  echo "$CONFIG_BLOCK" >>"$HOME/.ssh/config"
  chmod 600 "$HOME/.ssh/config"
  echo "[github-ssh] appended ~/.ssh/config entry for github.com"
fi

O=$(git remote get-url origin 2>/dev/null || true)
owner=""
repo=""
if [[ "$O" =~ github\.com[:/](.+)$ ]]; then
  path="${BASH_REMATCH[1]}"
  path=${path%.git}
  owner=${path%%/*}
  repo=${path#*/}
fi
if [[ -z "$owner" || -z "$repo" ]]; then
  echo "[github-ssh] ERROR: could not parse owner/repo from git remote (set origin to github.com/owner/repo)" >&2
  exit 1
fi
git remote set-url origin "git@github.com:${owner}/${repo}.git"
echo "[github-ssh] git origin -> git@github.com:${owner}/${repo}.git"

echo ""
echo "========== Add this public key in GitHub (Deploy keys → Add key, read-only); title e.g. github-ssh-$(hostname) =========="
echo "  https://github.com/${owner}/${repo}/settings/keys"
echo ""
cat "${KEY}.pub"
echo ""
echo "====================================================================="
echo ""
echo "After saving the key, test (same as a normal GitHub SSH setup):"
echo "  ssh -T git@github.com"
echo "Then:"
echo "  cd $(pwd) && git pull && SKIP_PULL=1 bash deploy/update.sh"
echo ""
echo "Set GITHUB_DEPLOY_KEY_PATH=$KEY in .env.prod if this app runs as another user (see deploy/lib.sh)."
echo ""

# GitHub returns exit 1 even on successful auth for `ssh -T`
set +e
ssh_out=$(ssh -o BatchMode=yes -o ConnectTimeout=15 -T git@github.com 2>&1)
ssh_ec=$?
set -e
if echo "$ssh_out" | grep -qE 'successfully authenticated|^Hi '; then
  echo "[github-ssh] SSH OK  -  run: git pull && SKIP_PULL=1 bash deploy/update.sh"
else
  echo "[github-ssh] After adding the key in GitHub, run: ssh -T git@github.com && git pull"
  if [[ "$ssh_ec" != 0 ]]; then
    echo "[github-ssh] (current test exit $ssh_ec) $ssh_out"
  fi
fi
