#!/bin/bash
# Generate a minimal base seeds.tgz (mariabackup physical backup of the empty
# Drumee schema) for drumee-schemas to build/install. With the populate.js
# stockFactory fix, the seed only needs the BASE schema — the factory pool is
# stocked at install time — so this loads the data-free factory SQL and backs it up.
#
# Runs entirely inside a debian:12 container so the backup matches the install
# target's MariaDB version (physical backups are version-sensitive). Host untouched.
#
#   tests/native/make-seed.sh                 # -> schemas/var/tmp/drumee/seeds.tgz
#   OUT=/path/seeds.tgz tests/native/make-seed.sh
#
# Source of the schema SQL: the schemas repo's templates/factory/seed/*.sql
# (defaults to ~/schemas; override with SCHEMAS_SRC).
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCHEMAS_SRC="${SCHEMAS_SRC:-$HOME/schemas}"
OUT="${OUT:-$root/schemas/var/tmp/drumee/seeds.tgz}"

command -v docker >/dev/null 2>&1 && docker info >/dev/null 2>&1 || { echo "error: docker unavailable" >&2; exit 1; }
seeddir="$SCHEMAS_SRC/templates/factory/seed"
[ -d "$seeddir" ] || { echo "error: factory seed SQL not found at $seeddir (set SCHEMAS_SRC)" >&2; exit 1; }
echo "==> seed SQL: $seeddir"
ls "$seeddir"/*.sql | sed 's#.*/#   #'

mkdir -p "$(dirname "$OUT")"
tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT

docker run --rm -i -v "$seeddir":/seed:ro -v "$tmp":/out debian:12 bash -s <<'INNER'
set -e
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq >/dev/null
apt-get install -y -qq mariadb-server mariadb-backup >/dev/null
echo "MariaDB: $(mariadbd --version 2>/dev/null || mysqld --version)"

DATADIR=/var/lib/mysql-seed; SOCK=/run/mysqld/seed.sock
rm -rf "$DATADIR"; mkdir -p "$DATADIR" /run/mysqld
chown -R mysql:mysql "$DATADIR" /run/mysqld
mariadb-install-db --user=mysql --datadir="$DATADIR" --auth-root-authentication-method=normal >/dev/null 2>&1

SERVER="$(command -v mariadbd || command -v mysqld)"
setpriv --reuid=mysql --regid=mysql --clear-groups "$SERVER" \
  --datadir="$DATADIR" --socket="$SOCK" --skip-networking >/tmp/mysqld.log 2>&1 &
for _ in $(seq 1 60); do mariadb --socket="$SOCK" -e 'SELECT 1' >/dev/null 2>&1 && break; sleep 0.5; done
mariadb --socket="$SOCK" -e 'SELECT 1' >/dev/null 2>&1 || { echo "mariadb did not start"; tail -20 /tmp/mysqld.log; exit 1; }

# Create the base DBs and load the data-free schema. yp.sql carries 3 triggers
# corrupted by upstream make-templates (greedy sed); --force skips them (non-fatal,
# quota maintenance) — same as the container schemas-init. The factory pool is
# NOT loaded here; populate.js stockFactory fills it at install time.
for f in /seed/*.sql; do
  db="$(basename "$f" .sql)"
  echo "   loading $db"
  mariadb --socket="$SOCK" -e "CREATE DATABASE IF NOT EXISTS \`$db\`"
  mariadb --socket="$SOCK" --force "$db" < "$f" 2>/dev/null || true
done
echo "   DBs: $(mariadb --socket="$SOCK" -N -e 'SHOW DATABASES' | tr '\n' ' ')"

echo "==> mariabackup"
BK=/tmp/backup; rm -rf "$BK"; mkdir -p "$BK"
mariabackup --backup --target-dir="$BK" --datadir="$DATADIR" --socket="$SOCK" --user=root >/tmp/bk.log 2>&1 \
  || { echo "backup failed"; tail -20 /tmp/bk.log; exit 1; }
mariabackup --prepare --target-dir="$BK" >>/tmp/bk.log 2>&1 || { echo "prepare failed"; tail -20 /tmp/bk.log; exit 1; }

mariadb --socket="$SOCK" -e 'SHUTDOWN' 2>/dev/null || true
echo "==> archiving"
tar zcfp /out/seeds.tgz -C "$BK" .
echo "   seed bytes: $(stat -c %s /out/seeds.tgz)"
INNER
rc=$?
[ "$rc" = 0 ] && [ -f "$tmp/seeds.tgz" ] || { echo "error: seed generation failed (rc=$rc)" >&2; exit 1; }
cp "$tmp/seeds.tgz" "$OUT"
echo "==> wrote $OUT ($(stat -c %s "$OUT") bytes)"
echo "    schemas/build.sh will use it directly (skips its own seed step)."
