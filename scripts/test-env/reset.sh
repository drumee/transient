#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
"$TEST_ENV_SCRIPT_DIR/down.sh"
assert_runtime_dir
rm -f \
  "$BASELINE_RUNTIME/drumee.yaml" \
  "$BASELINE_RUNTIME/.env" \
  "$BASELINE_RUNTIME/docker-compose.yml" \
  "$BASELINE_RUNTIME/docker-compose.test.yml" \
  "$BASELINE_RUNTIME/Caddyfile" \
  "$BASELINE_RUNTIME/install.conf" \
  "$BASELINE_RUNTIME/plugins.json" \
  "$BASELINE_RUNTIME/runtime.env"
rmdir "$BASELINE_RUNTIME" 2>/dev/null || true

if [ "${REMOVE_TEST_IMAGES:-0}" = 1 ]; then
  say "removing local Drumee test images by explicit request"
  for image in schemas server-pod ui-build schemas-populate static wireguard infra-init; do
    docker image rm "drumee/$image:local" 2>/dev/null || true
  done
fi
say "baseline runtime reset complete"
