#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: Team/frontend module boot contracts and live smoke probes =="
node --test tests/compatibility/frontend/boot-contract.test.js tests/integration/frontend-live.test.js
