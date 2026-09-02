#!/usr/bin/env bash
set -euo pipefail

source "$(cd -- "$(dirname -- "$0")" && pwd)/lib.sh"
"$KERNEL_SCRIPT_DIR/build.sh"
assert_kernel_root "$KERNEL_RUNTIME_ROOT"
mkdir -p "$KERNEL_RUNTIME_ROOT"
if [[ -e "$(runtime_file generated)" ]]; then
  docker run --rm \
    --volume "$(runtime_file .):/out" \
    --entrypoint sh \
    "$KERNEL_IMAGE" \
    -ec 'test -d /out && rm -rf /out/generated'
fi
mkdir -p "$(runtime_file generated)"
mkdir -p "$(runtime_file runtime)"

docker run --rm \
  --user "$(id -u):$(id -g)" \
  --volume "$(runtime_file .):/out" \
  --entrypoint /opt/kernel/scripts/render-config.sh \
  "$KERNEL_IMAGE"

route="$(runtime_file generated/etc/drumee/infrastructure/routes/app.conf)"
test -f "$route"
if ! grep -q 'proxy_pass http://127.0.0.1:24000' "$route"; then
  echo "Generated setup-infra route does not contain the expected REST upstream." >&2
  exit 1
fi
echo "Generated setup-infra configuration: $(runtime_file generated)"
