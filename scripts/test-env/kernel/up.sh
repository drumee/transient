#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
require_kernel_db_name
"$KERNEL_SCRIPT_DIR/configure.sh"

case "$KERNEL_SCHEMA_MODE" in
  clean|upgrade) ;;
  *) echo "KERNEL_SCHEMA_MODE must be clean or upgrade." >&2; exit 2 ;;
esac

if docker container inspect "$KERNEL_CONTAINER" >/dev/null 2>&1; then
  echo "Kernel test container already exists: $KERNEL_CONTAINER" >&2
  echo "Use scripts/test-env/kernel/status.sh or down.sh first." >&2
  exit 2
fi
if [[ ! "$KERNEL_HTTP_PORT" =~ ^[1-9][0-9]{3,4}$ ]]; then
  echo "KERNEL_HTTP_PORT must be an unprivileged TCP port." >&2
  exit 2
fi

if docker container inspect "$KERNEL_DB_CONTAINER" >/dev/null 2>&1; then
  echo "Kernel test database already exists: $KERNEL_DB_CONTAINER" >&2
  echo "Use scripts/test-env/kernel/status.sh or down.sh first." >&2
  exit 2
fi
if docker container inspect "$KERNEL_REDIS_CONTAINER" >/dev/null 2>&1; then
  echo "Kernel test Redis already exists: $KERNEL_REDIS_CONTAINER" >&2
  echo "Use scripts/test-env/kernel/status.sh or down.sh first." >&2
  exit 2
fi

if ! docker network inspect "$KERNEL_NETWORK" >/dev/null 2>&1; then
  docker network create "$KERNEL_NETWORK" >/dev/null
fi

docker run -d \
  --name "$KERNEL_REDIS_CONTAINER" \
  --network "$KERNEL_NETWORK" \
  --network-alias phase4-redis \
  redis:7.4-alpine redis-server --save '' --appendonly no >/dev/null

for attempt in $(seq 1 20); do
  if docker exec "$KERNEL_REDIS_CONTAINER" redis-cli ping | grep -q '^PONG$'; then
    break
  fi
  if [[ "$attempt" == "20" ]]; then
    docker logs "$KERNEL_REDIS_CONTAINER" >&2 || true
    echo "Phase 4.4 Redis did not become ready." >&2
    exit 1
  fi
  sleep 1
done

# Mount the initialization artifacts individually so their execution order is
# explicit. `upgrade` instead starts from the pinned e8e7bac8e tables and
# applies the current closure twice after representative legacy rows exist.
db_command=(docker run -d
  --name "$KERNEL_DB_CONTAINER"
  --network "$KERNEL_NETWORK"
  --network-alias phase4-db
  --env "MARIADB_DATABASE=$KERNEL_DB_NAME"
  --env "MARIADB_USER=$KERNEL_DB_USER"
  --env "MARIADB_PASSWORD=$KERNEL_DB_PASSWORD"
  --env "MARIADB_ROOT_PASSWORD=$KERNEL_DB_ROOT_PASSWORD"
  --env "PHASE4_TEST_PASSWORD=$KERNEL_PHASE4_TEST_PASSWORD")
if [[ "$KERNEL_SCHEMA_MODE" == "clean" ]]; then
  db_command+=(
    --volume "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-schema.sql:/docker-entrypoint-initdb.d/00-phase4-schema.sql:ro"
    --volume "$TRANSIENT_ROOT/target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql:/docker-entrypoint-initdb.d/05-phase4.4-websocket.sql:ro"
    --volume "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-fixture.sh:/docker-entrypoint-initdb.d/10-phase4-fixture.sh:ro")
fi
db_command+=(mariadb:11.4)
"${db_command[@]}" >/dev/null

