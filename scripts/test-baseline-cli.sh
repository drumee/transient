#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: CLI backends, MFS, safety guards and guarded live lifecycle =="
find tests/unit -name 'cli-*.test.js' -print0 | sort -z | xargs -0 node --test
node --test tests/integration/provisioning-live.test.js
