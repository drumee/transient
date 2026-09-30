#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SYSTEM_MFS_ROOT="${KERNEL_SYSTEM_MFS_ROOT:-$(cd "$ROOT/.." && pwd)/system-mfs}"

cd "$ROOT"
node scripts/check-system-mfs-sync.js
node --test \
  target/foundation/server-runtime/test/mfs-authorization.test.js \
  target/modules/finder/test/finder-core.test.js \
  target/modules/host-filesystem/test/host-filesystem.test.js \
  target/modules/media-service/test/media.test.js \
  target/modules/mfs-service/test/service.test.js \
  target/modules/mfs-transfer/test/transfer.test.js \
  tests/integration/kernel/phase4.8-backend-dispatch.test.js \
  tests/integration/kernel/phase4.8-multi-client-sync.test.js \
  tests/integration/kernel/phase4.8-transfer-boundary.test.js \
  tests/integration/kernel/phase4.8-finder-browser.test.js

KERNEL_BUILD_QUIET=1 scripts/test-env/kernel/test.sh

cd "$SYSTEM_MFS_ROOT"
npm test
