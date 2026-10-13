"use strict";

function proxyHeaders(upgrade = false) {
  return [
    "proxy_http_version 1.1;",
    "proxy_set_header Host $http_host;",
    "proxy_set_header X-Real-IP $remote_addr;",
    "proxy_set_header X-Connecting-IP $remote_addr;",
    "proxy_set_header X-Forwarded-For $remote_addr;",
    "proxy_set_header X-Forwarded-Proto $scheme;",
    "proxy_set_header X-Forwarded-Port $infra_external_port;",
    // RFC Forwarded and proxy routing overrides are untrusted at this direct edge.
    'proxy_set_header Forwarded "";',
    'proxy_set_header X-Forwarded-Host "";',
    'proxy_set_header X-Original-URL "";',
    'proxy_set_header X-Rewrite-URL "";',
    'proxy_set_header X-Accel-Redirect "";',
    `proxy_set_header Connection ${upgrade ? "$connection_upgrade" : '""'};`,
    ...(upgrade ? ["proxy_set_header Upgrade $http_upgrade;"] : []),
    "proxy_next_upstream off;",
    "proxy_intercept_errors off;"
  ];
}
function location(selector, lines) { return `  location ${selector} {\n${lines.map((line) => `    ${line}`).join("\n")}\n  }`; }

function routes({ requirements, adapter_input }) {
  const http = requirements.http;
  const result = [];
  // No broad root or SPA fallback: unknown paths fail closed.
  result.push(location("/", ["return 404;"]));
  for (const page_path of ["/", "/-/", ...http.bootstrap_paths]) result.push(location(`= ${page_path}`, [
    ...proxyHeaders(), "proxy_hide_header X-Accel-Redirect;", "proxy_ignore_headers X-Accel-Redirect;", "proxy_hide_header Cache-Control;", 'add_header Cache-Control "no-store" always;', "proxy_pass http://kernel_page;"
  ]));
  result.push(location("= /__infra_ready", [...proxyHeaders(), "proxy_ignore_headers X-Accel-Redirect;", "proxy_hide_header X-Accel-Redirect;", `proxy_pass http://kernel_page${http.readiness_path};`]));
  const service = [...proxyHeaders(), "proxy_buffering off;", "proxy_request_buffering off;", `proxy_read_timeout ${adapter_input.timeouts.upstream_seconds}s;`, "proxy_pass http://kernel_service;"];
  for (const prefix of ["svc", "service"]) result.push(location(`= /-/${prefix}/mfs-transfer.upload_chunk`, [`client_max_body_size ${http.max_binary_chunk_bytes};`, ...service]));
  result.push(location('~ "^/-/(svc|service)/[a-zA-Z0-9_-]+\\.[a-zA-Z0-9_-]+$"', service));
  result.push(location('~ "^/-/vdo/[a-fA-F0-9]{16}(/[a-fA-F0-9]{16})?/(master\\.m3u8|stream-[0-9]+/playlist\\.m3u8|stream-[0-9]+/segment-[0-9]+\\.ts)$"', service));
  for (const ws_path of ["/-/websocket/", "/-/ws/"]) result.push(location(`= ${ws_path}`, [...proxyHeaders(true), "proxy_buffering off;", "proxy_ignore_headers X-Accel-Redirect;", "proxy_hide_header X-Accel-Redirect;", `proxy_read_timeout ${adapter_input.timeouts.websocket_seconds}s;`, "proxy_pass http://kernel_websocket;"]));
  result.push(location(`^~ ${http.internal_artifact_prefix}`, ["internal;", `alias ${adapter_input.artifact_view.target}/;`, "disable_symlinks on;", "gzip off;", "max_ranges 1;", 'add_header Cache-Control "no-store" always;', "limit_except GET { deny all; }"]));
  for (const asset of http.public_assets) {
    const view = adapter_input.public_views.find((entry) => entry.id === asset.id);
    result.push(location(`^~ ${asset.url_prefix}`, [`alias ${view.target}/;`, "disable_symlinks on;", "autoindex off;", "limit_except GET { deny all; }", 'add_header Cache-Control "public, max-age=3600";']));
  }
  return result.join("\n\n");
}
module.exports = { routes };
