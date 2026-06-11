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

if [ -n "$PRESEED" ]; then
  [ -f "$PRESEED" ] || { echo "error: PRESEED file not found: $PRESEED" >&2; exit 1; }
  echo "==> Applying preseed for unattended install"
  command -v debconf-set-selections >/dev/null || apt-get install -y debconf-utils
  debconf-set-selections < "$PRESEED"
  echo "==> Installing drumee (noninteractive)"
  DEBIAN_FRONTEND=noninteractive apt-get install -y drumee
else
  echo "==> Installing drumee (interactive)"
  apt-get install -y drumee
fi

echo "Done. Manage with the 'drumee' CLI (drumee status, drumee log, ...)."
