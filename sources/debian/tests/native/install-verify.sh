#!/bin/bash
# Install the locally-built drumee .debs in a DISPOSABLE privileged debian:12
# container and report how far the native install gets toward serving. The host
# is never touched. Skips drumee-static (no source) and the metapackage; installs
# infra -> schemas -> server -> ui directly via a local apt repo so system deps
# (mariadb/nginx/redis/nodejs/…) resolve.
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || { echo "error: docker unavailable" >&2; exit 1; }

debs=$(find "$root"/{infra,schemas,server,ui}/build -name '*.deb' 2>/dev/null)
[ -n "$debs" ] || { echo "error: no .debs built (run the */build.sh first)" >&2; exit 1; }
echo "==> packages:"; echo "$debs" | sed 's#.*/#   #'

# Stage repo + preseed for the container.
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/repo"; cp $debs "$tmp/repo/"
cat > "$tmp/drumee.yaml" <<YAML
instance:
  description: Native Verify
  domain: local
  local_mode: true
  admin_email: admin@local
tls:
  mode: self-signed
YAML
node "$root/config/render.mjs" debconf --config "$tmp/drumee.yaml" > "$tmp/install.conf" 2>/dev/null || true
# local_mode preseed (domain 'local' triggers the local branch in the wizard/bridge)
grep -q drumee-infra "$tmp/install.conf" 2>/dev/null || echo "drumee-infra drumee-infra/domain string local" > "$tmp/install.conf"

echo "==> launching debian:12 (privileged, for services)…"
docker run --rm -i --privileged -v "$tmp":/in:ro debian:12 bash -s <<'INNER' 2>&1
set -u
export DEBIAN_FRONTEND=noninteractive
log(){ printf '\n\033[1;36m== %s ==\033[0m\n' "$*"; }

log "base tooling + local repo"
apt-get update -qq >/dev/null
apt-get install -y -qq dpkg-dev debconf-utils curl >/dev/null
# Allow service start/stop in this container (Debian's image ships a deny-all
# policy-rc.d; setup-schemas/bin/install needs to start MariaDB).
printf '#!/bin/sh\nexit 0\n' > /usr/sbin/policy-rc.d; chmod +x /usr/sbin/policy-rc.d
cp -r /in/repo /tmp/repo
# Stub drumee-static to satisfy server-pod's Depends (no static source to build).
mkdir -p /tmp/stub/DEBIAN
printf 'Package: drumee-static\nVersion: 1.0.0\nArchitecture: all\nMaintainer: t <t@d>\nDepends: drumee-infra\nDescription: stub static for the install test\n' > /tmp/stub/DEBIAN/control
dpkg-deb -Znone -b /tmp/stub /tmp/repo/drumee-static_stub.deb >/dev/null
( cd /tmp/repo && dpkg-scanpackages -m . > Packages 2>/dev/null )
echo "deb [trusted=yes] file:/tmp/repo ./" > /etc/apt/sources.list.d/drumee.list
apt-get update -qq 2>/dev/null

log "Node 22 (NodeSource) — required by the runtime deps (Debian ships 18)"
curl -fsSL https://deb.nodesource.com/setup_22.x 2>/dev/null | bash - >/dev/null 2>&1
apt-get install -y -qq nodejs >/dev/null 2>&1
echo "  node: $(node --version 2>/dev/null)"

log "preseed debconf"
debconf-set-selections < /in/install.conf || true

log "install drumee-infra (renders config + credentials)"
apt-get install -y drumee-infra 2>&1 | tail -40 || true
echo "  --- setup-infra log (if any) ---"; tail -25 /var/log/drumee/*.log 2>/dev/null | sed 's/^/    /' || echo "    (none)"
echo "  drumee.sh present? $([ -f /etc/drumee/drumee.sh ] && echo yes || echo NO)"
echo "  db.json present?   $([ -f /etc/drumee/credential/db.json ] && echo yes || echo NO)"
echo "  /etc/drumee contents:"; ls -R /etc/drumee 2>/dev/null | head -30 | sed 's/^/    /'

log "install drumee-schemas (DB restore + populate + stockFactory)"
apt-get install -y drumee-schemas 2>&1 | tail -25 || true
# report pool + accounts
[ -f /etc/drumee/drumee.sh ] && . /etc/drumee/drumee.sh 2>/dev/null
echo "  pool entities: $(mariadb -N -B -e "SELECT COUNT(*) FROM yp.entity WHERE area='pool'" 2>/dev/null || echo '?')"
echo "  system acct:   $(mariadb -N -B -e "SELECT COUNT(*) FROM yp.drumate WHERE category='system'" 2>/dev/null || echo '?')"

log "install drumee-server-pod + drumee-ui-pod"
apt-get install -y drumee-server-pod drumee-ui-pod 2>&1 | tail -15 || true

log "start app (init.d -> pm2) + probe"
[ -x /etc/init.d/drumee ] && /etc/init.d/drumee start 2>&1 | tail -5 || echo "  no /etc/init.d/drumee"
sleep 8
echo "  pm2: $(su -s /bin/bash ${DRUMEE_SYSTEM_USER:-www-data} -c 'HOME='"${DRUMEE_SERVER_HOME:-/srv/drumee/runtime/server}"' pm2 ls' 2>/dev/null | grep -cE 'online|main' || echo '?') procs"
echo "  GET :23000  -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:23000/ 2>/dev/null || echo down)"
echo "  GET :80     -> $(curl -s -o /dev/null -w '%{http_code}' http://127.0.0.1:80/ 2>/dev/null || echo down)"

log "summary"
echo "  installed: $(dpkg -l 'drumee-*' 2>/dev/null | grep -c '^ii') drumee packages"
dpkg -l 'drumee-*' 2>/dev/null | grep '^ii' | awk '{print "   "$2" "$3}'
INNER
echo "==> done"
