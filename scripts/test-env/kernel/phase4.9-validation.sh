#!/usr/bin/env bash
set -euo pipefail

script_dir="$(cd -- "$(dirname -- "$0")" && pwd)"
transient_root="$(cd -- "$script_dir/../../.." && pwd)"
workspace_root="$(cd -- "$transient_root/.." && pwd)"

server_runtime_root="${KERNEL_SERVER_RUNTIME_ROOT:-$workspace_root/server-runtime}"
system_mfs_root="${KERNEL_SYSTEM_MFS_ROOT:-$workspace_root/system-mfs}"
finder_root="${KERNEL_FINDER_ROOT:-$workspace_root/finder}"
window_manager_root="${KERNEL_WINDOW_MANAGER_ROOT:-$workspace_root/window-manager}"

for required in "$server_runtime_root" "$system_mfs_root" "$finder_root" "$window_manager_root"; do
  test -f "$required/package.json" || { echo "Missing standalone package checkout: $required" >&2; exit 1; }
done

"$script_dir/phase4.8b-validation.sh"
KERNEL_SYSTEM_MFS_ROOT="$system_mfs_root" KERNEL_FINDER_ROOT="$finder_root" "$script_dir/phase4.8-validation.sh"

npm test --prefix "$server_runtime_root"
npm test --prefix "$finder_root"
npm test --prefix "$window_manager_root"

npm pack --ignore-scripts --dry-run --json "$server_runtime_root" >/dev/null
npm pack --ignore-scripts --dry-run --json "$system_mfs_root" >/dev/null
npm pack --ignore-scripts --dry-run --json "$finder_root" >/dev/null
npm pack --ignore-scripts --dry-run --json "$window_manager_root" >/dev/null
npm pack --ignore-scripts --dry-run --json "$transient_root/target/control-plane/hub-lifecycle" >/dev/null

git -C "$transient_root" diff --exit-code -- sources/
echo "Phase 4.9 Hub/Finder/MFS/runtime/Chromium/package validation: PASS"
