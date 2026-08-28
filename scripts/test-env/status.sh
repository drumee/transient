#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
validate_project
fail=0
say "compose service state ($COMPOSE_PROJECT)"
compose ps -a

states="$(compose ps -a --format '{{.Service}}:{{.State}}:{{.ExitCode}}' 2>/dev/null || true)"
for svc in schemas-init ui-build schemas-populate; do
  if printf '%s\n' "$states" | grep -q "^$svc:exited:0"; then
    printf '  PASS  %s exited 0\n' "$svc"
  else
    printf '  FAIL  %s run-once result: %s\n' "$svc" "$(printf '%s\n' "$states" | grep "^$svc:" || printf missing)"
    fail=1
  fi
done

health="$(docker inspect -f '{{.State.Health.Status}}' "$COMPOSE_PROJECT-server-pod-1" 2>/dev/null || printf missing)"
[ "$health" = healthy ] && printf '  PASS  server-pod healthy\n' || { printf '  FAIL  server-pod health: %s\n' "$health"; fail=1; }

if curl -fsS --max-time 5 "http://127.0.0.1:$UI_HOST_PORT/" >/dev/null; then
  printf '  PASS  Team frontend responds at http://127.0.0.1:%s/\n' "$UI_HOST_PORT"
else
  printf '  FAIL  Team frontend unavailable at http://127.0.0.1:%s/\n' "$UI_HOST_PORT"
  fail=1
fi
rest_code="$(curl -sS -o /dev/null -w '%{http_code}' --max-time 5 "http://127.0.0.1:$API_HOST_PORT/-/svc/system.ping" 2>/dev/null || true)"
[ "$rest_code" = 401 ] && printf '  PASS  REST endpoint responds with expected anonymous 401\n' || { printf '  FAIL  REST endpoint status: %s\n' "${rest_code:-unreachable}"; fail=1; }

counts="$(compose exec -T mariadb sh -lc 'mariadb -uroot -p"$MARIADB_ROOT_PASSWORD" -N -e "SELECT GROUP_CONCAT(CONCAT(type,\"=\",c)) FROM (SELECT type, COUNT(*) c FROM yp.entity WHERE area=\"pool\" GROUP BY type) t"' 2>/dev/null | tr -d '\r' || true)"
printf '  INFO  factory pools: %s\n' "${counts:-unavailable}"
printf '%s\n' "$counts" | grep -q 'hub=5' || fail=1
printf '%s\n' "$counts" | grep -q 'drumate=5' || fail=1

[ "$fail" -eq 0 ] || exit 1
