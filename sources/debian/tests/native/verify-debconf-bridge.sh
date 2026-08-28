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

# Second preseed: TLS via a DNS provider API. ACME_ENV_FILE is the variable that
# makes setup-infra skip BIND9 and issue with dns_$ACME_PROVIDER, so it has to
# survive the bridge — and must NOT when the file it names is absent.
CREDS="/etc/drumee/credential/dns-api.env"
cat > "$tmp/drumee-api.yaml" <<YAML
instance:
  description: Bridge Test
  domain: $DOMAIN
  admin_email: $ADMIN
tls:
  mode: acme
  acme_email: $ADMIN
  dns_challenge: api
  acme_env_file: $CREDS
storage:
  db_dir: /srv/db-probe
  data_dir: /data-probe
YAML
node "$root/config/render.mjs" debconf --config "$tmp/drumee-api.yaml" > "$tmp/install-api.conf" 2>/dev/null \
  || node "$root/config/render.mjs" debconf --config "$tmp/drumee-api.yaml" --out "$tmp/install-api.conf" >/dev/null 2>&1
grep -q "acme-dns-api" "$tmp/install-api.conf" || { echo "SKIP: could not render the api preseed"; exit 0; }

# Third preseed: TLS terminated by Caddy. The renderer never emits the API token
# (it is a secret), so an unattended install adds it separately — exactly what the
# extra line below does, which is also the documented recipe.
TOKEN="tok-bridge-probe-123"
cat > "$tmp/drumee-caddy.yaml" <<YAML
instance:
  description: Bridge Test
  domain: $DOMAIN
  admin_email: $ADMIN
tls:
  mode: acme
  acme_email: $ADMIN
  terminator: caddy
  dns_provider: ovh
storage:
  db_dir: /srv/db-probe
  data_dir: /data-probe
YAML
node "$root/config/render.mjs" debconf --config "$tmp/drumee-caddy.yaml" > "$tmp/install-caddy.conf" 2>/dev/null \
  || node "$root/config/render.mjs" debconf --config "$tmp/drumee-caddy.yaml" --out "$tmp/install-caddy.conf" >/dev/null 2>&1
grep -q "tls_method	select	caddy" "$tmp/install-caddy.conf" || { echo "SKIP: could not render the caddy preseed"; exit 0; }
printf 'drumee-infra\tdrumee-infra/caddy_dns_api_key\tpassword\t%s\n' "$TOKEN" >> "$tmp/install-caddy.conf"

echo "==> Building + installing a stub drumee-infra in debian:12 (isolated)…"
out="$(docker run --rm -i -v "$root/infra/debian":/idebian:ro -v "$tmp":/in:ro debian:12 bash -s "$DOMAIN" "$ADMIN" "$CREDS" <<'INNER' 2>&1
set -e
DOMAIN="$1"; ADMIN="$2"; CREDS="$3"
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
  echo "OWN_SSL=$OWN_SSL"
  echo "ACME_ENV_FILE=$ACME_ENV_FILE"
  echo "DRUMEE_HTTP_PORT=$DRUMEE_HTTP_PORT"
  echo "DRUMEE_HTTPS_PORT=$DRUMEE_HTTPS_PORT"
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

# Re-run only the bridge (what dpkg does on reconfigure) for the TLS variants.
# No rebuild, no second apt install.
POSTINST=/var/lib/dpkg/info/drumee-infra.postinst

install -d -m 0700 "$(dirname "$CREDS")"
printf 'export ACME_PROVIDER=ovh\nexport OVH_AK=k OVH_AS=s OVH_CK=c\n' > "$CREDS"
chmod 0600 "$CREDS"
debconf-set-selections < /in/install-api.conf
"$POSTINST" configure >/tmp/tls-api.log 2>&1 || echo "(postinst configure failed: $(tail -3 /tmp/tls-api.log))"
echo "----RECORDED-ENV-API----"
cat /var/log/drumee/bridge.env 2>/dev/null

# Same answers, credentials file removed: setup-infra would silently install a
# local DNS server, so the bridge must blank the variable and warn.
rm -f "$CREDS"
"$POSTINST" configure >/tmp/tls-missing.log 2>&1 || echo "(postinst configure failed)"
echo "----POSTINST-WARNING----"
grep -i "not found\|Falling back" /tmp/tls-missing.log || echo "(no warning printed)"
echo "----RECORDED-ENV-MISSING----"
cat /var/log/drumee/bridge.env 2>/dev/null

# Caddy path, with NO caddy binary present: the answer must be refused rather than
# handing nginx's ports to something that is not installed.
debconf-set-selections < /in/install-caddy.conf
"$POSTINST" configure >/tmp/caddy-absent.log 2>&1 || echo "(postinst configure failed)"
echo "----CADDY-ABSENT----"
grep -i "no Caddy binary\|Keeping nginx" /tmp/caddy-absent.log || echo "(no refusal printed)"
echo "caddy.json exists: $([ -f /etc/drumee/conf.d/caddy.json ] && echo yes || echo no)"
cat /var/log/drumee/bridge.env 2>/dev/null

