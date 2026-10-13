"use strict";

const { routes } = require("./routes");
function address(endpoint) { return `${endpoint.host.includes(":") ? `[${endpoint.host}]` : endpoint.host}:${endpoint.port}`; }
function renderNginx(inputs, effective_domain) {
  const { spec, requirements, adapter_input } = inputs;
  const http = requirements.http;
  const names = [...new Set([effective_domain, ...(spec.http.accepted_hosts || [])])].sort().join(" ");
  const external_port = adapter_input.bindings[0].host_port;
  const authorities = names.split(" ").flatMap((name) => [`    "${name}" 1;`, `    "${name}:${external_port}" 1;`]).join("\n");
  const tls = spec.http.https ? [
    `    ssl_certificate ${adapter_input.tls_views.find((view) => view.ref.resource === spec.tls.certificate_ref.resource && view.ref.key === spec.tls.certificate_ref.key).target};`,
    `    ssl_certificate_key ${adapter_input.tls_views.find((view) => view.ref.resource === spec.tls.private_key_ref.resource && view.ref.key === spec.tls.private_key_ref.key).target};`,
    "    ssl_protocols TLSv1.2 TLSv1.3;"
  ].join("\n") : "";
  return `# Drumee Infra Layer IL-1. Generated; no activation is performed by rendering.
worker_processes 1;
pid /tmp/nginx.pid;
error_log /dev/stderr crit;
events { worker_connections 256; }
http {
  include /etc/nginx/mime.types;
  default_type application/octet-stream;
  server_tokens off;
  map $uri $infra_log_path {
    default $uri;
    ~^${http.internal_artifact_prefix} "[protected-artifact]";
  }
  log_format infra_safe '$remote_addr $request_method $infra_log_path $status';
  access_log /dev/stdout infra_safe;
  sendfile on;
  autoindex off;
  client_body_temp_path /tmp/client_body;
  proxy_temp_path /tmp/proxy;
  fastcgi_temp_path /tmp/fastcgi;
  uwsgi_temp_path /tmp/uwsgi;
  scgi_temp_path /tmp/scgi;
  client_body_buffer_size 16k;
  client_body_timeout ${adapter_input.timeouts.client_body_seconds}s;
  send_timeout ${adapter_input.timeouts.send_seconds}s;
  proxy_connect_timeout ${adapter_input.timeouts.upstream_seconds}s;
  map $http_upgrade $connection_upgrade { default upgrade; '' close; }
  map $server_port $infra_external_port { default ${external_port}; }
  map $http_host $infra_authority_valid {
    default 0;
${authorities}
  }
  upstream kernel_service { server ${address(http.service_endpoint)}; }
  upstream kernel_page { server ${address(http.page_endpoint)}; }
  upstream kernel_websocket { server ${address(http.websocket_endpoint)}; }
  server {
    listen ${adapter_input.listen_port}${spec.http.https ? " ssl" : ""} default_server;
    server_name _;
${tls}
    return 404;
  }
  server {
    listen 127.0.0.1:${adapter_input.health_port};
    server_name localhost;
    location = /__infra_ready { proxy_pass http://kernel_page${http.readiness_path}; }
    location / { return 404; }
  }
  server {
    listen ${adapter_input.listen_port}${spec.http.https ? " ssl" : ""};
    server_name ${names};
${tls}
    client_max_body_size 65536;
    if ($infra_authority_valid = 0) { return 404; }
    add_header X-Content-Type-Options nosniff always;
    # Reject dot segments before normalization, double-encoded separators and backslashes.
    # The value is original request URI; query data is left to the kernel.
    if ($request_uri ~* "^[^?]*(\\.\\.|%2e|%25(?:2e|2f|5c)|%5c|\\\\\\\\)") { return 400; }
${routes(inputs)}
  }
}
`;
}
module.exports = { renderNginx };
