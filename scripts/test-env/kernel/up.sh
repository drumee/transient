#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
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

docker run -d \
  --name "$KERNEL_CONTAINER" \
  --user "$(id -u):$(id -g)" \
  --publish "127.0.0.1:${KERNEL_HTTP_PORT}:${KERNEL_HTTP_PORT}" \
  --volume "$(runtime_file .):/runtime" \
  --volume "$(runtime_file runtime):/srv/drumee" \
  --env "KERNEL_HTTP_PORT=$KERNEL_HTTP_PORT" \
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
echo "runtime:   $KERNEL_RUNTIME_ROOT"
echo "HTTP URL:  http://127.0.0.1:${KERNEL_HTTP_PORT}"
echo "status:    scripts/test-env/kernel/status.sh"
echo "logs:      scripts/test-env/kernel/logs.sh"
echo "shutdown:  scripts/test-env/kernel/down.sh"
