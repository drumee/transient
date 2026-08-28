#!/bin/bash
# Full-stack E2E test against the real locally-built images (tag: local).
# Brings up an isolated compose project (NO proxy service -> no port conflicts
# with a running dev stack), then asserts the complete chain:
#
#   mariadb -> schemas-init -> ui-build -> schemas-populate(admin) -> server-pod
#
#   1. run-once jobs exit 0          4. server-pod healthcheck -> healthy
#   2. accounts exist (admin login)  5. factory refills the entity pool
#   3. app serves real HTML on :23000
#
# Needs: Docker daemon + images from scripts/build-images-local.sh. ~3-5 min.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
W="$(mktemp -d)"; P=drumee-e2e
pass=0; fail=0
ok()  { printf '  \033[1;32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
no()  { printf '  \033[1;31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }
say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
DC="docker compose -f $W/docker-compose.yml --env-file $W/.env -p $P"
cleanup() {
  $DC down -v >/dev/null 2>&1 || true
  docker run --rm -v "$W":/w busybox:stable sh -c 'rm -rf /w/* /w/.??*' >/dev/null 2>&1 || true
  rm -rf "$W"
}
trap cleanup EXIT

mkdir -p "$W/db" "$W/data"
cat > "$W/drumee.yaml" <<YAML
instance:
  description: E2E
  domain: localhost
  local_mode: true
  admin_email: admin@example.com
tls:
  mode: self-signed
storage:
  data_dir: $W/data
  db_dir: $W/db
database:
  host: mariadb
redis:
  host: redis
versions:
  server: local
  ui: local
  schemas: local
  static: local
YAML
node "$root/config/render.mjs" all --config "$W/drumee.yaml" --out-dir "$W" >/dev/null 2>&1
cat >> "$W/.env" <<EOF
CREATE_ADMIN=1
ADMIN_PASSWORD=E2eTest2026!
POOL_COUNT=10
POOL_WATERMARK=10
POOL_INTERVAL=5
EOF

say "up (all services except proxy)"
$DC up -d mariadb redis schemas-init ui-build schemas-populate server-pod factory >/dev/null 2>&1

say "waiting for run-once jobs"
deadline=$(( $(date +%s) + 420 ))
while [ "$(date +%s)" -lt "$deadline" ]; do
  $DC ps -a --format '{{.Service}}:{{.State}}:{{.ExitCode}}' 2>/dev/null | grep -q 'schemas-populate:exited:0' && break
  sleep 5
done
states="$($DC ps -a --format '{{.Service}}:{{.State}}:{{.ExitCode}}' 2>/dev/null)"
for svc in schemas-init ui-build schemas-populate; do
  echo "$states" | grep -q "^$svc:exited:0" && ok "$svc completed (exit 0)" || no "$svc completed (got: $(echo "$states" | grep "^$svc:" || echo missing))"
done

say "healthcheck"
hc=unknown
for _ in $(seq 1 30); do
  hc=$(docker inspect -f '{{.State.Health.Status}}' "$P-server-pod-1" 2>/dev/null || echo unknown)
  [ "$hc" = healthy ] && break; sleep 5
done
[ "$hc" = healthy ] && ok "server-pod healthy" || no "server-pod healthy (got: $hc)"

say "app serves"
html="$($DC exec -T server-pod curl -s -m 8 http://localhost:23000/ 2>/dev/null | head -c 200)"
echo "$html" | grep -q '<!DOCTYPE html>' && ok "index.js serves HTML on :23000" || no "index.js serves HTML"
code="$($DC exec -T server-pod curl -s -o /dev/null -w '%{http_code}' -m 8 http://localhost:24000/-/svc/system.ping 2>/dev/null)"
[ "$code" = 401 ] && ok "service.js REST answers (401 unauthenticated)" || no "service.js REST answers (got: $code)"

say "admin login (session_login_next)"
row="$($DC exec -T mariadb sh -lc 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" yp -N -e "CALL session_login_next(\"admin@example.com\",\"E2eTest2026!\",\"e2e\",\"localhost\")" 2>/dev/null | head -1')"
echo "$row" | grep -q 'admin' && ok "admin login returns a session" || no "admin login (got: ${row:-empty})"

say "factory refills pool to watermark"
refilled=0
for _ in $(seq 1 40); do
  counts="$($DC exec -T mariadb sh -lc 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N -e "SELECT GROUP_CONCAT(CONCAT(type,\"=\",c)) FROM (SELECT type, COUNT(*) c FROM yp.entity WHERE area=\"pool\" GROUP BY type) t" 2>/dev/null' | tr -d '\r')"
  echo "$counts" | grep -q 'drumate=10' && echo "$counts" | grep -q 'hub=10' && { refilled=1; break; }
  sleep 10
done
[ "$refilled" = 1 ] && ok "pool at watermark (hub=10, drumate=10)" || no "pool refill (last: ${counts:-?})"

echo
printf '\033[1me2e: %d passed, %d failed\033[0m\n' "$pass" "$fail"
[ "$fail" = 0 ]
