#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
require_kernel_name
docker logs --tail "${KERNEL_LOG_TAIL:-200}" "$KERNEL_CONTAINER"
