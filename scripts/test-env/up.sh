#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
validate_project
validate_port UI_HOST_PORT "$UI_HOST_PORT"
validate_port API_HOST_PORT "$API_HOST_PORT"
[ "$UI_HOST_PORT" != "$API_HOST_PORT" ] || die "UI_HOST_PORT and API_HOST_PORT must differ"
assert_sources_clean
docker info >/dev/null 2>&1 || die "Docker daemon is not reachable"

for image in schemas server-pod ui-build schemas-populate; do
  docker image inspect "drumee/$image:local" >/dev/null 2>&1 || die "missing drumee/$image:local; run scripts/test-env/build.sh"
done

mkdir -p "$BASELINE_RUNTIME/db" "$BASELINE_RUNTIME/data" "$BASELINE_RUNTIME/plugins"
umask 077
cat > "$BASELINE_RUNTIME/drumee.yaml" <<YAML
instance:
  description: Transient Baseline Test
  domain: localhost
  local_mode: true
  admin_email: $TEST_ADMIN_EMAIL
tls:
  mode: self-signed
storage:
  data_dir: $BASELINE_RUNTIME/data
  db_dir: $BASELINE_RUNTIME/db
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

node "$DEBIAN_ROOT/config/render.mjs" all \
  --config "$BASELINE_RUNTIME/drumee.yaml" --out-dir "$BASELINE_RUNTIME" >/dev/null
cat >> "$BASELINE_RUNTIME/.env" <<ENV
CREATE_ADMIN=1
ADMIN_PASSWORD=$TEST_ADMIN_PASSWORD
POOL_COUNT=5
POOL_WATERMARK=5
POOL_INTERVAL=5
ENV
chmod 600 "$BASELINE_RUNTIME/.env"

# The authoritative E2E omits the proxy to avoid host conflicts. This persistent
# wrapper follows it and publishes the two server listeners on loopback only.
cat > "$BASELINE_RUNTIME/docker-compose.test.yml" <<YAML
services:
  server-pod:
    ports:
      - "127.0.0.1:$UI_HOST_PORT:23000"
      - "127.0.0.1:$API_HOST_PORT:24000"
YAML
write_runtime_description

say "starting isolated baseline project $COMPOSE_PROJECT"
compose up -d mariadb redis schemas-init ui-build schemas-populate server-pod factory

printf '\nBaseline stack is starting.\n'
printf '  Compose project: %s\n' "$COMPOSE_PROJECT"
printf '  Runtime:         %s\n' "$BASELINE_RUNTIME"
printf '  Team UI:         http://127.0.0.1:%s/\n' "$UI_HOST_PORT"
printf '  REST base:       http://127.0.0.1:%s/\n' "$API_HOST_PORT"
printf '  Admin email:     %s\n' "$TEST_ADMIN_EMAIL"
printf '  Credentials:     %s/.env or schemas-populate logs (test-only)\n' "$BASELINE_RUNTIME"
printf '  Status:          scripts/test-env/status.sh\n'
printf '  Logs:            scripts/test-env/logs.sh [service]\n'
printf '  Shutdown:        scripts/test-env/down.sh\n'