if [[ "$KERNEL_SCHEMA_MODE" == "upgrade" ]]; then
  for attempt in $(seq 1 40); do
    if docker exec -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
      mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" --execute 'SELECT 1' >/dev/null 2>&1; then
      break
    fi
    if [[ "$attempt" == "40" ]]; then
      docker logs "$KERNEL_DB_CONTAINER" >&2 || true
      echo "Phase 4.4 upgrade database did not become ready." >&2
      exit 1
    fi
    sleep 1
  done
  apply_pinned_schema() {
    local revision="$1"
    local schema_path="$2"
    git -C "$TRANSIENT_ROOT" show "${revision}:${schema_path}" | docker exec -i \
      -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
      mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME"
  }
  apply_current_schema() {
    local schema_path="$1"
    docker exec -i -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
      mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" < "$schema_path"
  }
  apply_pinned_schema e8e7bac8e target/os/schemas/yellow-page-auth/phase4-schema.sql
  apply_pinned_schema e8e7bac8e target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql
  # The corrected Phase 4 base closure adds sys_conf, which was absent from
  # e8e7bac8e and is required for organisation-provisioned system principals.
  # Its CREATE IF NOT EXISTS clauses intentionally leave legacy nullable rows
  # intact for the Phase 4.4 migration below to repair.
  apply_current_schema "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-schema.sql"
  docker exec -i \
    -e "MARIADB_DATABASE=$KERNEL_DB_NAME" \
    -e "MARIADB_ROOT_PASSWORD=$KERNEL_DB_ROOT_PASSWORD" \
    -e "PHASE4_TEST_PASSWORD=$KERNEL_PHASE4_TEST_PASSWORD" \
    "$KERNEL_DB_CONTAINER" bash < "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-fixture-e8.sh"
  docker exec -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
    mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" --execute "
      INSERT INTO authn (token, value) VALUES ('legacy-authn-token-00001', JSON_OBJECT('id', 'upgrade-null-session-01', 'type', 'session'));
      INSERT INTO cookie (id, uid, ctime, mtime, ua, ttl, failed, status)
        VALUES ('upgrade-null-session-01', NULL, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 'legacy', 2592000, 0, 'new');
      INSERT INTO socket (id, session_id, uid, domain_id, ctime, mtime)
        VALUES ('upgrade-null-socket-000001', 'upgrade-null-session-01', NULL, 41, UNIX_TIMESTAMP(), UNIX_TIMESTAMP());"
  apply_current_schema "$TRANSIENT_ROOT/target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql"
  # A partially applied predecessor may already have a nullable ctime column.
  # Its NULL-aged OTAKs must be invalidated rather than made fresh by the
  # upgrade. Exercise that exact fail-closed branch before the idempotency
  # application below.
  docker exec -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
    mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" --execute "
      ALTER TABLE authn MODIFY COLUMN ctime int(11) unsigned DEFAULT NULL;
      INSERT INTO authn (token, value, ctime)
        VALUES ('legacy-null-ctime-otak-01', JSON_OBJECT('id', 'upgrade-null-session-01', 'type', 'session'), NULL);"
  apply_current_schema "$TRANSIENT_ROOT/target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql"
  # The third application is the idempotency proof for the corrected target
  # schema after both historical upgrade branches have run.
  apply_current_schema "$TRANSIENT_ROOT/target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql"
fi

for attempt in $(seq 1 40); do
  if docker exec -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
    mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" \
    --execute 'SELECT domain_permission("phase4authuser01", 41, 2) AS granted' >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "40" ]]; then
    docker logs "$KERNEL_DB_CONTAINER" >&2 || true
    echo "Phase 4 Yellow Page database did not become ready." >&2
    exit 1
  fi
  sleep 1
done

assert_kernel_root "$KERNEL_RUNTIME_ROOT"
credential_dir="$(runtime_file credential)"
mkdir -p "$credential_dir"
umask 077
printf '{"host":"phase4-db","port":3306,"user":"%s","password":"%s"}\n' \
  "$KERNEL_DB_USER" "$KERNEL_DB_PASSWORD" > "$credential_dir/db.json"
printf '{"redisHost":"phase4-redis","redisPort":6379,"liveUpdateChannel":"KERNEL_PHASE44_PUSH"}\n' \
  > "$credential_dir/redis.json"

docker run -d \
  --name "$KERNEL_CONTAINER" \
  --user "$(id -u):$(id -g)" \
  --network "$KERNEL_NETWORK" \
  --publish "127.0.0.1:${KERNEL_HTTP_PORT}:${KERNEL_HTTP_PORT}" \
  --volume "$(runtime_file .):/runtime" \
  --volume "$(runtime_file runtime):/srv/drumee" \
  --volume "$credential_dir:/etc/drumee/credential:ro" \
  --env "KERNEL_HTTP_PORT=$KERNEL_HTTP_PORT" \
  --env "KERNEL_DB_NAME=$KERNEL_DB_NAME" \
  --env "KERNEL_DB_USER=$KERNEL_DB_USER" \
  --env "KERNEL_WEBSOCKET_ALLOWED_ORIGINS=$KERNEL_WEBSOCKET_ALLOWED_ORIGINS" \
  "$KERNEL_IMAGE" >/dev/null

for attempt in $(seq 1 20); do
  if curl --fail --silent "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/kernel.status" >/dev/null 2>&1; then
    break
  fi
  if [[ "$attempt" == "20" ]]; then
    docker logs "$KERNEL_CONTAINER" >&2 || true
    echo "Kernel service did not become reachable." >&2
    exit 1
  fi
  sleep 1
done

echo "Kernel integration environment started"
echo "container: $KERNEL_CONTAINER"
echo "database:  $KERNEL_DB_CONTAINER (Yellow Page only; no host port)"
echo "redis:     $KERNEL_REDIS_CONTAINER (push bus only; no host port)"
echo "runtime:   $KERNEL_RUNTIME_ROOT"
echo "HTTP URL:  http://127.0.0.1:${KERNEL_HTTP_PORT}"
echo "status:    scripts/test-env/kernel/status.sh"
echo "logs:      scripts/test-env/kernel/logs.sh"
echo "shutdown:  scripts/test-env/kernel/down.sh"
