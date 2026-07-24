#!/bin/bash
# Build the schemas seed (var/tmp/drumee/seeds.tgz) offline, from local source.
#
# Rework of schemas/make-seed.sh point #3: spin up a throwaway MariaDB in a
# container, populate the base databases from the schemas repo's
# templates/factory + STOCK the entity pool via server-team's offline/factory,
# then mariabackup the datadir into a seeds.tgz laid out exactly as
# setup-schemas/bin/install expects. See deploy/docker/seed-entrypoint.sh.
#
#   scripts/build-seed.sh [--out=PATH]
#
# Sources are bind-mounted read-only (their existing node_modules are reused —
# no private @drumee registry access or in-container npm install needed):
#   SERVER_SRC         server-team checkout   (default ~/server-team)
#   SETUP_SCHEMAS_SRC  setup-schemas checkout (default schemas/src/setup-schemas)
#   SCHEMAS_SRC        schemas checkout       (default schemas/src/schemas)
# Other env: TAG (image tag, default local), POOL_COUNT (pool entities, default 10),
#   DRUMEE_DOMAIN_NAME (default localhost).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

OUT="$root/schemas/var/tmp/drumee/seeds.tgz"
for arg in "$@"; do
  case $arg in
    --out=*) OUT="${arg#*=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

TAG="${TAG:-local}"
POOL_COUNT="${POOL_COUNT:-10}"
DRUMEE_DOMAIN_NAME="${DRUMEE_DOMAIN_NAME:-localhost}"

SERVER_SRC="${SERVER_SRC:-$(cd "$root/.." && pwd)/server-team}"
# Prefer the trees schemas/build.sh already cloned via bundle(); fall back to env.
SETUP_SCHEMAS_SRC="${SETUP_SCHEMAS_SRC:-$root/schemas/src/setup-schemas}"
SCHEMAS_SRC="${SCHEMAS_SRC:-$root/schemas/src/schemas}"

docker buildx version >/dev/null 2>&1 || { echo "docker buildx required" >&2; exit 1; }
[ -d "$SERVER_SRC/offline/factory" ] || {
  echo "server-team source not found at: $SERVER_SRC (set SERVER_SRC=)" >&2; exit 1; }
[ -d "$SERVER_SRC/node_modules/@drumee" ] || {
  echo "server-team has no node_modules — run 'npm i' in $SERVER_SRC first" >&2; exit 1; }
[ -d "$SETUP_SCHEMAS_SRC/lib" ] || {
  echo "setup-schemas source not found at: $SETUP_SCHEMAS_SRC (set SETUP_SCHEMAS_SRC=)" >&2; exit 1; }
[ -f "$SCHEMAS_SRC/templates/factory/seed/yp.sql" ] || {
  echo "schemas factory templates not found at: $SCHEMAS_SRC (set SCHEMAS_SRC=)" >&2; exit 1; }

say "Building drumee/seed:$TAG"
docker buildx build \
  -f "$root/deploy/docker/Dockerfile.seed" \
  -t "drumee/seed:$TAG" --load "$root/deploy/docker"

out_dir="$(dirname "$OUT")"
out_file="$(basename "$OUT")"
mkdir -p "$out_dir"

say "Building seed -> $OUT  (pool=$POOL_COUNT, domain=$DRUMEE_DOMAIN_NAME)"
docker run --rm \
  --ulimit "nofile=1048576:1048576" \
  -e "POOL_COUNT=$POOL_COUNT" \
  -e "DRUMEE_DOMAIN_NAME=$DRUMEE_DOMAIN_NAME" \
  -e "OUT_FILE=$out_file" \
  -v "$SERVER_SRC:/src/server-main:ro" \
  -v "$SETUP_SCHEMAS_SRC:/src/setup-schemas:ro" \
  -v "$SCHEMAS_SRC:/src/schemas:ro" \
  -v "$out_dir:/out" \
  "drumee/seed:$TAG"

say "Seed ready: $OUT"
