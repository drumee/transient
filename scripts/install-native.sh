#!/bin/bash
# Drumee native-channel bootstrap — adds the signed APT repo and installs Drumee.
#
#   curl -fsSL https://get.drumee.io/native | sudo bash
#   # unattended (preseed answers first):
#   sudo PRESEED=/path/to/install.conf bash install-native.sh
#
# Env:
#   APT_URL   (default https://apt.drumee.io)   repo base URL
#   SUITE     (default stable)                  apt suite/channel
#   PRESEED   (optional)                        install.conf from config/render.mjs
set -euo pipefail

APT_URL="${APT_URL:-https://apt.drumee.io}"
SUITE="${SUITE:-stable}"
PRESEED="${PRESEED:-}"

[ "$(id -u)" = "0" ] || { echo "error: run as root (sudo)" >&2; exit 1; }
command -v apt-get >/dev/null || { echo "error: this installer targets Debian/Ubuntu" >&2; exit 1; }

echo "==> Adding Drumee APT repository ($APT_URL $SUITE)"
install -d -m 0755 /etc/apt/keyrings
curl -fsSL "$APT_URL/drumee-archive-keyring.asc" -o /etc/apt/keyrings/drumee.asc
echo "deb [signed-by=/etc/apt/keyrings/drumee.asc] $APT_URL $SUITE main" \
  > /etc/apt/sources.list.d/drumee.list

echo "==> apt update"
apt-get update

# Drumee's runtime deps require Node.js >= 20 (e.g. the ESM-only mariadb npm), but
# Debian/Ubuntu ship Node 18 or older. Ensure Node 20 from NodeSource so the
# packages' `nodejs (>= 20)` dependency resolves (matches the container channel's
# node:20). NodeSource's nodejs bundles npm.
node_major="$(command -v node >/dev/null 2>&1 && node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)"
if [ "${node_major:-0}" -lt 20 ]; then
  echo "==> Installing Node.js 20 (NodeSource); current: ${node_major:-none}"
  command -v curl >/dev/null || apt-get install -y curl ca-certificates
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi

# drumee-infra renders MariaDB's conffiles (50-server.cnf/50-client.cnf), so when
# mariadb-server installs afterward dpkg would prompt about the conffile conflict
# and abort on a closed stdin. Keep the Drumee-rendered versions automatically.
CONFOPTS=(-o Dpkg::Options::=--force-confold -o Dpkg::Options::=--force-confdef)

if [ -n "$PRESEED" ]; then
  [ -f "$PRESEED" ] || { echo "error: PRESEED file not found: $PRESEED" >&2; exit 1; }
  echo "==> Applying preseed for unattended install"
  command -v debconf-set-selections >/dev/null || apt-get install -y debconf-utils
  debconf-set-selections < "$PRESEED"
  echo "==> Installing drumee (noninteractive)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y "${CONFOPTS[@]}" drumee
else
  echo "==> Installing drumee (interactive)"
  apt-get install -y "${CONFOPTS[@]}" drumee
fi

echo "Done. Manage with the 'drumee' CLI (drumee status, drumee log, ...)."
