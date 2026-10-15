"use strict";
const path = require("node:path");
const infra = require("@drumee/infra-layer");
const lifecycle = require("@drumee/infra-layer/lifecycle");
const node_image = "node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392";
const images = {
  node: node_image,
  database: "mariadb@sha256:611a2fcc5fa7c6ceb8644c6f74b25ede004ff6c3a6b38c8f8c23d3bbf6c26430",
  redis: "redis@sha256:ff02b58f971e7d7d156a1267e283fcbbeee91773b6aa36c49dac28ecfe28eadf",
  nginx: "nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752"
};
function compose({ root, project, image, tools_image, https_port, dns_port, address = "127.0.0.1", lan_address = "192.168.5.202", instance_id = "il3-kernel-acceptance", source_revision }) {
  const uid = process.getuid(), gid = process.getgid(), ref = (resource, key) => ({ resource, key });
  const keys = { admin: ref("database", "admin"), database: ref("database", "service"), redis: ref("redis", "auth"), ca: ref("tls", "ca-key"), leaf: ref("tls", "leaf-key"), certificate: ref("tls", "certificate"), bundle: ref("tls", "ca-certificate") };
  const durable = name => path.join(root, "durable", name);
  const public_root = durable("public"), content = durable("content"), acceptance = durable("acceptance");
  const tool = (data_source, listen_port) => ({ image: tools_image, uid, gid, data_source, listen_port, bindings: [] });
  const secrets = [
    [keys.admin, "database-admin", ["database"]],
    [keys.database, "database-service", ["database-client"]],
    [keys.redis, "redis-auth", ["redis", "kernel"]],
    [keys.ca, "tls-ca-key", ["tls-issuer"]],
    [keys.leaf, "tls-leaf-key", ["gateway", "tls-issuer"]]
  ].map(([ref, type, consumers]) => ({ ref, type, consumers: consumers.sort() }));
  const spec = {
    contract_version: "2", instance: { id: instance_id, domain: "drumee.lan" },
    http: { enabled: true, https: true },
    dns: { mode: "local", ipv4: lan_address, serial: 1, clients: ["127.0.0.0/8", "172.16.0.0/12", "192.168.5.0/24"], listen: ["0.0.0.0"], recursion: false, state_resource: "dns-state" },
    tls: { provider: "local", certificate_ref: keys.certificate, private_key_ref: keys.leaf, ca_key_ref: keys.ca, ca_bundle_ref: keys.bundle, state_resource: "tls-state", leaf_days: 30, renew_before_days: 10 },
    database: { mode: "managed", endpoint: { host: "database", port: 3306, transport: "tcp" }, engine_series: "11.4", admin_secret_ref: keys.admin, service_secret_ref: keys.database, service_user: "infra_client", state_resource: "database-state", initialize: true },
    redis: { mode: "managed", endpoint: { host: "redis", port: 6379, transport: "tcp" }, auth_secret_ref: keys.redis, persistence: "ephemeral" },
    secrets: { store_resource: "infrastructure-secrets", resources: secrets }
  };
  const requirements = { contract_version: "2", capabilities: ["http-gateway", "tls", "dns", "database", "redis"], http: {
    service_endpoint: { host: "kernel", port: 3101, transport: "tcp" }, page_endpoint: { host: "kernel", port: 3102, transport: "tcp" }, websocket_endpoint: { host: "kernel", port: 3101, transport: "tcp" },
    public_assets: [{ id: "plugins", url_prefix: "/-/plugins/", root: "/public/plugins" }], delegated_artifact_root: "/content", internal_artifact_prefix: "/__drumee_artifacts/", max_binary_chunk_bytes: 1024 * 1024, readiness_path: "/__ready", bootstrap_paths: ["/bootstrap.js"]
  } };
  const gateway = {
    kind: "docker-nginx", project, network: project + "-kernel", image: images.nginx, listen_port: 8080, health_port: 9180, bindings: [{ host_address: address, host_port: https_port }],
    artifact_view: { source: content, target: "/srv/protected", kernel_target: "/content" }, public_views: [{ id: "plugins", source: path.join(public_root, "plugins"), target: "/srv/public/plugins" }],
    tls_views: [{ ref: keys.certificate, source: root + "/logical/certificate", target: "/run/secrets/tls-certificate" }, { ref: keys.leaf, source: root + "/logical/key", target: "/run/secrets/tls-private-key" }],
    tmpfs_bytes: 32 * 1024 * 1024, timeouts: { client_body_seconds: 5, upstream_seconds: 30, websocket_seconds: 90, send_seconds: 10 }
  };
  const adapter_input = { kind: "docker-services", project, network: project + "-kernel", gateway, services: {
    dns: { ...tool(durable("dns"), 1053), bindings: [{ host_address: address, host_port: dns_port, protocol: "udp" }, { host_address: address, host_port: dns_port, protocol: "tcp" }] },
    database: { ...tool(durable("database"), 3306), image: images.database, uid: 0, gid: 0 },
    redis: { image: images.redis, uid, gid, listen_port: 6379, bindings: [] }
  }, resource_sources: [keys.admin, keys.redis].map(ref => ({ ref, source: root + "/logical/" + ref.resource + "-" + ref.key })) };
  const plan = infra.planInfrastructure(spec, requirements, adapter_input);
  if (!plan.applicable) throw Object.assign(Error("FIXTURE_PLAN_REJECTED"), { diagnostics: plan.diagnostics });
  const mount = (resource, target, read_only) => ({ resource, target, read_only });
  const database_secret = { ref: keys.database, consumer: "database-client", target: "/run/infra/database", format: "raw" };
  const job = { id: "kernel-init", image, uid, gid, command: ["lib/initialize.js", "install"], entrypoint: ["node"], requires: ["database", "redis"], mounts: [mount("acceptance", "/acceptance", false)], secret_mounts: [database_secret], effect: "idempotent", artifact_revision: source_revision, validation_command: ["node", "lib/initialize.js", "validate"] };
  const distribution = {
    contract_version: "1", id: "approved-minimal-kernel-il3", profile: "kernel", helper_image: node_image, external_writers: "none", init_jobs: [job],
    persistent_resources: [ ["content", content], ["public", public_root], ["acceptance", acceptance] ].map(([id, source]) => ({ id, source, uid, gid, backup_required: true })),
    schema_versions: { runtime: "phase4.5-runtime-schema-1", platform: "git-5469b48109dbb20eacbbc9314a6772264b388843", hub: "git-5469b48109dbb20eacbbc9314a6772264b388843", mfs: "phase4.8-system-mfs-2" },
    provenance: { repository: "https://github.com/drumee/transient", revision: source_revision, path: "target/distributions/minimal-kernel-il3", acceptance: "real-kernel" },
    kernel: { id: "kernel", image, uid, gid, entrypoint: ["node"], command: ["lib/host.js"], mounts: [mount("content", "/content", false), mount("public", "/public", true)], secret_mounts: [database_secret, { ref: keys.redis, consumer: "kernel", target: "/run/infra/redis-config.json", format: "redis-client-config" }], requires: ["database", "redis", job.id], listener_ports: [3101, 3102], healthcheck: { test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3102/__ready').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"], interval: "2s", timeout: "3s", retries: 30 } }
  };
  return lifecycle.composeDeployment(plan, distribution);
}
module.exports = { compose, images };
