#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

"$TEST_ENV_SCRIPT_DIR/check.sh"
assert_sources_clean

if [ -d "$(source_path server-team)/node_modules" ] && [ -d "$(source_path ui-team)/node_modules" ]; then
  server_context="$(source_path server-team)"
  ui_context="$(source_path ui-team)"
else
  "$TEST_ENV_SCRIPT_DIR/stage-build-src.sh"
  server_context="$BUILD_SRC_ROOT/server-team"
  ui_context="$BUILD_SRC_ROOT/ui-team"
fi

export SERVER_SRC="$server_context"
export UI_SRC="$ui_context"
export SCHEMAS_SRC="$(source_path schemas)"
export SETUP_SCHEMAS_SRC="$(source_path setup-schemas)"
export STATIC_SRC="$(source_path static)"
export SETUP_INFRA_SRC="$(source_path setup-infra)"
export TAG="${TAG:-local}"
export MEDIA_DEPS="${MEDIA_DEPS:-0}"

say "building immutable Drumee baseline sources with Debian tooling"
printf '  SERVER_SRC=%s\n  UI_SRC=%s\n  SCHEMAS_SRC=%s\n  SETUP_SCHEMAS_SRC=%s\n  STATIC_SRC=%s\n  SETUP_INFRA_SRC=%s\n  TAG=%s\n  MEDIA_DEPS=%s\n' \
  "$SERVER_SRC" "$UI_SRC" "$SCHEMAS_SRC" "$SETUP_SCHEMAS_SRC" "$STATIC_SRC" "$SETUP_INFRA_SRC" "$TAG" "$MEDIA_DEPS"
"$DEBIAN_ROOT/scripts/build-images-local.sh"
assert_sources_clean

if [ "$TAG" != local ]; then
  printf 'WARNING: sources/debian/tests/e2e-local.sh requires drumee/*:local; rebuild with TAG=local before e2e.sh.\n' >&2
fi
