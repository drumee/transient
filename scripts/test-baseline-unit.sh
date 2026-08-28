#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: dependency-free unit characterization =="
find tests/unit -name '*.test.js' -print0 | sort -z | xargs -0 node --test
