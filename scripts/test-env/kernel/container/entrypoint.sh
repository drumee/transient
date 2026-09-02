#!/usr/bin/env bash
set -euo pipefail

runtime_root=/srv/drumee/runtime
mkdir -p "$runtime_root/plugins/ui/main/ui-runtime" "$runtime_root/ui/main/app"
cp -a /opt/kernel/ui-artifact/. "$runtime_root/plugins/ui/main/ui-runtime/"

config=/runtime/nginx.conf
route=/runtime/generated/etc/drumee/infrastructure/routes/app.conf
test -f "$route"
mkdir -p /runtime/nginx/body /runtime/nginx/proxy /runtime/nginx/fastcgi /runtime/nginx/uwsgi /runtime/nginx/scgi
printf '%s\n' \
  'worker_processes 1;' \
  'error_log /dev/stderr info;' \
  'pid /tmp/nginx.pid;' \
  'events { worker_connections 128; }' \
  'http {' \
  '  include /etc/nginx/mime.types;' \
  '  default_type application/octet-stream;' \
  '  access_log /dev/stdout;' \
  '  client_body_temp_path /runtime/nginx/body;' \
  '  proxy_temp_path /runtime/nginx/proxy;' \
  '  fastcgi_temp_path /runtime/nginx/fastcgi;' \
  '  uwsgi_temp_path /runtime/nginx/uwsgi;' \
  '  scgi_temp_path /runtime/nginx/scgi;' \
  '  server {' \
  "    listen ${KERNEL_HTTP_PORT:-28642};" \
  '    server_name _;' \
  "    include ${route};" \
  '  }' \
  '}' > "$config"

node /opt/kernel/scripts/service.js &
node_pid=$!
trap 'kill "$node_pid" 2>/dev/null || true' EXIT
nginx -t -c "$config"
exec nginx -c "$config" -g 'daemon off;'
