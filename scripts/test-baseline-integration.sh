#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: guarded live integration suite =="
find tests/integration -name '*.test.js' -print0 | sort -z | xargs -0 node --test
