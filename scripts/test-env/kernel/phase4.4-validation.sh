#!/usr/bin/env bash
set -euo pipefail

root="$(cd -- "$(dirname -- "$0")/../../.." && pwd)"
cd "$root"

# Keep the Phase 4.4 schema paths coupled: the clean closure and the upgrade
# from e8e7bac8e are both required evidence, not an optional local command.
for schema_mode in clean upgrade; do
  echo "Phase 4.4 validation: schema mode=${schema_mode}"
  KERNEL_SCHEMA_MODE="$schema_mode" node --test tests/integration/kernel/phase4.4-websocket-push.test.js
done
