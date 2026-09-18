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
KERNEL_SERVER_RUNTIME_TGZ="${KERNEL_SERVER_RUNTIME_TGZ:-}"
KERNEL_UI_RUNTIME_TGZ="${KERNEL_UI_RUNTIME_TGZ:-}"
KERNEL_SERVER_RUNTIME_SOURCE="${KERNEL_SERVER_RUNTIME_SOURCE:-$TRANSIENT_ROOT/target/foundation/server-runtime}"
KERNEL_UI_RUNTIME_SOURCE="${KERNEL_UI_RUNTIME_SOURCE:-$TRANSIENT_ROOT/target/foundation/ui-runtime}"

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

assert_kernel_package_destination() {
  local candidate="$1"
  case "$candidate" in
    "$KERNEL_RUNTIME_ROOT/package-input/server-runtime"|"$KERNEL_RUNTIME_ROOT/package-input/ui-runtime") ;;
    *) echo "Refusing runtime package destination outside kernel package inputs: $candidate" >&2; exit 2 ;;
  esac
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

extract_runtime_tarball() {
  local artifact="$1"
  local destination="$2"
  local expected_package="$3"
  assert_kernel_package_destination "$destination"
  if [[ ! -f "$artifact" ]]; then
    echo "Runtime package tarball is missing: $artifact" >&2
    exit 2
  fi
  case "$artifact" in
    "$destination"/*)
      echo "Runtime package tarball must be outside its extraction destination: $artifact" >&2
      exit 2
      ;;
  esac
  rm -rf "$destination"
  mkdir -p "$destination"
  tar -xzf "$artifact" --strip-components=1 -C "$destination"
  if [[ ! -f "$destination/package.json" ]]; then
    echo "Runtime package tarball has no package.json: $artifact" >&2
    exit 2
  fi
  local package_name
  package_name="$(node -p "require(process.argv[1]).name" "$destination/package.json")"
  if [[ "$package_name" != "$expected_package" ]]; then
    echo "Unexpected runtime package in $artifact: $package_name" >&2
    exit 2
  fi
}

resolve_kernel_runtime_inputs() {
  assert_kernel_root "$KERNEL_RUNTIME_ROOT"
  if [[ -n "$KERNEL_SERVER_RUNTIME_TGZ" ]]; then
    KERNEL_SERVER_RUNTIME_SOURCE="$(runtime_file package-input/server-runtime)"
    extract_runtime_tarball "$KERNEL_SERVER_RUNTIME_TGZ" "$KERNEL_SERVER_RUNTIME_SOURCE" "@drumee/server-runtime-extraction"
  fi
  if [[ -n "$KERNEL_UI_RUNTIME_TGZ" ]]; then
    KERNEL_UI_RUNTIME_SOURCE="$(runtime_file package-input/ui-runtime)"
    extract_runtime_tarball "$KERNEL_UI_RUNTIME_TGZ" "$KERNEL_UI_RUNTIME_SOURCE" "@drumee/ui-runtime-extraction"
  fi
  export KERNEL_SERVER_RUNTIME_SOURCE KERNEL_UI_RUNTIME_SOURCE
}
