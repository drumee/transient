#!/bin/bash
# Drumee WireGuard bootstrap — runs once per boot, before the agent.
#
# Responsibilities (idempotent, safe to re-run):
#   1. Generate the node keypair on first boot, persist it under
#      /etc/drumee/credential/wireguard/ (0600, never leaves the device).
#   2. Bring up the wg0 interface with a FIXED ListenPort. The fixed port is
#      not cosmetic: the agent probes the coordination server's UDP reflector
#      from this same port so the NAT mapping it learns is the one WireGuard
#      will actually use. A random port would make the mapping useless.
#   3. Publish the public key + listen port where the agent can read them.
#
# The tunnel address is NOT set here — it is assigned by the coordination
# server at registration time and applied by the agent.
set -euo pipefail

CONF_FILE="${DRUMEE_WG_CONF:-/etc/drumee/conf.d/wireguard.json}"
CRED_DIR="/etc/drumee/credential/wireguard"
IFACE="wg0"

log() { printf '[drumee-wg-bootstrap] %s\n' "$*"; }
die() { printf '[drumee-wg-bootstrap] ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$CONF_FILE" ] || die "missing config: $CONF_FILE"

# Read the two values we need without pulling in a JSON dependency.
enabled=$(node -e "process.stdout.write(String(require('$CONF_FILE').enabled))")
listen_port=$(node -e "process.stdout.write(String(require('$CONF_FILE').listen_port))")

if [ "$enabled" != "true" ]; then
  log "wireguard disabled in $CONF_FILE — nothing to do"
  exit 0
fi

command -v wg >/dev/null 2>&1 || die "wireguard-tools not installed"

# --- 1. Keypair (first boot only) -------------------------------------------
install -d -m 0700 "$CRED_DIR"
if [ ! -f "$CRED_DIR/private.key" ]; then
  log "generating node keypair"
  umask 077
  wg genkey > "$CRED_DIR/private.key"
  wg pubkey < "$CRED_DIR/private.key" > "$CRED_DIR/public.key"
  chmod 0600 "$CRED_DIR/private.key"
  chmod 0644 "$CRED_DIR/public.key"
else
  log "reusing existing keypair"
fi

# --- 2. Interface ------------------------------------------------------------
# Created by hand rather than wg-quick: no [Peer] section is known at boot
# (peers are added dynamically by the agent), and no address either.
if ! ip link show "$IFACE" >/dev/null 2>&1; then
  log "creating interface $IFACE"
  ip link add dev "$IFACE" type wireguard
fi

wg set "$IFACE" \
  listen-port "$listen_port" \
  private-key "$CRED_DIR/private.key"

ip link set up dev "$IFACE"

log "interface $IFACE up on udp/$listen_port"
log "node public key: $(cat "$CRED_DIR/public.key")"
