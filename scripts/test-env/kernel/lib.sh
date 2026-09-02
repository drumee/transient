#!/usr/bin/env bash
set -euo pipefail

KERNEL_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TRANSIENT_ROOT="$(cd -- "$KERNEL_SCRIPT_DIR/../../.." && pwd)"
KERNEL_RUNTIME_ROOT="$TRANSIENT_ROOT/.tmp/test-env/kernel"
KERNEL_IMAGE="${KERNEL_IMAGE:-transient-kernel-phase2:local}"
KERNEL_CONTAINER="${KERNEL_CONTAINER:-transient-kernel-phase2}"
KERNEL_HTTP_PORT="${KERNEL_HTTP_PORT:-28642}"

require_kernel_name() {
  case "$KERNEL_CONTAINER" in
    transient-*) ;;
    *) echo "Refusing non-test container name: $KERNEL_CONTAINER" >&2; exit 2 ;;
  esac
}

assert_kernel_root() {
  local candidate="$1"
  if [[ "$candidate" != "$KERNEL_RUNTIME_ROOT" ]]; then
    echo "Refusing path outside kernel test root: $candidate" >&2
    exit 2
  fi
}

assert_sources_pristine() {
  if [[ -n "$(git -C "$TRANSIENT_ROOT" status --porcelain --untracked-files=all -- sources)" ]]; then
    echo "sources/** is not pristine; kernel work refuses to continue." >&2
    exit 2
  fi
}

require_docker() {
  command -v docker >/dev/null || { echo "Docker is required." >&2; exit 2; }
  docker info >/dev/null 2>&1 || { echo "Docker daemon is unavailable to this user." >&2; exit 2; }
}

runtime_file() {
  printf '%s/%s\n' "$KERNEL_RUNTIME_ROOT" "$1"
}
