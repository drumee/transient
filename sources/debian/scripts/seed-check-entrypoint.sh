#!/bin/bash
# Restore a built seed and hand the user an interactive MariaDB.
#
# Mirrors setup-schemas/bin/install's restore path so what you inspect here is
# exactly what a freshly-installed native system would contain:
#   tar --one-top-level=seeds  ->  mariabackup --copy-back --target-dir=.../seeds
# then starts mariadbd on the restored datadir and execs the container command
# (default: an interactive login shell with the `mariadb` client pre-wired).
#
# The seed archive is bind-mounted read-only (see scripts/check-seed.sh):
#   /seed/seeds.tgz    the mariabackup snapshot to inspect  (override: SEED_FILE)
set -euo pipefail

SEED_FILE="${SEED_FILE:-/seed/seeds.tgz}"
DATADIR="${DATADIR:-/var/lib/mysql}"
RESTORE_DIR="${RESTORE_DIR:-/restore/seeds}"
DB_PORT="${DB_PORT:-3306}"

say() { printf '\033[1;36m==>\033[0m %s\n' "$*"; }

[ -f "$SEED_FILE" ] || {
  echo "FATAL: seed archive not found at $SEED_FILE" >&2
  echo "       bind-mount it read-only, e.g. -v /path/seeds.tgz:/seed/seeds.tgz:ro" >&2
  exit 1; }

# --- restore the mariabackup snapshot into a fresh datadir -------------------
say "Extracting $SEED_FILE -> $RESTORE_DIR"
rm -rf "${RESTORE_DIR:?}" "${DATADIR:?}"/* 2>/dev/null || true
mkdir -p "$RESTORE_DIR" "$DATADIR"
# seeds.tgz top-level = prepared-backup contents (built with `tar -C "$BACKUP" .`),
# so extract into a dir named `seeds` — the layout mariabackup --copy-back wants.
tar xzf "$SEED_FILE" -C "$RESTORE_DIR"

say "mariabackup --copy-back -> $DATADIR"
mariabackup --copy-back --target-dir="$RESTORE_DIR" --datadir="$DATADIR"
chown -R mysql:mysql "$DATADIR"

# --- start mariadbd on the restored datadir ----------------------------------
say "Starting mariadbd (socket /run/mysqld/mysqld.sock, 127.0.0.1:$DB_PORT)"
mariadbd --user=mysql --datadir="$DATADIR" \
  --bind-address=127.0.0.1 --port="$DB_PORT" \
  --skip-name-resolve --innodb-buffer-pool-size=256M >/var/log/mariadbd.log 2>&1 &
MARIADB_PID=$!
cleanup() { kill "$MARIADB_PID" 2>/dev/null || true; }
trap cleanup EXIT

for _ in $(seq 1 60); do
  mariadb --socket=/run/mysqld/mysqld.sock -e 'SELECT 1' >/dev/null 2>&1 && break
  kill -0 "$MARIADB_PID" 2>/dev/null || { echo "FATAL: mariadbd died — see /var/log/mariadbd.log" >&2; tail -20 /var/log/mariadbd.log >&2; exit 1; }
  sleep 1
done
mariadb --socket=/run/mysqld/mysqld.sock -e 'SELECT 1' >/dev/null 2>&1 \
  || { echo "FATAL: mariadbd did not come up — see /var/log/mariadbd.log" >&2; tail -20 /var/log/mariadbd.log >&2; exit 1; }

# The seed carries its own accounts/grants; connect over the local socket as the
# restored root (no auth needed via unix_socket / empty local root). Pre-wire the
# client so `mariadb` "just works" for the interactive user.
cat >/root/.my.cnf <<'CNF'
[client]
socket = /run/mysqld/mysqld.sock
CNF
chmod 600 /root/.my.cnf

# --- quick sanity summary + hand over ----------------------------------------
say "Restored databases:"
mariadb -N -B -e 'SHOW DATABASES' | sed 's/^/    /' || true
say "Entity pool (yp.entity by area,type):"
mariadb -N -B -e 'SELECT area, type, COUNT(*) FROM yp.entity GROUP BY area, type' 2>/dev/null \
  | sed 's/^/    /' || echo "    (yp.entity not present)"

cat <<'BANNER'

  Seed restored and MariaDB is running. You are in a throwaway container.
  Run any MariaDB commands, e.g.:
      mariadb                                  # interactive client
      mariadb -e 'SHOW DATABASES'
      mariadb yp -e 'SELECT COUNT(*) FROM entity'
      mariadb-dump --all-databases | less
  The datadir is a restored COPY of the seed; nothing you change here is
  persisted. Exit the shell to stop and remove the container.

BANNER

exec "$@"
