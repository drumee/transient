#!/usr/bin/env bash
set -euo pipefail

mkdir -p /out/generated
cd /opt/setup-infra
APP_HOST=127.0.0.1 \
DRUMEE_DOMAIN_NAME=kernel.test \
DRUMEE_DESCRIPTION="Transient Phase 2 Kernel" \
node infra.js \
  --outdir /out/generated \
  --public-domain kernel.test \
  --public-ip4 127.0.0.1 \
  --private-domain '' \
  --only-infra 1 \
  --no-jitsi 1

test -f /out/generated/etc/drumee/infrastructure/routes/app.conf
