#!/bin/bash
# Seed builder — produces schemas' var/tmp/drumee/seeds.tgz (a mariabackup
# physical snapshot) entirely offline, inside one throwaway container.
#
# This is the containerised rework of schemas/make-seed.sh point #3. The flow the
# native .deb build expects:
#   1. a local MariaDB (started here) with the base databases loaded from the
#      schemas repo's templates/factory/seed/*.sql,
#   2. the entity pool STOCKED via server-team's offline/factory (so the seed
#      never ships an empty pool -> the postinst EMPTY_FACTORY guard, gap #2),
#   3. a mariabackup --backup + --prepare, tar'd in the exact layout that
#      setup-schemas/bin/install consumes (tar --one-top-level=seeds ->
#      mariabackup --copy-back --target-dir=.../seeds).
#
# Steps 1-2 REUSE the proven container assets verbatim (schemas-init.sh +
# container-populate.js, which already drives offline/factory/schema.js and the
# genesis templates) — just pointed at a local loopback MariaDB instead of the
# compose 'mariadb' service. Step 3 mirrors schemas/src/schemas/bin/build-seeds.
#
# Source trees are bind-mounted read-only (see scripts/build-seed.sh):
#   /src/server-main   server-team  (offline/factory + @drumee node_modules)
#   /src/setup-schemas setup-schemas(lib/organization + its node_modules)
#   /src/schemas       schemas      (templates/factory + schema/patch corpus)
#   /out               host output directory (seeds.tgz lands here)
set -euo pipefail

# --- knobs (overridable via `docker run -e`) --------------------------------
DB_PORT="${DB_PORT:-3306}"
DB_ROOT_PASSWORD="${DB_ROOT_PASSWORD:-seedroot}"
DB_USER="${DB_USER:-drumee-app}"
DB_PASSWORD="${DB_PASSWORD:-seedapp}"
DRUMEE_DOMAIN_NAME="${DRUMEE_DOMAIN_NAME:-localhost}"
POOL_COUNT="${POOL_COUNT:-10}"
DATADIR="${DATADIR:-/var/lib/mysql}"
BACKUP_DIR="${BACKUP_DIR:-/backup}"
OUT_DIR="${OUT_DIR:-/out}"
OUT_FILE="${OUT_FILE:-seeds.tgz}"

SRC_SERVER=/src/server-main
SRC_SETUP=/src/setup-schemas
SRC_SCHEMAS=/src/schemas
FACTORY_DIR="$SRC_SCHEMAS/templates/factory"

for d in "$SRC_SERVER/offline/factory" "$SRC_SETUP/lib" "$FACTORY_DIR/seed"; do
  [ -d "$d" ] || { echo "FATAL: expected mounted source missing: $d" >&2; exit 1; }
done
mkdir -p "$OUT_DIR" "$BACKUP_DIR"

# --- 1. start a local MariaDB on loopback ------------------------------------
echo "==> Initializing throwaway datadir at $DATADIR"
rm -rf "${DATADIR:?}/"* 2>/dev/null || true
mariadb-install-db --user=root --datadir="$DATADIR" \
  --auth-root-authentication-method=normal --skip-test-db >/dev/null

echo "==> Starting mariadbd on 127.0.0.1:$DB_PORT"
mariadbd --user=root --datadir="$DATADIR" \
  --bind-address=127.0.0.1 --port="$DB_PORT" \
  --skip-name-resolve --innodb-buffer-pool-size=256M &
