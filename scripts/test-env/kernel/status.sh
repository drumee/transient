#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
docker container inspect "$KERNEL_CONTAINER" --format 'container={{.Name}} status={{.State.Status}} running={{.State.Running}}' \
  || { echo "Kernel integration container is not present." >&2; exit 1; }
docker exec "$KERNEL_CONTAINER" nginx -t -c /runtime/nginx.conf
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/kernel.status" >/dev/null
curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/plugins/ui-runtime/index.json" >/dev/null
echo "kernel service/static routes: healthy"
