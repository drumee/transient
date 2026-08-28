#!/bin/sh
# Container entrypoint for the Drumee WireGuard agent.
#
# Renders the same /etc/drumee/conf.d/wireguard.json that drumee-infra's postinst
# writes on the native channel — from the WIREGUARD_* env vars in the rendered
# .env — then runs the unmodified bootstrap + agent from the package tree.
#
# The keypair lands in /etc/drumee/credential/wireguard, which compose mounts
# from the drumee_cred volume: the private key is generated once, stays on this
# host, and survives image upgrades.
set -eu

LIB=/usr/local/lib/drumee/wireguard
CONF="${DRUMEE_WG_CONF:-/etc/drumee/conf.d/wireguard.json}"
export DRUMEE_WG_CONF="$CONF"

log() { printf '[drumee-wg-entrypoint] %s\n' "$*"; }

mkdir -p "$(dirname "$CONF")"
cat > "$CONF" <<EOF
{
  "enabled": ${WIREGUARD_ENABLED:-false},
  "coordinator_host": "${WIREGUARD_COORDINATOR:-}",
  "reflector_port": ${WIREGUARD_REFLECTOR_PORT:-51821},
  "listen_port": ${WIREGUARD_LISTEN_PORT:-51820}
}
EOF

if [ "${WIREGUARD_ENABLED:-false}" != "true" ]; then
  # Compose only starts this service under the 'wireguard' profile, which the
  # renderer enables from wireguard.enabled — so this means the env disagrees
  # with the profile. Say so instead of idling silently.
  log "WIREGUARD_ENABLED is not true — nothing to coordinate; exiting."
  exit 0
fi
if [ -z "${WIREGUARD_COORDINATOR:-}" ]; then
  log "ERROR: WIREGUARD_COORDINATOR is empty — set wireguard.coordinator in drumee.yaml."
  exit 1
fi

# wg0 is created in the HOST network namespace (network_mode: host), so the
# tunnel reaches the ports the proxy already publishes there. Both the namespace
# and the kernel module come from the host; fail with the fix, not a stack trace.
if ! "$LIB/bootstrap.sh"; then
  log "ERROR: could not bring up wg0."
  log "  The host needs the wireguard kernel module and this container needs"
  log "  NET_ADMIN + network_mode: host. On the host, try:  sudo modprobe wireguard"
  exit 1
fi

exec node "$LIB/agent.js"
