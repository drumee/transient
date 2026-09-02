#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
"$KERNEL_SCRIPT_DIR/down.sh"
assert_kernel_root "$KERNEL_RUNTIME_ROOT"
rm -rf "$KERNEL_RUNTIME_ROOT"
if [[ "${REMOVE_KERNEL_IMAGE:-0}" == "1" ]]; then
  docker image rm "$KERNEL_IMAGE"
fi
echo "Removed disposable kernel runtime state."
