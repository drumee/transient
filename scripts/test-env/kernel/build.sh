#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
"$KERNEL_SCRIPT_DIR/check.sh"
assert_kernel_root "$KERNEL_RUNTIME_ROOT"

context="$(runtime_file image-context)"
case "$context" in "$KERNEL_RUNTIME_ROOT"/*) ;; *) echo "Invalid image context" >&2; exit 2 ;; esac
rm -rf "$context"
mkdir -p "$context"

cp -a "$TRANSIENT_ROOT/sources/setup-infra" "$context/setup-infra"
mkdir -p "$context/server-essentials"
cp -a "$TRANSIENT_ROOT/sources/server-essentials/lib" "$context/server-essentials/lib"
cp -a "$TRANSIENT_ROOT/target/foundation/server-runtime" "$context/server-runtime"
cp -a "$TRANSIENT_ROOT/target/foundation/ui-runtime" "$context/ui-runtime"
cp -a "$TRANSIENT_ROOT/target/tooling/ui-build" "$context/ui-build"
rm -rf "$context/ui-build/node_modules"
cp -a "$KERNEL_SCRIPT_DIR/container" "$context/container"

docker_args=(--tag "$KERNEL_IMAGE" --file "$KERNEL_SCRIPT_DIR/Dockerfile")
if [[ "${KERNEL_BUILD_QUIET:-0}" == "1" ]]; then
  docker_args=(--quiet "${docker_args[@]}")
fi
docker build "${docker_args[@]}" "$context"
echo "Built $KERNEL_IMAGE from pinned setup-infra and Phase 2 target sources."
