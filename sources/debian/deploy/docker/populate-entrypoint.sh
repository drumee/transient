#!/bin/bash
# Entrypoint for the run-once schemas-populate container. Materializes the
# /etc/drumee config the populate needs (drumee.json + credentials + a TCP client
# config for the factory's mariadb CLI), then runs container-populate.js, which
# stocks the entity pool and creates the system accounts + RSA keypair.
set -euo pipefail

CRED=/etc/drumee/credential
mkdir -p "$CRED/crypto"

# db.json — app user over TCP (no default database; see schema-init.md).
cat > "$CRED/db.json" <<JSON
{ "user": "${DB_USER:-drumee-app}", "host": "${DB_HOST:-mariadb}",
  "port": ${DB_PORT:-3306}, "password": "${DB_PASSWORD:-}" }
JSON

cat > "$CRED/redis.json" <<JSON
{ "redisHost": "${REDIS_HOST:-redis}", "redisPort": ${REDIS_PORT:-6379},
  "redisAuth": $( [ -n "${REDIS_PASSWORD:-}" ] && printf '"%s"' "$REDIS_PASSWORD" || printf 'null' ),
  "liveUpdateChannel": "${LIVE_UPDATE_CHANNEL:-LIVE_UPDATE_CHANNEL}" }
JSON

# email.json (nodemailer shape) so the welcome/butler mail step has credentials.
cat > "$CRED/email.json" <<JSON
{ "host": "${SMTP_HOST:-}", "port": ${SMTP_PORT:-587}, "secure": ${SMTP_SECURE:-false},
  "auth": { "user": "${SMTP_USER:-}", "pass": $( [ -n "${SMTP_PASSWORD:-}" ] && printf '"%s"' "$SMTP_PASSWORD" || printf 'null' ) },
  "rejectUnauthorized": false }
JSON

# drumee.json — what server-essentials sysEnv() reads. system_user=www-data so the
# MFS roots populate creates are owned by the runtime user (server-pod runs as it).
cat > /etc/drumee/drumee.json <<JSON
{ "domain_name": "${DRUMEE_DOMAIN_NAME:-localhost}",
  "domain_desc": "${DRUMEE_DESCRIPTION:-Drumee}",
  "data_dir": "${DRUMEE_DATA_DIR:-/data}",
  "db_user": "${DB_USER:-drumee-app}",
  "system_user": "www-data", "system_group": "www-data",
  "drumee_root": "/srv/drumee", "cache_dir": "/srv/drumee/cache",
  "credential_dir": "/etc/drumee/credential" }
JSON

# ~/.my.cnf — the factory loads templates via `mariadb <db> < file` with NO connection
# args, so without this it would try the (absent) local socket. HOME=/root here.
cat > /root/.my.cnf <<CNF
[client]
host=${DB_HOST:-mariadb}
port=${DB_PORT:-3306}
user=${DB_USER:-drumee-app}
password=${DB_PASSWORD:-}
CNF
chmod 600 /root/.my.cnf "$CRED"/*.json

mkdir -p "${DRUMEE_DATA_DIR:-/data}"
chown -R www-data:www-data /srv/drumee "${DRUMEE_DATA_DIR:-/data}" /etc/drumee 2>/dev/null || true

# USER=drumee-app: create_vfs_root()'s `new Mariadb({user: process.env.USER})` must
# resolve to the app user (the only TCP-granted login).
export USER=drumee-app HOME=/root
# Default: run the one-shot populate. With args (e.g. the factory replenisher
# daemon: `node .../container-factory.js`), exec those instead — same config env.
if [ "$#" -gt 0 ]; then
  exec "$@"
fi
exec node /srv/drumee/runtime/server/main/container-populate.js
