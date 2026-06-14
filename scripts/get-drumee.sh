#!/bin/bash
# Drumee one-command installer — the "easy path".
#
#   curl -fsSL https://get.drumee.io | bash      # interactive: asks 3-4 questions, then installs
#   scripts/get-drumee.sh                         # same, from a checkout
#
# One run does everything: checks (and can install) Docker, asks how people will
# reach the server, writes the config, generates secrets, renders the stack,
# starts it, waits until it is healthy, and prints the URL + admin login.
#
# Nothing to hand-edit. Re-running is safe (re-renders + re-applies).
#
# Non-interactive / automation (skip the questions by presetting these):
#   DRUMEE_DOMAIN=         # domain name, or blank for IP/local
#   ACCESS_MODE=           # domain | ip | local   (how to reach it)
#   ADMIN_EMAIL=           # administrator login + notifications
#   ADMIN_PASSWORD=        # blank = auto-generate and print
#   INSTANCE_NAME=         # human label for the instance
#   DRUMEE_DIR=./drumee    # where to install
#   ASSUME_YES=1           # answer "yes" to install-Docker / firewall prompts
set -uo pipefail

# ----------------------------------------------------------------------------- ui
c_blue='\033[1;36m'; c_grn='\033[1;32m'; c_yel='\033[1;33m'; c_red='\033[1;31m'; c_dim='\033[2m'; c_off='\033[0m'
say()  { printf "${c_blue}==>${c_off} %s\n" "$*"; }
ok()   { printf "  ${c_grn}OK${c_off}   %s\n" "$*"; }
warn() { printf "  ${c_yel}!${c_off}    %s\n" "$*"; }
die()  { printf "${c_red}error:${c_off} %s\n" "$*" >&2; exit 1; }
hr()   { printf "${c_dim}%s${c_off}\n" "------------------------------------------------------------"; }

# Prompts must read from the terminal even under `curl … | bash` (where stdin is
# the script). /dev/tty is the real keyboard; fall back to defaults if absent.
TTY=/dev/tty
have_tty() { { true <"$TTY"; } 2>/dev/null; }
ask() { # ask <var> <prompt> <default>   — env override wins; blank answer -> default
  local __v="$1" __p="$2" __d="$3" __a="" __e="${!1:-}"
  if [ -n "$__e" ]; then printf -v "$__v" '%s' "$__e"; return; fi
  if have_tty; then
    printf "  %s ${c_dim}[%s]${c_off} " "$__p" "${__d:-}" >"$TTY"
    IFS= read -r __a <"$TTY" || true
  fi
  [ -z "$__a" ] && __a="$__d"
  printf -v "$__v" '%s' "$__a"
}
ask_secret() { # ask_secret <var> <prompt>   — hidden input; env override wins
  local __v="$1" __p="$2" __a="" __e="${!1:-}"
  if [ -n "$__e" ]; then printf -v "$__v" '%s' "$__e"; return; fi
  if have_tty; then
    printf "  %s ${c_dim}(blank = auto-generate)${c_off} " "$__p" >"$TTY"
    IFS= read -rs __a <"$TTY" || true; printf "\n" >"$TTY"
  fi
  printf -v "$__v" '%s' "$__a"
}
confirm() { # confirm <prompt>   — default yes; ASSUME_YES / no TTY -> yes
  [ "${ASSUME_YES:-0}" = "1" ] && return 0
  have_tty || return 0
  local __a=""; printf "  %s ${c_dim}[Y/n]${c_off} " "$1" >"$TTY"; IFS= read -r __a <"$TTY" || true
  case "${__a,,}" in n|no) return 1;; *) return 0;; esac
}

