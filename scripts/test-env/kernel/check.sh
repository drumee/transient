#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"

if [[ "$(uname -s)" != "Linux" ]]; then
  echo "Phase 2 kernel integration requires Linux." >&2
  exit 2
fi
require_docker
docker compose version >/dev/null 2>&1 || { echo "Docker Compose plugin is required." >&2; exit 2; }
docker buildx version >/dev/null 2>&1 || { echo "Docker buildx is required." >&2; exit 2; }
command -v node >/dev/null || { echo "Node.js 18 or newer is required." >&2; exit 2; }
node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 18 ? 0 : 1)' \
  || { echo "Node.js 18 or newer is required." >&2; exit 2; }
command -v curl >/dev/null || { echo "curl is required for route checks." >&2; exit 2; }

for required in \
  sources/setup-infra/infra.js \
  sources/setup-infra/templates/etc/drumee/infrastructure/routes/app.conf.tpl \
  sources/server-essentials/lib/lex/permission.js \
  target/foundation/server-runtime/lib/index.js \
  target/foundation/ui-runtime/src/index.js \
  target/tooling/ui-build/lib/index.js; do
  if [[ ! -e "$TRANSIENT_ROOT/$required" ]]; then
    echo "Required Phase 2 path is missing: $required" >&2
    exit 2
  fi
done

assert_sources_pristine
available_kib="$(df -Pk "$TRANSIENT_ROOT" | awk 'NR==2 {print $4}')"
if [[ "${available_kib:-0}" -lt 3145728 ]]; then
  echo "At least 3 GiB free disk space is required for the kernel image." >&2
  exit 2
fi

echo "Phase 2 kernel prerequisites: PASS"
echo "runtime root: $KERNEL_RUNTIME_ROOT"
echo "image: $KERNEL_IMAGE"
