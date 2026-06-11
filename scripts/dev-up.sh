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

node "$root/config/render.mjs" all --config "$W/drumee.yaml" --out-dir "$W" >/dev/null

# Local HTTP Caddyfile (no ACME). /-/svc/* -> REST (service.js); everything else,
# including UI bundles and the WebSocket, -> index.js.
cat > "$W/Caddyfile" <<'CADDY'
:80 {
	handle_path /-/app/* {
		root * /srv/ui/main/app
		file_server
	}
	handle /-/svc/* {
		reverse_proxy server-pod:24000
	}
	reverse_proxy server-pod:23000
}
CADDY

# Provision an admin account so you can log in (prints a password-reset link).
echo "CREATE_ADMIN=${CREATE_ADMIN:-1}" >> "$W/.env"

docker compose -f "$W/docker-compose.yml" --env-file "$W/.env" -p "$PROJECT" up -d

cat <<MSG

Drumee dev stack starting (project: $PROJECT).
  Open:    http://localhost/
  Status:  docker compose -p $PROJECT ps
  Logs:    docker compose -p $PROJECT logs -f server-pod
  Stop:    scripts/dev-down.sh

First start runs schemas-init + ui-build + schemas-populate (one-off) before
server-pod comes up — give it ~60-90s, then refresh.
MSG
