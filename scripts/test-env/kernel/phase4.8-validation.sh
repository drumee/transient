#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../../.." && pwd)"
SYSTEM_MFS_ROOT="${KERNEL_SYSTEM_MFS_ROOT:-$(cd "$ROOT/.." && pwd)/system-mfs}"

cd "$ROOT"
node scripts/check-system-mfs-sync.js
node --test \
  target/modules/finder/test/finder-core.test.js \
  target/modules/mfs-service/test/service.test.js \
  target/modules/mfs-transfer/test/transfer.test.js \
  tests/integration/kernel/phase4.8-backend-dispatch.test.js \
  tests/integration/kernel/phase4.8-multi-client-sync.test.js \
  tests/integration/kernel/phase4.8-transfer-boundary.test.js \
  tests/integration/kernel/phase4.8-finder-browser.test.js

cd "$SYSTEM_MFS_ROOT"
npm test
