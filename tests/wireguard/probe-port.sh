#!/bin/bash
# Real-kernel WireGuard tests for the agent's endpoint probe.
#
#   tests/wireguard/probe-port.sh [once|cycle|race]
#
# Why this exists: the reflector records the mapping of whatever source port it
# observes (coord-server/src/udpReflector.js), so the probe MUST leave from the
# port wg0 uses. A userspace socket cannot share that port with kernel WireGuard
# — SO_REUSEADDR does not help, the bind fails with EADDRINUSE — so the agent
# borrows the port for the probe and hands it straight back. That behaviour is
# invisible to the shim-based signaling test in coord-server, hence these.
#
# Scenarios:
#   once   the probe leaves from wg0's port and the port is returned
#   cycle  the borrow/return cycle repeats, and stands down mid-rendezvous
#   race   a rendezvous arriving DURING a probe waits for the port
#
# Needs Docker + the wireguard kernel module on the host (the interface is
# created inside the container's own netns, so the host's networking is
# untouched). Self-SKIPs when either is missing. ~70s for all three.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
IMAGE="${IMAGE:-drumee/wireguard:probe-test}"
want="${1:-all}"

say()  { printf '\033[1;36m==>\033[0m %s\n' "$*"; }
skip() { printf '\033[1;33mSKIP:\033[0m %s\n' "$*"; exit 0; }

command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || skip "docker unavailable"

say "Building $IMAGE from the package tree"
docker buildx build -f "$root/deploy/docker/Dockerfile.wireguard" \
  --build-context "wg=$root/infra/var/lib/drumee/wireguard" \
  -t "$IMAGE" --load "$root/deploy/docker" >/dev/null \
  || { echo "image build failed" >&2; exit 1; }

# The module lives in the host kernel; a container cannot load it.
docker run --rm --cap-add NET_ADMIN "$IMAGE" \
  ip link add dev wgcheck type wireguard >/dev/null 2>&1 \
  || skip "the host has no wireguard kernel module (try: sudo modprobe wireguard)"

fail=0
run() { # run <name> <file>
  say "scenario: $1"
  if docker run --rm --cap-add NET_ADMIN \
      -v "$root/tests/wireguard/$2:/t.js:ro" --entrypoint node "$IMAGE" /t.js; then
    printf '\033[1;32m  %s: OK\033[0m\n' "$1"
  else
    printf '\033[1;31m  %s: FAILED\033[0m\n' "$1"; fail=1
  fi
}

wanted() { [ "$want" = all ] || [ "$want" = "$1" ]; }
wanted once  && run once  probe-once.js
wanted cycle && run cycle probe-cycle.js
wanted race  && run race  probe-race.js

echo
[ "$fail" = 0 ] && printf '\033[1;32mprobe-port: all scenarios passed\033[0m\n' \
                || printf '\033[1;31mprobe-port: failures above\033[0m\n'
exit "$fail"