# Same answers with the binary in place: now it must configure.
printf '#!/bin/sh\nexit 0\n' > /usr/sbin/drumee-caddy; chmod +x /usr/sbin/drumee-caddy
"$POSTINST" configure >/tmp/caddy-present.log 2>&1 || echo "(postinst configure failed)"
echo "----CADDY-PRESENT----"
grep -i "Caddy will terminate\|nginx moved" /tmp/caddy-present.log || echo "(no confirmation printed)"
echo "caddy.json: $(cat /etc/drumee/conf.d/caddy.json 2>/dev/null | tr -d '\n ')"
echo "creds-mode: $(stat -c %a /etc/drumee/credential/caddy-dns.env 2>/dev/null)"
echo "creds-has-token: $(grep -c 'DRUMEE_CADDY_DNS_TOKEN=tok-bridge-probe-123' /etc/drumee/credential/caddy-dns.env 2>/dev/null)"
cat /var/log/drumee/bridge.env 2>/dev/null
INNER
)"
echo "$out" | sed 's/^/    /'

env="$(echo "$out" | sed -n '/----RECORDED-ENV----/,/----RECORDED-ENV-API----/p')"
echo "$env" | grep -q "DRUMEE_DOMAIN_NAME=$DOMAIN"          && ok "preseeded domain reached bin/install env"        || no "domain did not bridge"
echo "$env" | grep -q "ADMIN_EMAIL=$ADMIN"                  && ok "admin email bridged"                              || no "admin email did not bridge"
echo "$env" | grep -q "ACME_EMAIL_ACCOUNT=$ADMIN"           && ok "acme email bridged (defaulted to admin)"          || no "acme email did not bridge"
echo "$env" | grep -q "DRUMEE_DB_DIR=/srv/db-probe"         && ok "db_dir bridged"                                   || no "db_dir did not bridge"
echo "$env" | grep -q "DRUMEE_DATA_DIR=/data-probe"         && ok "data_dir bridged"                                 || no "data_dir did not bridge"
# Default TLS method: local DNS server, so neither TLS variable is set.
echo "$env" | grep -q "^ACME_ENV_FILE=$"                    && ok "default TLS leaves ACME_ENV_FILE unset (BIND9 path)" || no "default TLS should not set ACME_ENV_FILE"
echo "$env" | grep -q "^OWN_SSL=$"                          && ok "default TLS leaves OWN_SSL unset"                 || no "default TLS should not set OWN_SSL"

api_env="$(echo "$out" | sed -n '/----RECORDED-ENV-API----/,/----POSTINST-WARNING----/p')"
echo "$api_env" | grep -q "ACME_ENV_FILE=$CREDS"            && ok "dns-api credentials path bridged to ACME_ENV_FILE" || no "ACME_ENV_FILE did not bridge"

warn_out="$(echo "$out" | sed -n '/----POSTINST-WARNING----/,/----RECORDED-ENV-MISSING----/p')"
echo "$warn_out" | grep -qi "not found\|falling back"       && ok "missing credentials file is reported"             || no "missing credentials file passed silently"
missing_env="$(echo "$out" | sed -n '/----RECORDED-ENV-MISSING----/,/----CADDY-ABSENT----/p')"
echo "$missing_env" | grep -q "^ACME_ENV_FILE=$"            && ok "missing credentials file blanks ACME_ENV_FILE"    || no "ACME_ENV_FILE should be blank when the file is absent"

# Caddy without the package: refuse, and above all do not move nginx off 80/443.
absent="$(echo "$out" | sed -n '/----CADDY-ABSENT----/,/----CADDY-PRESENT----/p')"
echo "$absent" | grep -qi "no Caddy binary\|Keeping nginx"  && ok "caddy without the package is refused"             || no "caddy without the package passed silently"
echo "$absent" | grep -q "caddy.json exists: no"            && ok "no caddy.json written when unavailable"           || no "caddy.json written even though Caddy is absent"
echo "$absent" | grep -q "^DRUMEE_HTTP_PORT=$"              && ok "nginx keeps 80/443 when Caddy is unavailable"     || no "nginx ports moved with no Caddy to take them"

# Caddy with the binary present: config written, secret 0600, nginx moved.
present="$(echo "$out" | sed -n '/----CADDY-PRESENT----/,$p')"
echo "$present" | grep -qi "Caddy will terminate"           && ok "caddy path configures when the binary exists"     || no "caddy path did not configure"
echo "$present" | grep -q '"dns_provider":"ovh"'            && ok "provider reached conf.d/caddy.json"               || no "provider missing from caddy.json"
echo "$present" | grep -q "\"domain\":\"$DOMAIN\""          && ok "domain reached conf.d/caddy.json"                 || no "domain missing from caddy.json"
echo "$present" | grep -q '"upstream_http_port":8080'       && ok "caddy.json names the internal nginx port"          || no "caddy.json upstream port wrong"
echo "$present" | grep -q "creds-mode: 600"                 && ok "DNS token file is 0600"                            || no "DNS token file has wrong mode"
echo "$present" | grep -q "creds-has-token: 1"              && ok "preseeded DNS token reached the credentials file"  || no "DNS token did not reach the credentials file"
echo "$present" | grep -q "^DRUMEE_HTTP_PORT=8080"          && ok "nginx moved to an internal port for Caddy"         || no "nginx did not move off 80"
echo "$present" | grep -q "^OWN_SSL=/etc/drumee/certs"      && ok "acme.sh suppressed (certs come from Caddy)"        || no "acme.sh would still run alongside Caddy"

printf '\n\033[1m== debconf-bridge verify: %d passed, %d failed ==\033[0m\n' "$pass" "$fail"
[ "$fail" = 0 ]
