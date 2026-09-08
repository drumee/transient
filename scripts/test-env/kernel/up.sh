#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
require_kernel_db_name
"$KERNEL_SCRIPT_DIR/configure.sh"

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

# Mount the two initialization artifacts individually so their execution
# order is explicit. The MariaDB image runs init files lexically; mounting
# the source directory directly would run the fixture before the schema.
docker run -d \
  --name "$KERNEL_DB_CONTAINER" \
  --network "$KERNEL_NETWORK" \
  --network-alias phase4-db \
  --env "MARIADB_DATABASE=$KERNEL_DB_NAME" \
  --env "MARIADB_USER=$KERNEL_DB_USER" \
  --env "MARIADB_PASSWORD=$KERNEL_DB_PASSWORD" \
  --env "MARIADB_ROOT_PASSWORD=$KERNEL_DB_ROOT_PASSWORD" \
  --env "PHASE4_TEST_PASSWORD=$KERNEL_PHASE4_TEST_PASSWORD" \
  --volume "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-schema.sql:/docker-entrypoint-initdb.d/00-phase4-schema.sql:ro" \
  --volume "$TRANSIENT_ROOT/target/foundation/server-runtime/schemas/yellow-page/phase4.4-websocket.sql:/docker-entrypoint-initdb.d/05-phase4.4-websocket.sql:ro" \
  --volume "$TRANSIENT_ROOT/target/os/schemas/yellow-page-auth/phase4-fixture.sh:/docker-entrypoint-initdb.d/10-phase4-fixture.sh:ro" \
  mariadb:11.4 >/dev/null

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
