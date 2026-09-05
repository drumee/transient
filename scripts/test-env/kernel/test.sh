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
hello_plugin="$(curl --fail --silent --show-error "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/bootstrap.plugin?name=hello")"
hello="$(curl --fail --silent --show-error --header 'content-type: application/json' --data '{}' "http://127.0.0.1:${KERNEL_HTTP_PORT}/-/svc/hello.ping")"
node -e '
const service = JSON.parse(process.argv[1]);
const plugin = JSON.parse(process.argv[2]);
const helloPlugin = JSON.parse(process.argv[3]);
const hello = JSON.parse(process.argv[4]);
if (service.status !== "ok" || !service.data || service.data.team || service.data.mfs || service.data.schemas) process.exit(1);
if (!plugin.hash || !plugin.entry || !plugin.version) process.exit(1);
if (helloPlugin.status !== "ok" || !helloPlugin.data || !helloPlugin.data.path) process.exit(1);
if (hello.status !== "ok" || !hello.data || hello.data.ok !== true || hello.data.message !== "Hello from Drumee") process.exit(1);
' "$service" "$plugin" "$hello_plugin" "$hello"
docker exec "$KERNEL_CONTAINER" sh -ec '
  test ! -e /opt/kernel/server-team
  test ! -e /opt/kernel/ui-team
  test ! -e /opt/kernel/schemas
  test -f /runtime/generated/etc/drumee/infrastructure/routes/app.conf
  test -f /srv/drumee/runtime/plugins/ui/main/ui-runtime/index.json
  test -f /srv/drumee/runtime/plugins/ui/main/hello/index.json
  test -f /srv/drumee/runtime/plugins/ui/main/hello/probe.html
'
echo "Phase 3 kernel/hello integration: PASS"
