#!/bin/bash

set -euo pipefail

TEST_ENV_SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TRANSIENT_ROOT="$(cd "$TEST_ENV_SCRIPT_DIR/../.." && pwd)"
DEBIAN_ROOT="$TRANSIENT_ROOT/sources/debian"
TEST_ENV_ROOT="$TRANSIENT_ROOT/.tmp/test-env"
BASELINE_RUNTIME="$TEST_ENV_ROOT/baseline"
BUILD_SRC_ROOT="$TEST_ENV_ROOT/build-src"
RESULTS_ROOT="$TEST_ENV_ROOT/results"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-transient-baseline}"
UI_HOST_PORT="${UI_HOST_PORT:-23800}"
API_HOST_PORT="${API_HOST_PORT:-24800}"
TEST_ADMIN_EMAIL="${TEST_ADMIN_EMAIL:-admin@transient.test}"
TEST_ADMIN_PASSWORD="${TEST_ADMIN_PASSWORD:-TransientBaseline2026!}"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

say() {
  printf '==> %s\n' "$*"
}

source_path() {
  printf '%s/sources/%s\n' "$TRANSIENT_ROOT" "$1"
}

assert_sources_clean() {
  local dirty
  dirty="$(git -C "$TRANSIENT_ROOT" status --porcelain --untracked-files=all -- sources)"
  [ -z "$dirty" ] || die "sources/** is not pristine:\n$dirty"
}

assert_runtime_dir() {
  local expected actual
  expected="$TEST_ENV_ROOT/baseline"
  actual="${1:-$BASELINE_RUNTIME}"
  [ "$actual" = "$expected" ] || die "refusing runtime operation outside $expected (got $actual)"
  case "$actual" in
    "$TRANSIENT_ROOT"/.tmp/test-env/baseline) ;;
    *) die "unsafe runtime path: $actual" ;;
  esac
}

validate_project() {
  case "$COMPOSE_PROJECT" in
    transient-*) ;;
    *) die "COMPOSE_PROJECT must begin with transient-" ;;
  esac
  case "$COMPOSE_PROJECT" in
    *[!a-zA-Z0-9_-]*) die "COMPOSE_PROJECT may contain only letters, digits, _ or -" ;;
    *) ;;
  esac
}

validate_port() {
  local name="$1" value="$2"
  case "$value" in *[!0-9]*|'') die "$name must be an integer" ;; esac
  [ "$value" -ge 1024 ] && [ "$value" -le 65535 ] || die "$name must be between 1024 and 65535"
}

compose() {
  assert_runtime_dir
  [ -f "$BASELINE_RUNTIME/docker-compose.yml" ] || die "runtime is not rendered; run scripts/test-env/up.sh"
  docker compose \
    -f "$BASELINE_RUNTIME/docker-compose.yml" \
    -f "$BASELINE_RUNTIME/docker-compose.test.yml" \
    --env-file "$BASELINE_RUNTIME/.env" \
    -p "$COMPOSE_PROJECT" "$@"
}

write_runtime_description() {
  umask 077
  {
    printf 'COMPOSE_PROJECT=%s\n' "$COMPOSE_PROJECT"
    printf 'COMPOSE_FILE=%s\n' "$BASELINE_RUNTIME/docker-compose.yml"
    printf 'COMPOSE_OVERRIDE_FILE=%s\n' "$BASELINE_RUNTIME/docker-compose.test.yml"
    printf 'ENV_FILE=%s\n' "$BASELINE_RUNTIME/.env"
    printf 'BASE_URL=http://127.0.0.1:%s\n' "$API_HOST_PORT"
    printf 'UI_URL=http://127.0.0.1:%s\n' "$UI_HOST_PORT"
    printf 'DRUMEE_TEST_BASE_URL=http://127.0.0.1:%s\n' "$API_HOST_PORT"
    printf 'DRUMEE_TEST_UI_URL=http://127.0.0.1:%s\n' "$UI_HOST_PORT"
    printf 'MARIADB_SERVICE=mariadb\n'
    printf 'SERVER_SERVICE=server-pod\n'
    printf 'TEST_ADMIN_EMAIL=%s\n' "$TEST_ADMIN_EMAIL"
    printf 'TEST_STORAGE_ROOT=%s\n' "$BASELINE_RUNTIME/data"
  } > "$BASELINE_RUNTIME/runtime.env"
  chmod 600 "$BASELINE_RUNTIME/runtime.env"
}

source_tree_id() {
  git -C "$TRANSIENT_ROOT" rev-parse HEAD:sources
}

write_result() {
  local name="$1" status="$2" detail="${3:-}"
  mkdir -p "$RESULTS_ROOT"
  umask 077
  {
    printf 'STATUS=%s\n' "$status"
    printf 'SOURCE_TREE=%s\n' "$(source_tree_id)"
    printf 'DETAIL=%s\n' "$detail"
  } > "$RESULTS_ROOT/$name.env"
}

read_result_status() {
  local name="$1"
  local file="$RESULTS_ROOT/$name.env"
  [ -f "$file" ] || { printf 'SKIP\n'; return; }
  local status tree
  status="$(sed -n 's/^STATUS=//p' "$file")"
  tree="$(sed -n 's/^SOURCE_TREE=//p' "$file")"
  [ "$tree" = "$(source_tree_id)" ] || { printf 'SKIP\n'; return; }
  case "$status" in PASS|FAIL|SKIP) printf '%s\n' "$status" ;; *) printf 'FAIL\n' ;; esac
}
