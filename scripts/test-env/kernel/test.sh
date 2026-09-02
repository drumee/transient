#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
"$KERNEL_SCRIPT_DIR/up.sh"
cleanup() {
  if [[ "${KERNEL_KEEP_RUNNING:-0}" != "1" ]]; then
    "$KERNEL_SCRIPT_DIR/down.sh"
  fi
}
trap cleanup EXIT

"$KERNEL_SCRIPT_DIR/status.sh"
service="$(curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/kernel.status")"
plugin="$(curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/plugins/ui-runtime/index.json")"
node -e '
const service = JSON.parse(process.argv[1]);
const plugin = JSON.parse(process.argv[2]);
if (service.status !== "ok" || !service.data || service.data.team || service.data.mfs || service.data.schemas) process.exit(1);
if (!plugin.hash || !plugin.entry || !plugin.version) process.exit(1);
' "$service" "$plugin"
docker exec "$KERNEL_CONTAINER" sh -ec '
  test ! -e /opt/kernel/server-team
  test ! -e /opt/kernel/ui-team
  test ! -e /opt/kernel/schemas
  test -f /runtime/generated/etc/drumee/infrastructure/routes/app.conf
  test -f /srv/drumee/runtime/plugins/ui/main/ui-runtime/index.json
'
echo "Phase 2 kernel integration: PASS"
