#!/bin/bash
# Tear down the local dev stack started by scripts/dev-up.sh.
#   scripts/dev-down.sh           # stop + remove containers + volumes
#   KEEP_DATA=1 scripts/dev-down.sh   # keep the DB/data dirs
set -uo pipefail
W="${DRUMEE_DEV_DIR:-$HOME/.drumee-dev}"
PROJECT=drumee-dev
[ -f "$W/docker-compose.yml" ] && \
  docker compose -f "$W/docker-compose.yml" --env-file "$W/.env" -p "$PROJECT" down -v || \
  docker compose -p "$PROJECT" down -v 2>/dev/null || true
if [ "${KEEP_DATA:-0}" != "1" ]; then
  docker run --rm -v "$W":/w busybox:stable sh -c 'rm -rf /w/* /w/.??*' >/dev/null 2>&1 || true
  rm -rf "$W"
fi
echo "dev stack down."
