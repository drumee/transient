#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
if docker container inspect "$KERNEL_CONTAINER" >/dev/null 2>&1; then
  docker rm -f "$KERNEL_CONTAINER" >/dev/null
  echo "Removed disposable kernel container: $KERNEL_CONTAINER"
else
  echo "Kernel container is not present: $KERNEL_CONTAINER"
fi
