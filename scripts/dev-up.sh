#!/bin/bash
# Bring up a LOCAL Drumee stack from the locally-built images and keep it running,
# so you can open it in a browser. Pairs with scripts/dev-down.sh.
#
#   scripts/dev-up.sh            # render + up -d, prints the URL
#   scripts/dev-down.sh          # stop + remove (and volumes)
#
# Uses the images built by scripts/build-images-local.sh (tag: local).
set -uo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
W="${DRUMEE_DEV_DIR:-$HOME/.drumee-dev}"
PROJECT=drumee-dev
mkdir -p "$W/db" "$W/data"

cat > "$W/drumee.yaml" <<YAML
instance:
  description: Drumee Dev
  domain: localhost
  local_mode: true
  admin_email: admin@example.com
tls:
  mode: self-signed
storage:
  data_dir: $W/data
  db_dir: $W/db
database:
  host: mariadb
redis:
  host: redis
versions:
  server: local
  ui: local
  schemas: local
  static: local
YAML

# render.mjs writes .env, docker-compose.yml, install.conf, and the Caddyfile.
# domain=localhost -> the Caddyfile is plain HTTP on :80 (no ACME).
node "$root/config/render.mjs" all --config "$W/drumee.yaml" --out-dir "$W" >/dev/null

# Provision an admin account so you can log in. ADMIN_PASSWORD (if set) is used;
# otherwise schemas-populate generates one and prints it (no SMTP needed).
echo "CREATE_ADMIN=${CREATE_ADMIN:-1}" >> "$W/.env"
[ -n "${ADMIN_PASSWORD:-}" ] && echo "ADMIN_PASSWORD=${ADMIN_PASSWORD}" >> "$W/.env"

DC="docker compose -f $W/docker-compose.yml --env-file $W/.env -p $PROJECT"
$DC up -d

echo
echo "Drumee dev stack starting (project: $PROJECT)."
echo "  Open:    http://localhost/"
echo "  Status:  docker compose -p $PROJECT ps"
echo "  Logs:    docker compose -p $PROJECT logs -f server-pod"
echo "  Stop:    scripts/dev-down.sh"
echo
echo "Waiting for first-run setup (schemas-init / ui-build / schemas-populate)..."
for _ in $(seq 1 60); do
  st=$($DC ps -a --format '{{.Service}}:{{.State}}:{{.ExitCode}}' 2>/dev/null | grep '^schemas-populate:' || true)
  echo "$st" | grep -q 'exited:0' && break
  echo "$st" | grep -qE 'exited:[1-9]' && { echo "  schemas-populate failed — see: docker compose -p $PROJECT logs schemas-populate"; break; }
  sleep 5
done
echo
echo "================ LOGIN ================"
$DC logs schemas-populate 2>/dev/null | grep -aA3 'ADMIN LOGIN' | grep -aE 'email:|password:' | sed 's/^[^ ]*[ ]*|//'
echo "  URL:       http://localhost/   (give server-pod a few more seconds)"
echo "======================================"
