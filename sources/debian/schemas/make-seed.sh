#!/bin/bash
# Generate a MINIMAL bootstrap seed (empty-but-valid MariaDB physical backup)
# so that drumee-schemas can be built and installed without any proprietary
# seed data. This is what makes a fresh, outsider self-host possible.
#
# PREFERRED: scripts/build-seed.sh produces a FULL seed (base schema + a stocked
# entity pool via server-team's offline/factory) in a throwaway Docker MariaDB —
# schemas/build.sh invokes it automatically when no seed/SEEDS_DIR is present.
# This script remains the no-Docker fallback (needs a schema DDL dump).
#
#   schemas/make-seed.sh --out=schemas/var/tmp/drumee/seeds.tgz [--schema-sql=FILE]
#
# The seed produced by schemas/bin/install is a `mariabackup` physical backup,
# NOT a SQL dump — so this script spins up a throwaway MariaDB, applies the
# schema DDL, takes a mariabackup, and archives it in the same layout.
#
# Requirements (checked below): mariadbd/mysqld, mariabackup, mariadb client.
#
# STATUS: scaffold. The canonical schema source is now known — the `schemas` repo
# ships it data-free under templates/factory/ (seed/{yp,utils,mailserver,trash}.sql
# + {hub,drumate}.sql) and already provides bin/build-seeds (mariabackup). Prefer
# that flow: create the base DBs from the factory SQL, then run the repo's
# bin/build-seeds. Pass --schema-sql to point at a concatenated factory dump, or
# use the schemas repo directly. See docs/schema-init.md.

set -euo pipefail

OUT=""
SCHEMA_SQL=""
DB_NAME="${DB_NAME:-drumee}"
for arg in "$@"; do
  case $arg in
    --out=*)        OUT="${arg#*=}" ;;
    --schema-sql=*) SCHEMA_SQL="${arg#*=}" ;;
    --db=*)         DB_NAME="${arg#*=}" ;;
    *) echo "unknown argument: $arg" >&2; exit 2 ;;
  esac
done

[ -n "$OUT" ] || { echo "error: --out=PATH is required" >&2; exit 2; }

need() { command -v "$1" >/dev/null 2>&1 || { echo "error: missing required tool '$1'" >&2; MISSING=1; }; }
MISSING=0
need mariadb-install-db
need mariabackup
need mariadbd || need mysqld
[ "$MISSING" = 0 ] || {
  echo "Install mariadb-server + mariadb-backup, then retry." >&2
  exit 1
}

if [ -z "$SCHEMA_SQL" ]; then
  # TODO(project decision): point this at the canonical DDL the `schemas` repo
  # produces. Until that exists, require it explicitly so we never ship a seed
  # built from an unknown/guessed schema.
  echo "error: --schema-sql=FILE is required (path to the schema DDL dump)." >&2
  echo "       See docs/reproducible-builds.md for how to obtain it." >&2
  exit 1
fi
[ -f "$SCHEMA_SQL" ] || { echo "error: schema SQL not found: $SCHEMA_SQL" >&2; exit 1; }

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
DATADIR="$WORK/data"
BACKUP="$WORK/backup"
SOCKET="$WORK/mysqld.sock"
mkdir -p "$DATADIR" "$BACKUP"

echo "==> Initializing throwaway datadir"
mariadb-install-db --datadir="$DATADIR" --auth-root-authentication-method=normal >/dev/null

echo "==> Starting temporary mariadbd"
SERVER_BIN="$(command -v mariadbd || command -v mysqld)"
"$SERVER_BIN" --datadir="$DATADIR" --socket="$SOCKET" --skip-networking &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null; rm -rf "$WORK"' EXIT
for _ in $(seq 1 30); do
  mariadb --socket="$SOCKET" -e 'SELECT 1' >/dev/null 2>&1 && break
  sleep 0.5
done

echo "==> Creating database '$DB_NAME' and applying schema"
mariadb --socket="$SOCKET" -e "CREATE DATABASE IF NOT EXISTS \`$DB_NAME\`"
mariadb --socket="$SOCKET" "$DB_NAME" < "$SCHEMA_SQL"

echo "==> Taking mariabackup"
mariabackup --backup --target-dir="$BACKUP" --datadir="$DATADIR" --socket="$SOCKET"
mariabackup --prepare --target-dir="$BACKUP"

echo "==> Archiving seed to $OUT"
mkdir -p "$(dirname "$OUT")"
tar zcfp "$OUT" -C "$BACKUP" .

echo "Done. Minimal bootstrap seed written to $OUT"
