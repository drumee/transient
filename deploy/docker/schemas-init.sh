#!/bin/bash
# Container schema initializer — the DB phase of what setup-schemas/bin/install
# does natively, reconstructed from the schemas repo's factory templates.
#
# Idempotent + run-once: creates the base databases from templates/factory/,
# configures the domain, and creates the privileged application user. Connects
# to the mariadb service over TCP as root (Drumee's own tooling assumes a local
# socket, which isn't available across containers).
#
# Env (from the rendered .env):
#   DB_HOST DB_PORT DB_ROOT_PASSWORD DB_USER DB_PASSWORD DRUMEE_DOMAIN_NAME
set -euo pipefail

DB_HOST="${DB_HOST:-mariadb}"
DB_PORT="${DB_PORT:-3306}"
ROOT_PW="${DB_ROOT_PASSWORD:?DB_ROOT_PASSWORD is required}"
APP_USER="${DB_USER:-drumee-app}"
APP_PW="${DB_PASSWORD:?DB_PASSWORD is required}"
DOMAIN="${DRUMEE_DOMAIN_NAME:-localhost}"
FACTORY="${FACTORY_DIR:-/factory}"

root()  { mariadb --host="$DB_HOST" --port="$DB_PORT" -uroot -p"$ROOT_PW" "$@"; }
# --force keeps loading past statement errors. Needed because the schemas repo's
# bin/make-templates corrupts the 3 trigger headers in seed/yp.sql (a greedy
# DEFINER-stripping sed eats the `TRIGGER <name>`). Without --force the load
# aborts there and yp is left half-built. See docs/schema-init.md.
rootf() { mariadb --force --host="$DB_HOST" --port="$DB_PORT" -uroot -p"$ROOT_PW" "$@"; }

echo "==> Waiting for MariaDB at $DB_HOST:$DB_PORT"
for _ in $(seq 1 60); do
  root -e 'SELECT 1' >/dev/null 2>&1 && break
  sleep 2
done
root -e 'SELECT 1' >/dev/null 2>&1 || { echo "MariaDB not reachable" >&2; exit 1; }

# --- base databases + factory seed (skip if already initialized) ---
if root -e "SHOW TABLES IN yp" 2>/dev/null | grep -q .; then
  echo "==> 'yp' already initialized — skipping schema load"
else
  echo "==> Creating base databases"
  for db in yp utils mailserver template trash; do
    root -e "CREATE DATABASE IF NOT EXISTS \`$db\` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci"
  done
  echo "==> Loading factory seed (data-free schema + system accounts)"
  # --force on yp: tolerate the 3 corrupted trigger headers (upstream make-templates
  # bug); everything else — tables, data, domain, routines, accounts — loads.
  rootf yp        < "$FACTORY/seed/yp.sql"
  root utils      < "$FACTORY/seed/utils.sql"
  root mailserver < "$FACTORY/seed/mailserver.sql"
  root template   < "$FACTORY/seed/template.sql"
  root trash      < "$FACTORY/seed/trash.sql"
  echo "   note: yp quota-maintenance triggers skipped (corrupt in factory dump)"

  echo "==> Configuring main domain (dom_id=1) -> $DOMAIN"
  # The factory seed does NOT insert a domain row (it's environment-specific;
  # setup-schemas inserts it natively). The server requires domain_exists(1), so
  # upsert the id=1 row to the configured domain.
  root yp -e "INSERT INTO domain (id, name) VALUES (1, '$DOMAIN')
              ON DUPLICATE KEY UPDATE name = VALUES(name)"
fi

# --- application user (always reconcile; idempotent) ---
# Broad privileges: the server provisions per-hub/drumate databases at runtime
# (yellow_page/procedures/entity/create.sql runs CREATE DATABASE).
echo "==> Reconciling application user '$APP_USER'"
root -e "CREATE USER IF NOT EXISTS '$APP_USER'@'%' IDENTIFIED BY '$APP_PW';
         ALTER USER '$APP_USER'@'%' IDENTIFIED BY '$APP_PW';
         GRANT ALL PRIVILEGES ON *.* TO '$APP_USER'@'%' WITH GRANT OPTION;
         FLUSH PRIVILEGES;"

echo "==> schemas-init complete"
