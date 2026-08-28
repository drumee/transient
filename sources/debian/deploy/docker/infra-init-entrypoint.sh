#!/bin/bash
# infra-init — render the canonical service configs with setup-infra's own engine.
#
# setup-infra owns the *shapes* of the optional-service configs (Jitsi/Prosody/
# Coturn, Postfix/OpenDKIM, BIND). This run-once container renders them from the
# same env our .env carries, into mounted volumes the service containers consume.
# It deliberately does NOT touch the core conf.d/credentials (those stay rendered
# from drumee.yaml — deterministic, with pinned secrets) or nginx (Caddy owns TLS/
# routing). It only publishes the service-config subsets requested via INFRA_PARTS.
#
# Env: DRUMEE_DOMAIN_NAME (required), ADMIN_EMAIL, PUBLIC_IP4/6, PRIVATE_*,
#      INFRA_PARTS (space/comma list: jitsi mail dns; default all),
#      WITH_JITSI=1 to also run jitsi.js.
set -euo pipefail

SETUP_INFRA_DIR="${SETUP_INFRA_DIR:-/opt/setup-infra}"
RENDER="${RENDER_DIR:-/render}"
DOMAIN="${DRUMEE_DOMAIN_NAME:?DRUMEE_DOMAIN_NAME is required}"
PARTS="${INFRA_PARTS:-jitsi mail dns}"; PARTS="${PARTS//,/ }"
export SETUP_INFRA_DIR DRUMEE_ROOT="${DRUMEE_ROOT:-$RENDER/srv/drumee}"
# setup-infra reads these env names (templates/utils.js):
export PUBLIC_DOMAIN="${PUBLIC_DOMAIN:-$DOMAIN}"
export ADMIN_EMAIL="${ADMIN_EMAIL:-admin@$DOMAIN}"
export DRUMEE_DATA_DIR="${DRUMEE_DATA_DIR:-/data}"
export DRUMEE_DB_DIR="${DRUMEE_DB_DIR:-/srv/db}"

rm -rf "$RENDER"; mkdir -p "$RENDER"

# 1. DKIM keys must exist before infra.js (it reads etc/opendkim/keys/<dom>/dkim.txt).
KEYDIR="$RENDER/etc/opendkim/keys/$DOMAIN"
mkdir -p "$KEYDIR"
if command -v opendkim-genkey >/dev/null 2>&1; then
  echo "==> Generating DKIM key for $DOMAIN"
  opendkim-genkey -b 2048 -d "$DOMAIN" -s dkim -D "$KEYDIR"
else
  echo "==> opendkim-genkey absent — writing placeholder dkim.txt (mail won't sign)"
  printf 'dkim._domainkey\tIN\tTXT\t( "v=DKIM1; h=sha256; k=rsa; p=" )\n' > "$KEYDIR/dkim.txt"
fi

# 2. Render. The shim patches the upstream args.drumee_root crash.
echo "==> Rendering infra config (setup-infra infra.js --chroot=$RENDER)"
( cd "$SETUP_INFRA_DIR" && node -r "$SETUP_INFRA_DIR/infra-root-shim.js" infra.js \
    --chroot="$RENDER" --public-domain="$DOMAIN" --only-infra=1 \
    --data-dir="$DRUMEE_DATA_DIR" --db-dir="$DRUMEE_DB_DIR" )

if [ "${WITH_JITSI:-0}" = "1" ] && [ -f "$SETUP_INFRA_DIR/jitsi.js" ]; then
  echo "==> Rendering Jitsi config (jitsi.js --chroot=$RENDER)"
  ( cd "$SETUP_INFRA_DIR" && node -r "$SETUP_INFRA_DIR/infra-root-shim.js" jitsi.js --chroot="$RENDER" ) || \
    echo "   WARN jitsi.js render failed (needs configured drumee.json) — continuing"
fi

# 3. Adapter: publish only the requested service-config subsets into their volumes.
#    Each volume is mounted at /out/<part>; we copy the relevant rendered subtree.
PART=""
publish() { # publish <src-under-render> <name-under-/out/$PART>
  local src="$RENDER/$1" dest="/out/$PART/$2"
  [ -e "$src" ] || { echo "   (skip $1 — not rendered)"; return; }
  mkdir -p "$(dirname "$dest")"; rm -rf "$dest"; cp -a "$src" "$dest"
  echo "   published $1 -> /out/$PART/$2"
}
for PART in $PARTS; do
  [ -d "/out/$PART" ] || { echo "==> '$PART' volume not mounted at /out/$PART — skipping"; continue; }
  echo "==> Publishing '$PART' configs"
  case "$PART" in
    mail)
      publish etc/postfix postfix
      publish etc/opendkim opendkim
      publish etc/mailname mailname
      publish etc/drumee/credential/postfix.json postfix.json ;;
    dns)
      publish etc/bind bind
      publish var/lib/bind var-lib-bind ;;
    jitsi)
      publish etc/drumee/conf.d/conference.json conference.json
      publish etc/prosody prosody
      publish etc/jitsi jitsi
      publish etc/turnserver.conf turnserver.conf ;;
    *) echo "   WARN unknown INFRA_PARTS entry: $PART" ;;
  esac
done

echo "==> infra-init complete"
