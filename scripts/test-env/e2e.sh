#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

"$TEST_ENV_SCRIPT_DIR/check.sh"
assert_sources_clean
for image in schemas server-pod ui-build schemas-populate; do
  docker image inspect "drumee/$image:local" >/dev/null 2>&1 || die "missing drumee/$image:local; run scripts/test-env/build.sh"
done

say "running authoritative Debian local-image E2E"
"$DEBIAN_ROOT/tests/e2e-local.sh"
assert_sources_clean
