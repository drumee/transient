"use strict";

function inputs(root = "/tmp/drumee-il1-fixture", host_port = 29871) {
  return {
    spec: { contract_version: "1", instance: { id: "il1-test", domain: "kernel.test" }, dns: { mode: "none" }, http: { enabled: true, https: false } },
    requirements: {
      contract_version: "1",
      http: {
        service_endpoint: { host: "kernel", port: 3101, transport: "tcp" },
        page_endpoint: { host: "kernel", port: 3102, transport: "tcp" },
        websocket_endpoint: { host: "kernel", port: 3102, transport: "tcp" },
        public_assets: [{ id: "app", url_prefix: "/-/app/", root: "/fixture/public/app" }, { id: "plugins", url_prefix: "/-/plugins/", root: "/fixture/public/plugins" }, { id: "static", url_prefix: "/-/static/", root: "/fixture/public/static" }],
        delegated_artifact_root: "/fixture/artifacts", internal_artifact_prefix: "/__drumee_artifacts/",
        max_binary_chunk_bytes: 1024 * 1024, readiness_path: "/__ready", bootstrap_paths: ["/bootstrap.js"]
      }
    },
    adapter_input: {
      kind: "docker-nginx", project: "drumee-il1-test", network: "drumee-il1-test-kernel",
      image: "nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752",
      listen_port: 8080, health_port: 9180, bindings: [{ host_address: "127.0.0.1", host_port }],
      artifact_view: { source: `${root}/artifacts`, target: "/srv/protected", kernel_target: "/fixture/artifacts" },
      public_views: ["app", "plugins", "static"].map((id) => ({ id, source: `${root}/public/${id}`, target: `/srv/public/${id}` })),
      tmpfs_bytes: 32 * 1024 * 1024,
      timeouts: { client_body_seconds: 5, upstream_seconds: 10, websocket_seconds: 90, send_seconds: 5 }
    }
  };
}
module.exports = { inputs };
