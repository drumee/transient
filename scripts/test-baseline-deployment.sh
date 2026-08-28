#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: Docker configuration and native Debian metadata =="
node --test tests/compatibility/deployment/contracts.test.js
