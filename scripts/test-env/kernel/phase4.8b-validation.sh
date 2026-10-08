#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
transient_root="$(cd -- "$script_dir/../../.." && pwd)"

export KERNEL_CONTAINER="${KERNEL_CONTAINER:-transient-kernel-phase48b}"
export KERNEL_DB_CONTAINER="${KERNEL_DB_CONTAINER:-transient-kernel-phase48b-db}"
export KERNEL_REDIS_CONTAINER="${KERNEL_REDIS_CONTAINER:-transient-kernel-phase48b-redis}"
export KERNEL_NETWORK="${KERNEL_NETWORK:-transient-kernel-phase48b-net}"
export KERNEL_HTTP_PORT="${KERNEL_HTTP_PORT:-28648}"

cleanup() { "$script_dir/down.sh" >/dev/null 2>&1 || true; }
trap cleanup EXIT

npm test --prefix "$transient_root/target/control-plane/hub-lifecycle"
node --test "$transient_root/target/foundation/server-runtime/test/hub-authorization.test.js"
"$script_dir/up.sh"
KERNEL_PHASE48B_LIVE=1 node --test "$transient_root/tests/integration/kernel/phase4.8b-hub-lifecycle-live.test.js"
npm pack --ignore-scripts --dry-run --json "$transient_root/target/control-plane/hub-lifecycle" >/dev/null