MARIADB_PID=$!
cleanup() { kill "$MARIADB_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  mariadb -uroot --socket=/run/mysqld/mysqld.sock -e 'SELECT 1' >/dev/null 2>&1 && break
  sleep 1
done
mariadb -uroot --socket=/run/mysqld/mysqld.sock -e 'SELECT 1' >/dev/null 2>&1 \
  || { echo "FATAL: mariadbd did not come up" >&2; exit 1; }

# Give root a password over TCP so the reused container scripts (which speak TCP,
# as they do against the compose 'mariadb' service) can connect over loopback.
# mariadb-install-db pre-creates root@'127.0.0.1' / root@'::1' with EMPTY passwords,
# and a loopback TCP connection matches those SPECIFIC accounts before root@'%' —
# so we must set the password on them (CREATE IF NOT EXISTS is a no-op when the
# account already exists, hence the explicit ALTER).
for h in '127.0.0.1' '::1' '%'; do
  mariadb -uroot --socket=/run/mysqld/mysqld.sock <<SQL
CREATE USER IF NOT EXISTS 'root'@'$h' IDENTIFIED BY '$DB_ROOT_PASSWORD';
ALTER USER 'root'@'$h' IDENTIFIED BY '$DB_ROOT_PASSWORD';
GRANT ALL PRIVILEGES ON *.* TO 'root'@'$h' WITH GRANT OPTION;
SQL
done
mariadb -uroot --socket=/run/mysqld/mysqld.sock -e 'FLUSH PRIVILEGES'

# --- redis (Cache.load() in container-populate needs a live Redis) -----------
echo "==> Starting redis on 127.0.0.1"
redis-server --daemonize yes --bind 127.0.0.1 --save '' >/dev/null

# --- 2a. base databases + factory seed (reuse schemas-init.sh) ---------------
echo "==> schemas-init: base DBs from templates/factory/seed + schema patches"
DB_HOST=127.0.0.1 DB_PORT="$DB_PORT" DB_ROOT_PASSWORD="$DB_ROOT_PASSWORD" \
DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
DRUMEE_DOMAIN_NAME="$DRUMEE_DOMAIN_NAME" \
FACTORY_DIR="$FACTORY_DIR" SCHEMAS_DIR="$SRC_SCHEMAS" \
  /usr/local/bin/schemas-init

# --- 2b. populate + stock the entity pool (reuse container-populate.js) -------
# populate-entrypoint materializes /etc/drumee config (db.json/redis.json/
# drumee.json/.my.cnf) then runs the command we pass it. NODE_PATH lets the
# mounted setup-schemas resolve @drumee/* from the mounted server-team tree.
# CREATE_ADMIN is intentionally UNSET: the native install's populate.js creates
# the domain-specific admin/RSA keys at install time; the seed only needs the
# base schema + a stocked pool + the fixed system accounts.
echo "==> container-populate: org.populate + stockFactory (offline/factory) + system accounts"
DB_HOST=127.0.0.1 DB_PORT="$DB_PORT" DB_USER="$DB_USER" DB_PASSWORD="$DB_PASSWORD" \
DRUMEE_DOMAIN_NAME="$DRUMEE_DOMAIN_NAME" DRUMEE_DATA_DIR=/data \
REDIS_HOST=127.0.0.1 REDIS_PORT=6379 \
SS_DIR="$SRC_SETUP" SERVER_MAIN="$SRC_SERVER" GENESIS_DIR="$FACTORY_DIR" \
POOL_COUNT="$POOL_COUNT" \
NODE_PATH="$SRC_SERVER/node_modules:$SRC_SETUP/node_modules" \
  /usr/local/bin/drumee-populate node /usr/local/lib/drumee/container-populate.js

echo "==> Pool status"
mariadb -uroot -p"$DB_ROOT_PASSWORD" -h127.0.0.1 -P"$DB_PORT" -N -B \
  -e "SELECT area, type, COUNT(*) FROM yp.entity GROUP BY area, type" || true

# --- 3. mariabackup -> seeds.tgz (mirrors schemas/bin/build-seeds) ----------
# Pin the collation like build-seeds does, then take a hot physical backup.
collation=$(mariadb -uroot -p"$DB_ROOT_PASSWORD" -h127.0.0.1 -P"$DB_PORT" \
  -e "show variables like 'character_set_collations';" | tail -1 || true)
if [ -n "$collation" ]; then
  mariadb -uroot -p"$DB_ROOT_PASSWORD" -h127.0.0.1 -P"$DB_PORT" \
    -e "set GLOBAL character_set_collations='utf8mb4=utf8mb4_general_ci'" || true
fi

echo "==> mariabackup --backup"
rm -rf "${BACKUP_DIR:?}/"* 2>/dev/null || true
mariabackup --backup --target-dir="$BACKUP_DIR" \
  --datadir="$DATADIR" --user=root --password="$DB_ROOT_PASSWORD" \
  --host=127.0.0.1 --port="$DB_PORT"
echo "==> mariabackup --prepare"
mariabackup --prepare --target-dir="$BACKUP_DIR"

echo "==> Archiving prepared backup -> $OUT_DIR/$OUT_FILE"
# Top-level = prepared backup contents, so setup-schemas/bin/install's
# `tar --one-top-level=seeds` + `mariabackup --copy-back --target-dir=.../seeds`
# restores it correctly.
tar zcfp "$OUT_DIR/$OUT_FILE" -C "$BACKUP_DIR" .

echo "==> Done: $OUT_DIR/$OUT_FILE ($(du -h "$OUT_DIR/$OUT_FILE" | cut -f1))"
