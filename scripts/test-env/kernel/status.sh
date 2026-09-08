#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
require_kernel_db_name
docker container inspect "$KERNEL_CONTAINER" --format 'container={{.Name}} status={{.State.Status}} running={{.State.Running}}' \
  || { echo "Kernel integration container is not present." >&2; exit 1; }
docker container inspect "$KERNEL_DB_CONTAINER" --format 'database={{.Name}} status={{.State.Status}} running={{.State.Running}}' \
  || { echo "Kernel Yellow Page database is not present." >&2; exit 1; }
docker container inspect "$KERNEL_REDIS_CONTAINER" --format 'redis={{.Name}} status={{.State.Status}} running={{.State.Running}}' \
  || { echo "Kernel Redis push bus is not present." >&2; exit 1; }
docker exec "$KERNEL_CONTAINER" nginx -t -c /runtime/nginx.conf
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/kernel.status" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/plugins/ui-runtime/index.json" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/bootstrap.plugin?name=hello" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/plugins/hello/index.json" >/dev/null
docker exec -e "MYSQL_PWD=$KERNEL_DB_ROOT_PASSWORD" "$KERNEL_DB_CONTAINER" \
  mariadb --protocol=tcp --host=127.0.0.1 --user=root "$KERNEL_DB_NAME" \
  --execute 'SELECT domain_permission("phase4authuser01", 41, 2) AS granted' >/dev/null
docker exec "$KERNEL_REDIS_CONTAINER" redis-cli ping | grep -q '^PONG$'
echo "kernel service/static/plugin routes, Yellow Page domain ACL and Redis push bus: healthy"
