#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
validate_project
if [ -f "$BASELINE_RUNTIME/docker-compose.yml" ]; then
  say "stopping $COMPOSE_PROJECT and removing disposable volumes"
  compose down -v --remove-orphans
else
  docker compose -p "$COMPOSE_PROJECT" down -v --remove-orphans 2>/dev/null || true
fi

# Bind-mounted MariaDB files may be root-owned. Delete only through a container
# after the exact runtime path guard above has succeeded.
if [ -d "$BASELINE_RUNTIME/db" ] || [ -d "$BASELINE_RUNTIME/data" ]; then
  docker run --rm -v "$BASELINE_RUNTIME":/runtime busybox:stable \
    sh -c 'rm -rf /runtime/db /runtime/data /runtime/plugins' >/dev/null
fi
say "baseline containers, volumes, database and storage removed; rendered config retained"