# --------------------------------------------------------------------- locate src
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]:-$0}")" 2>/dev/null && pwd || echo)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." 2>/dev/null && pwd || echo)"
RELEASE_BASE="${RELEASE_BASE:-https://get.drumee.io}"
[ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/config/render.mjs" ] || REPO_ROOT=""
fetch() { # fetch <relative-path> <dest>
  local rel="$1" dest="$2"
  if [ -n "$REPO_ROOT" ] && [ -f "$REPO_ROOT/$rel" ]; then cp "$REPO_ROOT/$rel" "$dest"
  else curl -fsSL "$RELEASE_BASE/$rel" -o "$dest"; fi
}

printf "\n${c_blue}  Drumee installer${c_off}\n"; hr

# ------------------------------------------------------------- 1. ensure Docker
ensure_docker() {
  if ! command -v docker >/dev/null 2>&1; then
    warn "Docker is not installed."
    if confirm "Install Docker now? (uses the official get.docker.com script, needs sudo)"; then
      say "Installing Docker"
      curl -fsSL https://get.docker.com | sudo sh || die "Docker install failed — install manually: https://docs.docker.com/engine/install/"
      sudo systemctl enable --now docker 2>/dev/null || sudo service docker start 2>/dev/null || true
    else
      die "Docker is required. Install: https://docs.docker.com/engine/install/"
    fi
  fi
  docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required (the 'docker compose' command)."
  # Pick the right docker invocation (with or without sudo).
  if docker info >/dev/null 2>&1; then DOCKER="docker"
  elif sudo -n true 2>/dev/null && sudo docker info >/dev/null 2>&1; then DOCKER="sudo docker"; warn "Using sudo for Docker (add yourself to the 'docker' group to avoid this)."
  elif sudo docker info >/dev/null 2>&1; then DOCKER="sudo docker"; warn "Using sudo for Docker."
  else die "Cannot talk to the Docker daemon (is it running? do you have permission?)."; fi
  ok "Docker ready"
}
ensure_docker

# ---------------------------------------------------------- 2. choose where + how
DRUMEE_DIR="${DRUMEE_DIR:-./drumee}"
mkdir -p "$DRUMEE_DIR"; cd "$DRUMEE_DIR"; DRUMEE_DIR="$(pwd)"

if [ -f drumee.yaml ] && ! confirm "Found an existing config here ($DRUMEE_DIR/drumee.yaml). Reconfigure?"; then
  say "Keeping existing config — re-rendering and (re)starting"
else
  say "Let's set up your Drumee. Press Enter to accept the [default]."
  echo

  ask INSTANCE_NAME "Name for this instance" "My Drumee"

  # Detect a public IPv4 so we can offer the no-domain HTTPS path (unless preset).
  PUBIP="${PUBIP:-}"
  if [ -z "$PUBIP" ]; then
    PUBIP="$(curl -fsS --max-time 4 https://api.ipify.org 2>/dev/null || true)"
    [ -z "$PUBIP" ] && PUBIP="$(curl -fsS --max-time 4 https://icanhazip.com 2>/dev/null | tr -d '[:space:]' || true)"
  fi
  is_public_ip() { [[ "$1" =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ ]] && [[ ! "$1" =~ ^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|127\.) ]]; }
  default_mode="local"; is_public_ip "${PUBIP:-}" && default_mode="ip"

  if [ -z "${ACCESS_MODE:-}" ]; then
    echo "  How will people reach this server?"
    echo "    1) I have a domain name              (real HTTPS — best for production)"
    echo "    2) Use this server's IP, no domain   (auto HTTPS via sslip.io)${PUBIP:+   detected: $PUBIP}"
    echo "    3) Local / testing only              (http://localhost, no HTTPS)"
    case "$default_mode" in ip) def="2";; *) def="3";; esac
    ask MENU "Choose 1-3" "$def"
    case "$MENU" in 1) ACCESS_MODE=domain;; 2) ACCESS_MODE=ip;; *) ACCESS_MODE=local;; esac
  fi

  case "$ACCESS_MODE" in
    domain)
      ask DRUMEE_DOMAIN "Your domain (DNS A-record must point here)" "example.com"
      TLS_MODE=acme; LOCAL_MODE=false ;;
    ip)
      is_public_ip "${PUBIP:-}" || ask PUBIP "This server's public IP" ""
      [ -n "${PUBIP:-}" ] || die "Need a public IP for the no-domain path; re-run and pick a domain or local."
      DRUMEE_DOMAIN="${PUBIP//./-}.sslip.io"; TLS_MODE=acme; LOCAL_MODE=false
      warn "Using $DRUMEE_DOMAIN — ports 80 and 443 must be open to the internet for HTTPS." ;;
    *)
      DRUMEE_DOMAIN="localhost"; TLS_MODE=self-signed; LOCAL_MODE=true ;;
  esac

  ask ADMIN_EMAIL "Administrator email (your login)" "admin@${DRUMEE_DOMAIN}"
  ask_secret ADMIN_PASSWORD "Administrator password"

  # ---- pick images: local build if present, else the published registry ----
  REGISTRY="${IMAGE_REGISTRY:-drumee}"; TAG="${SERVER_TAG:-}"
  if [ -z "$TAG" ] && $DOCKER image inspect drumee/server-pod:local >/dev/null 2>&1; then
    REGISTRY="drumee"; TAG="local"; ok "Using locally-built images (tag: local)"
  fi

  # ---- write drumee.yaml (only what the user chose; rest defaults/auto-gen) ----
  acme_line=""; [ "$TLS_MODE" = "acme" ] && acme_line="  acme_email: ${ADMIN_EMAIL}"
  ver_block="versions:"$'\n'"  server: ${TAG:-latest}"
  if [ "$TAG" = "local" ]; then
    ver_block="versions:"$'\n'"  server: local"$'\n'"  ui: local"$'\n'"  schemas: local"$'\n'"  static: local"
  fi
  {
    echo "instance:"
    echo "  description: ${INSTANCE_NAME}"
    echo "  domain: ${DRUMEE_DOMAIN}"
    echo "  local_mode: ${LOCAL_MODE}"
    echo "  admin_email: ${ADMIN_EMAIL}"
    echo "tls:"
    echo "  mode: ${TLS_MODE}"
    [ -n "$acme_line" ] && echo "$acme_line"
    echo "storage:"
    echo "  data_dir: ${DRUMEE_DIR}/data"
    echo "  db_dir: ${DRUMEE_DIR}/db"
    echo "database:"
    echo "  host: mariadb"
    echo "redis:"
    echo "  host: redis"
    echo "images:"
    echo "  registry: ${REGISTRY}"
    echo "$ver_block"
  } > drumee.yaml
  ok "Wrote $DRUMEE_DIR/drumee.yaml"
