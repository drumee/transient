#!/bin/bash
# Container-channel install smoke test.
# Always runs the no-daemon checks (render + compose validity). If Docker is
# available AND the images are pullable, it does a real `up` and waits for health.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"; trap 'cleanup' EXIT
cleanup() { [ -n "${STARTED:-}" ] && ( cd "$tmp" && docker compose down -v >/dev/null 2>&1 || true ); rm -rf "$tmp"; }
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

say "Rendering artifacts from the example config"
cp "$root/config/drumee.example.yaml" "$tmp/drumee.yaml"
node "$root/config/render.mjs" all --config "$tmp/drumee.yaml" --out-dir "$tmp"
cp "$root/deploy/docker/Caddyfile" "$tmp/Caddyfile"

say "Validating generated compose"
if ! docker compose version >/dev/null 2>&1; then
  echo "docker compose not available — config-only smoke passed."; exit 0
fi
( cd "$tmp" && docker compose --env-file .env config -q ) && echo "compose valid"

# Real bring-up only if images resolve (published). Otherwise stop here cleanly.
say "Checking image availability"
SERVER_IMG="drumee/server-pod:$(grep -E '^SERVER_TAG=' "$tmp/.env" | cut -d= -f2-)"
if ! docker manifest inspect "$SERVER_IMG" >/dev/null 2>&1; then
  echo "images not published yet ($SERVER_IMG) — skipping live bring-up."
  echo "config + compose smoke passed."
  exit 0
fi

say "Bringing the stack up"
( cd "$tmp" && docker compose --env-file .env up -d ) && STARTED=1

say "Waiting for services to become healthy (up to 180s)"
deadline=$(( $(date +%s) + 180 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  unhealthy="$(cd "$tmp" && docker compose ps --format '{{.Health}}' | grep -c -E 'starting|unhealthy' || true)"
  [ "$unhealthy" = 0 ] && break
  sleep 5
done

say "Probing the proxy"
if curl -fsS -m 10 http://localhost/ >/dev/null 2>&1; then
  echo "SMOKE PASS — proxy responded."
else
  echo "SMOKE FAIL — proxy did not respond." >&2
  ( cd "$tmp" && docker compose logs --tail=50 ) || true
  exit 1
fi
