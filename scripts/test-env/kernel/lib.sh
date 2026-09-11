#!/usr/bin/env bash
set -euo pipefail

KERNEL_SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
TRANSIENT_ROOT="$(cd -- "$KERNEL_SCRIPT_DIR/../../.." && pwd)"
KERNEL_RUNTIME_ROOT="$TRANSIENT_ROOT/.tmp/test-env/kernel"
KERNEL_IMAGE="${KERNEL_IMAGE:-transient-kernel-phase2:local}"
KERNEL_CONTAINER="${KERNEL_CONTAINER:-transient-kernel-phase2}"
KERNEL_HTTP_PORT="${KERNEL_HTTP_PORT:-28642}"
KERNEL_NETWORK="${KERNEL_NETWORK:-transient-kernel-phase4-net}"
KERNEL_DB_CONTAINER="${KERNEL_DB_CONTAINER:-transient-kernel-phase4-db}"
KERNEL_REDIS_CONTAINER="${KERNEL_REDIS_CONTAINER:-transient-kernel-phase4-redis}"
KERNEL_DB_NAME="${KERNEL_DB_NAME:-yp}"
KERNEL_DB_USER="${KERNEL_DB_USER:-kernel_phase4}"
KERNEL_DB_PASSWORD="${KERNEL_DB_PASSWORD:-phase4-disposable-db}"
KERNEL_DB_ROOT_PASSWORD="${KERNEL_DB_ROOT_PASSWORD:-phase4-disposable-root}"
KERNEL_PHASE4_TEST_PASSWORD="${KERNEL_PHASE4_TEST_PASSWORD:-phase4-disposable-user}"
KERNEL_WEBSOCKET_ALLOWED_ORIGINS="${KERNEL_WEBSOCKET_ALLOWED_ORIGINS:-http://allowed.external.test}"
KERNEL_SCHEMA_MODE="${KERNEL_SCHEMA_MODE:-clean}"

require_kernel_name() {
  case "$KERNEL_CONTAINER" in
    transient-*) ;;
    *) echo "Refusing non-test container name: $KERNEL_CONTAINER" >&2; exit 2 ;;
  esac
}

require_kernel_db_name() {
  case "$KERNEL_DB_CONTAINER" in
    transient-*-db) ;;
    *) echo "Refusing non-test database container name: $KERNEL_DB_CONTAINER" >&2; exit 2 ;;
  esac
  case "$KERNEL_REDIS_CONTAINER" in
    transient-*-redis) ;;
    *) echo "Refusing non-test Redis container name: $KERNEL_REDIS_CONTAINER" >&2; exit 2 ;;
  esac
  case "$KERNEL_NETWORK" in
    transient-*-net) ;;
    *) echo "Refusing non-test Docker network name: $KERNEL_NETWORK" >&2; exit 2 ;;
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