fi

# --------------------------------------------------------------- 3. render + run
say "Rendering deployment files from drumee.yaml"
if [ -n "$REPO_ROOT" ]; then node "$REPO_ROOT/config/render.mjs" all --config drumee.yaml --out-dir .
else fetch config/render.mjs render.mjs && node render.mjs all --config drumee.yaml --out-dir .; fi
[ -f docker-compose.yml ] && [ -f .env ] || die "Render did not produce docker-compose.yml/.env"

# Provision the admin on first boot (idempotent in the populate step).
grep -q '^CREATE_ADMIN=' .env || echo "CREATE_ADMIN=1" >> .env
if [ -n "${ADMIN_PASSWORD:-}" ] && ! grep -q '^ADMIN_PASSWORD=' .env; then
  echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> .env
fi

# Make the data/db dirs the compose volumes expect.
dd="$(grep -E '^DRUMEE_DATA_DIR=' .env | cut -d= -f2-)"; bb="$(grep -E '^DRUMEE_DB_DIR=' .env | cut -d= -f2-)"
mkdir -p "${dd:-$DRUMEE_DIR/data}" "${bb:-$DRUMEE_DIR/db}" 2>/dev/null || sudo mkdir -p "$dd" "$bb"

# Render-only mode (CI / inspection): produce the files but don't start anything.
if [ "${DRUMEE_NO_START:-0}" = "1" ]; then
  say "Rendered into $DRUMEE_DIR (DRUMEE_NO_START=1 — not starting)."
  ok "Files: drumee.yaml .env docker-compose.yml Caddyfile"; exit 0
fi

say "Starting Drumee — first run initializes the database (this can take a couple of minutes)"
$DOCKER compose --env-file .env up -d || die "docker compose up failed (see: $DOCKER compose logs)"

# ------------------------------------------------------------------- 4. wait + show
say "Waiting for first-run setup (schema + UI build + accounts)…"
DC="$DOCKER compose --env-file .env"
populate_done=""; for _ in $(seq 1 120); do
  st="$($DC ps -a --format '{{.Service}}:{{.State}}:{{.ExitCode}}' 2>/dev/null | grep '^schemas-populate:' || true)"
  echo "$st" | grep -q ':exited:0' && { populate_done=1; break; }
  echo "$st" | grep -qE ':exited:[1-9]' && { warn "schemas-populate failed — logs: $DC logs schemas-populate"; break; }
  sleep 5
done
[ -n "$populate_done" ] && ok "Database initialized + admin provisioned"

# Wait for the app to answer (server-pod healthy).
for _ in $(seq 1 30); do
  $DC ps --format '{{.Service}}:{{.Status}}' 2>/dev/null | grep -q '^server-pod:.*healthy' && break; sleep 4
done

if [ "$DRUMEE_DOMAIN" = "localhost" ]; then URL="http://localhost/"; else URL="https://${DRUMEE_DOMAIN}/"; fi
echo; hr; printf "${c_grn}  Drumee is up.${c_off}\n"; hr
printf "  Open:     %s\n" "$URL"
printf "  Login:    %s\n" "$ADMIN_EMAIL"
if [ -n "${ADMIN_PASSWORD:-}" ]; then
  printf "  Password: (the one you set)\n"
else
  cred="$($DC logs schemas-populate 2>/dev/null | grep -aiE 'password:|init link|reset' | tail -3)"
  [ -n "$cred" ] && printf "  Credentials (from setup log):\n%s\n" "$(echo "$cred" | sed 's/^/    /')" \
                  || printf "  Password: see  %s logs schemas-populate\n" "$DC"
fi
hr
printf "  Status:   (cd %s && %s compose ps)\n" "$DRUMEE_DIR" "$DOCKER"
printf "  Health:   DRUMEE_DIR=%s drumee-ctl doctor\n" "$DRUMEE_DIR"
printf "  Stop:     (cd %s && %s compose down)\n" "$DRUMEE_DIR" "$DOCKER"
echo
