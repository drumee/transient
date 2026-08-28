#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
echo "== Drumee baseline: server dispatch, ACL, provisioning contracts and live probes =="
find tests/compatibility/server tests/compatibility/acl tests/compatibility/provisioning -name '*.test.js' -print0 | sort -z | xargs -0 node --test
node --test tests/integration/server-live.test.js
