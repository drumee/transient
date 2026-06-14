#!/bin/bash
# Drumee container-channel bootstrap — the "easy path".
#
#   curl -fsSL https://get.drumee.io | bash
#   # or, from a checkout:  scripts/get-drumee.sh
#
# Prepares ./drumee/ with .env + docker-compose.yml + Caddyfile rendered from a
# config, then `docker compose up -d`. Idempotent: re-running re-renders and
# re-applies. Set DRUMEE_DIR to change the target directory.
set -euo pipefail

DRUMEE_DIR="${DRUMEE_DIR:-./drumee}"
# Where to fetch artifacts when not running from a repo checkout:
RELEASE_BASE="${RELEASE_BASE:-https://get.drumee.io}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
die() { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

# --- preflight ---
command -v docker >/dev/null 2>&1 || die "Docker is required. Install: https://docs.docker.com/engine/install/"
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (docker compose)."
docker info >/dev/null 2>&1 || die "Cannot talk to the Docker daemon (is it running / do you have permission?)."

# Locate sources: prefer a local checkout, else download from RELEASE_BASE.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd || echo)"

fetch() { # fetch <relative-path> <dest>
  local rel="$1" dest="$2"
  if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/$rel" ]; then
    cp "$REPO_ROOT/$rel" "$dest"
  else
    curl -fsSL "$RELEASE_BASE/$rel" -o "$dest"
  fi
}

mkdir -p "$DRUMEE_DIR"
cd "$DRUMEE_DIR"

# --- config ---
if [ ! -f drumee.yaml ]; then
  say "First run — creating drumee.yaml from the example."
  fetch config/drumee.example.yaml drumee.yaml
  cat <<MSG

  Edit $(pwd)/drumee.yaml (at minimum: instance.domain and admin_email),
  then re-run this script to render and start Drumee.

MSG
  exit 0
fi

# --- render artifacts (.env, docker-compose.yml, Caddyfile, install.conf) ---
# The Caddyfile is rendered from drumee.yaml (TLS follows tls.mode + domain:
# automatic HTTPS for a real domain, plain HTTP for localhost).
say "Rendering deployment artifacts from drumee.yaml"
if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/config/render.mjs" ]; then
  node "$REPO_ROOT/config/render.mjs" all --config drumee.yaml --out-dir .
else
  fetch config/render.mjs render.mjs
  node render.mjs all --config drumee.yaml --out-dir .
fi

# --- launch ---
say "Starting Drumee (docker compose up -d)"
docker compose --env-file .env up -d

say "Done. Drumee is starting. Check status with:  (cd $DRUMEE_DIR && docker compose ps)"
