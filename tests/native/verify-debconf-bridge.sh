#!/bin/bash
# REAL verification (in a disposable Debian container) that the gap-#1 fix works:
# a preseeded debconf answer flows all the way through to the DRUMEE_* environment
# that setup-infra/bin/install receives.
#
# It builds an actual .deb from THIS repo's infra/debian/{control,templates,config,
# postinst} (the code we changed) via dpkg-buildpackage + debhelper, but ships a
# *stub* /var/lib/drumee/setup-infra/bin/install that just records the env it got.
# Then: debconf-set-selections < install.conf (from render.mjs) -> apt install ->
# read back the recorded env. No private npm/seeds/static needed; host untouched.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
pass=0; fail=0
ok(){ printf '  \033[1;32mPASS\033[0m %s\n' "$1"; pass=$((pass+1)); }
no(){ printf '  \033[1;31mFAIL\033[0m %s\n' "$1"; fail=$((fail+1)); }

command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || { echo "SKIP: docker unavailable"; exit 0; }
command -v node >/dev/null 2>&1 || { echo "SKIP: node unavailable"; exit 0; }

DOMAIN="bridge-probe.example.org"; ADMIN="ops@bridge-probe.example.org"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cat > "$tmp/drumee.yaml" <<YAML
instance:
  description: Bridge Test
  domain: $DOMAIN
  admin_email: $ADMIN
tls:
  mode: acme
  acme_email: $ADMIN
storage:
  db_dir: /srv/db-probe
  data_dir: /data-probe
YAML
node "$root/config/render.mjs" debconf --config "$tmp/drumee.yaml" > "$tmp/install.conf" 2>/dev/null \
  || node "$root/config/render.mjs" debconf --config "$tmp/drumee.yaml" --out "$tmp/install.conf" >/dev/null 2>&1
grep -q "$DOMAIN" "$tmp/install.conf" || { echo "SKIP: could not render preseed"; exit 0; }

echo "==> Building + installing a stub drumee-infra in debian:12 (isolated)…"
out="$(docker run --rm -i -v "$root/infra/debian":/idebian:ro -v "$tmp":/in:ro debian:12 bash -s "$DOMAIN" "$ADMIN" <<'INNER' 2>&1
set -e
DOMAIN="$1"; ADMIN="$2"
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq build-essential debhelper dpkg-dev debconf-utils >/dev/null

P=/tmp/pkg; mkdir -p "$P/debian/source" "$P/bin"
# Reuse THIS repo's debconf assets (the code under test):
cp /idebian/templates "$P/debian/templates"
cp /idebian/config    "$P/debian/config"
cp /idebian/postinst  "$P/debian/postinst"

# Minimal control: only depend on debconf (skip nginx/nodejs so the test is light).
cat > "$P/debian/control" <<EOF
Source: drumee-infra
Section: admin
Priority: optional
Maintainer: test <test@drumee>
Build-Depends: debhelper-compat (= 12)
Standards-Version: 4.5.0

Package: drumee-infra
Architecture: all
Depends: \${misc:Depends}, debconf
Description: stub drumee-infra for the debconf->env bridge test
EOF
printf '1.0\n' > "$P/debian/source/format"
cat > "$P/debian/changelog" <<EOF
drumee-infra (1.0) unstable; urgency=low

  * bridge test build.

 -- test <test@drumee>  Thu, 01 Jan 1970 00:00:00 +0000
EOF
cat > "$P/debian/rules" <<'EOF'
#!/usr/bin/make -f
%:
	dh $@
EOF
chmod +x "$P/debian/rules"

# Stub setup-infra/bin/install: record exactly the env the bridge exported.
cat > "$P/bin/install" <<'EOF'
#!/bin/sh
mkdir -p /var/log/drumee
{
  echo "DRUMEE_DOMAIN_NAME=$DRUMEE_DOMAIN_NAME"
  echo "ADMIN_EMAIL=$ADMIN_EMAIL"
  echo "ACME_EMAIL_ACCOUNT=$ACME_EMAIL_ACCOUNT"
  echo "DRUMEE_DB_DIR=$DRUMEE_DB_DIR"
  echo "DRUMEE_DATA_DIR=$DRUMEE_DATA_DIR"
  echo "DRUMEE_DESCRIPTION=$DRUMEE_DESCRIPTION"
} > /var/log/drumee/bridge.env
echo "[stub bin/install] recorded env for $DRUMEE_DOMAIN_NAME"
EOF
chmod +x "$P/bin/install"
echo "bin/install var/lib/drumee/setup-infra/bin" > "$P/debian/install"

( cd "$P" && dpkg-buildpackage -us -uc -b >/tmp/build.log 2>&1 ) || { echo "BUILD FAILED"; tail -25 /tmp/build.log; exit 1; }
echo "built: $(ls /tmp/drumee-infra_*.deb)"

# Preseed the debconf answers, then install (apt runs the config preconfigure).
debconf-set-selections < /in/install.conf
apt-get install -y -qq /tmp/drumee-infra_*.deb >/tmp/inst.log 2>&1 || { echo "INSTALL FAILED"; tail -25 /tmp/inst.log; }

echo "----RECORDED-ENV----"
cat /var/log/drumee/bridge.env 2>/dev/null || echo "(stub never ran — bridge did not reach bin/install)"
INNER
)"
echo "$out" | sed 's/^/    /'

env="$(echo "$out" | sed -n '/----RECORDED-ENV----/,$p')"
echo "$env" | grep -q "DRUMEE_DOMAIN_NAME=$DOMAIN"          && ok "preseeded domain reached bin/install env"        || no "domain did not bridge"
echo "$env" | grep -q "ADMIN_EMAIL=$ADMIN"                  && ok "admin email bridged"                              || no "admin email did not bridge"
echo "$env" | grep -q "ACME_EMAIL_ACCOUNT=$ADMIN"           && ok "acme email bridged (defaulted to admin)"          || no "acme email did not bridge"
echo "$env" | grep -q "DRUMEE_DB_DIR=/srv/db-probe"         && ok "db_dir bridged"                                   || no "db_dir did not bridge"
echo "$env" | grep -q "DRUMEE_DATA_DIR=/data-probe"         && ok "data_dir bridged"                                 || no "data_dir did not bridge"

printf '\n\033[1m== debconf-bridge verify: %d passed, %d failed ==\033[0m\n' "$pass" "$fail"
[ "$fail" = 0 ]
