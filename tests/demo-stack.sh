#!/bin/bash
# Live local demo: render the real compose from a demo config, layer the stub
# override, bring the whole stack up, and prove the orchestration works —
# healthcheck-gated ordering, internal network, and proxy routing.
#
#   tests/demo-stack.sh          # bring up, probe, tear down
#   tests/demo-stack.sh --keep   # leave it running for inspection
#
# Needs: Node 20, a running Docker daemon, internet (pulls mariadb/redis/caddy/
# whoami/busybox). No Drumee source or private images required.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
KEEP=0; [ "${1:-}" = "--keep" ] && KEEP=1
WORK="$root/tests/.demo-run"
say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
ok()   { printf '  \033[1;32mOK\033[0m   %s\n' "$*"; }
bad()  { printf '  \033[1;31mFAIL\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31merror:\033[0m %s\n' "$*" >&2; exit 1; }

command -v node >/dev/null || die "node is required"
docker compose version >/dev/null 2>&1 || die "docker compose v2 is required"
docker info >/dev/null 2>&1 || die "Docker daemon not reachable. In WSL: 'sudo service docker start' or enable Docker Desktop WSL integration."

dc() { docker compose -f "$WORK/docker-compose.yml" -f "$WORK/docker-compose.override.yml" --env-file "$WORK/.env" "$@"; }

teardown() {
  if [ "$KEEP" = 1 ]; then
    say "Leaving stack up (--keep). Inspect:  docker compose -f $WORK/docker-compose.yml -f $WORK/docker-compose.override.yml ps"
    say "Tear down:  docker compose -f $WORK/docker-compose.yml -f $WORK/docker-compose.override.yml --env-file $WORK/.env down -v && rm -rf $WORK"
    return
  fi
  say "Tearing down"
  dc down -v >/dev/null 2>&1 || true
  # MariaDB writes root-owned files into the bind-mounted db dir; remove them
  # from inside a container so the host user can clean up.
  docker run --rm -v "$WORK":/w busybox:stable sh -c 'rm -rf /w/* /w/.??*' >/dev/null 2>&1 || true
  rm -rf "$WORK"
}
trap teardown EXIT

# --- fresh work dir + demo config (localhost, HTTP, dirs under the work dir) ---
rm -rf "$WORK"; mkdir -p "$WORK/data" "$WORK/db"
cat > "$WORK/drumee.yaml" <<EOF
instance:
  description: Demo
  domain: localhost
  local_mode: true
  admin_email: admin@example.com
tls:
  mode: self-signed
storage:
  data_dir: $WORK/data
  db_dir: $WORK/db
database:
  host: mariadb
redis:
  host: redis
EOF

say "Rendering the real compose from the demo config"
node "$root/config/render.mjs" all --config "$WORK/drumee.yaml" --out-dir "$WORK" || die "render failed"
cp "$root/tests/demo/docker-compose.override.yml" "$WORK/"
cp "$root/tests/demo/Caddyfile" "$WORK/Caddyfile"
ok "rendered .env + docker-compose.yml (+ stub override)"

say "Validating merged compose (real + override)"
dc config -q && ok "compose valid" || die "merged compose invalid"

say "Bringing the stack up (first run pulls images — may take a minute)"
dc up -d || die "compose up failed"

say "Waiting for ordering gates (mariadb healthy → schemas-init done → app up)"
deadline=$(( $(date +%s) + 180 )); ready=0
while [ "$(date +%s)" -lt "$deadline" ]; do
  health="$(dc ps --format '{{.Service}}:{{.Health}}:{{.State}}' 2>/dev/null)"
  echo "$health" | grep -q 'mariadb:healthy' || { sleep 4; continue; }
  # proxy + backend running (ui-build is run-once and has already exited)
  states="$(dc ps --format '{{.Service}}:{{.State}}')"
  if echo "$states" | grep -q 'proxy:running' && echo "$states" | grep -q 'server-pod:running'; then
    ready=1; break
  fi
  sleep 4
done
[ "$ready" = 1 ] && ok "services up and ordered" || { bad "services did not reach ready state"; dc ps; dc logs --tail=30; exit 1; }

say "Verifying schemas-init completed successfully (the ordering gate)"
ec="$(docker inspect -f '{{.State.ExitCode}}' "$(dc ps -aq schemas-init)" 2>/dev/null || echo '?')"
[ "$ec" = "0" ] && ok "schemas-init exited 0 (gate satisfied)" || bad "schemas-init exit code: $ec"

say "Probing the proxy routes"
fail=0
if curl -fsS -m 10 http://localhost/ >/dev/null 2>&1; then ok "GET /        -> ui-pod (200)"; else bad "GET / failed"; fail=1; fi
if curl -fsS -m 10 http://localhost/-/svc/ping >/dev/null 2>&1; then ok "GET /-/svc/* -> server-pod (200)"; else bad "GET /-/svc/* failed"; fail=1; fi

echo
if [ "$fail" = 0 ]; then
  printf '\033[1;32m== DEMO PASS ==\033[0m  Real generated compose orchestrated correctly end-to-end.\n'
else
  printf '\033[1;31m== DEMO FAIL ==\033[0m\n'; dc logs --tail=40; exit 1
fi
