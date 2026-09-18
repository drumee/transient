#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/../../.." && pwd)"
cd "$root"

# Keep the source-regression half independent from an interactive/default
# Phase 4.4 run. The artifact test below chooses its own namespace again.
export KERNEL_CONTAINER="${KERNEL_CONTAINER:-transient-phase45-source}"
export KERNEL_DB_CONTAINER="${KERNEL_DB_CONTAINER:-transient-phase45-source-db}"
export KERNEL_REDIS_CONTAINER="${KERNEL_REDIS_CONTAINER:-transient-phase45-source-redis}"
export KERNEL_NETWORK="${KERNEL_NETWORK:-transient-phase45-source-net}"
export KERNEL_HTTP_PORT="${KERNEL_HTTP_PORT:-28646}"

# Recover only this gate's own disposable namespace if a prior interrupted run
# left it behind. This never touches the normal Phase 4.4 names.
scripts/test-env/kernel/down.sh >/dev/null

# This is the explicit Phase 4.5 gate. Its first test packs both runtimes,
# installs them below /tmp consumers, and runs the clean/upgrade integration
# environments from the extracted archives. The remaining commands retain the
# direct Phase 4/4.4 regression evidence for the normal source workspace.
node --test tests/integration/kernel/schema-manifest.test.js
node --test tests/integration/kernel/phase4.5-exportability.test.js
node --test target/foundation/server-runtime/test/*.test.js
npm test --prefix target/foundation/ui-runtime
npm test --prefix target/modules/hello
node --test target/tooling/ui-build/test/*.test.js
node --test tests/integration/kernel/hello-browser-e2e.test.js
node --test tests/integration/kernel/ui-runtime-browser.test.js
node --test tests/integration/kernel/phase4-authenticated-private.test.js
scripts/test-env/kernel/phase4.4-validation.sh
scripts/test-source-immutability.sh
echo "Phase 4.5 exportability and Phase 4/4.4 regression gate: PASS"
