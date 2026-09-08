#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
require_kernel_db_name
if docker container inspect "$KERNEL_CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$KERNEL_CONTAINER" >/dev/null
  echo "Removed disposable kernel container: $KERNEL_CONTAINER"
else
  echo "Kernel container is not present: $KERNEL_CONTAINER"
fi
if docker container inspect "$KERNEL_DB_CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$KERNEL_DB_CONTAINER" >/dev/null
  echo "Removed disposable Yellow Page database: $KERNEL_DB_CONTAINER"
else
  echo "Kernel database is not present: $KERNEL_DB_CONTAINER"
fi
if docker container inspect "$KERNEL_REDIS_CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$KERNEL_REDIS_CONTAINER" >/dev/null
  echo "Removed disposable Redis push bus: $KERNEL_REDIS_CONTAINER"
else
  echo "Kernel Redis push bus is not present: $KERNEL_REDIS_CONTAINER"
fi
if docker network inspect "$KERNEL_NETWORK" >/dev/null 2>&1; then
  docker network rm "$KERNEL_NETWORK" >/dev/null 2>&1 || true
fi
