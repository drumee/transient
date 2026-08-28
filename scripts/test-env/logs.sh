#!/bin/bash
set -euo pipefail
source "$(dirname "$0")/lib.sh"

assert_runtime_dir
if [ "$#" -gt 1 ]; then die "usage: scripts/test-env/logs.sh [service]"; fi
if [ "$#" -eq 1 ]; then
  compose logs -f "$1"
else
  compose logs -f server-pod schemas-init schemas-populate factory mariadb
fi
