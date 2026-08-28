#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee Phase 1 baseline compatibility harness =="
find tests/unit tests/compatibility tests/integration -name '*.test.js' -print0 | sort -z | xargs -0 node --test
