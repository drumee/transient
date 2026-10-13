"use strict";

function gatewayResources(inputs, effective_domain, revision) {
  const { spec, adapter_input } = inputs;
  const mounts = [
    { type: "bind", source: "./nginx.conf", target: "/etc/nginx/nginx.conf", read_only: true, bind: { create_host_path: false } },
    ...[adapter_input.artifact_view, ...adapter_input.public_views, ...(adapter_input.tls_views || [])].map((view) => ({ type: "bind", source: view.source, target: view.target, read_only: true, bind: { create_host_path: false } }))
  ];
  const service = {
    image: adapter_input.image,
    user: "101:101", entrypoint: ["nginx"], command: ["-g", "daemon off;"],
    read_only: true, cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
    networks: ["kernel"], volumes: mounts,
    tmpfs: [`/tmp:rw,noexec,nosuid,size=${adapter_input.tmpfs_bytes},uid=101,gid=101,mode=0700`],
    ports: adapter_input.bindings.map((binding) => ({ target: adapter_input.listen_port, published: String(binding.host_port), host_ip: binding.host_address, protocol: "tcp" })),
    healthcheck: {
      test: ["CMD", "wget", "-q", "-O", "/dev/null", `http://127.0.0.1:${adapter_input.health_port}/__infra_ready`],
      interval: "2s", timeout: "2s", retries: 10, start_period: "2s"
    },
    labels: { "org.drumee.infra.owner": adapter_input.project, "org.drumee.infra.revision": revision },
    stop_grace_period: "15s", mem_limit: "128m", pids_limit: 64
  };
  return { services: { gateway: service }, networks: { kernel: { external: true, name: adapter_input.network } } };
}

// Explicit read-only observation; planning never calls this function.
async function observeDockerGateway(deployment) {
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const http = require("node:http");
  const https = require("node:https");
  if (!deployment || !/^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/.test(deployment.container_id || "")) throw new Error("INVALID_DEPLOYMENT_IDENTIFIER");
  const format = '{"running":{{json .State.Running}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"unknown"{{end}},"revision":{{json (index .Config.Labels "org.drumee.infra.revision")}}}';
  const { stdout } = await promisify(execFile)("docker", ["inspect", "--format", format, deployment.container_id], { timeout: 10000, maxBuffer: 65536 });
  const observed = JSON.parse(stdout);
  let http_ready = false;
  if (deployment.url && deployment.host) {
    const url = new URL(deployment.url);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.pathname !== "/__infra_ready" || url.search) throw new Error("INVALID_DEPLOYMENT_ENDPOINT");
    http_ready = await new Promise((resolve) => {
      const request = (url.protocol === "https:" ? https : http).get(url, { headers: { host: deployment.host }, timeout: 3000 }, (response) => { response.resume(); resolve(response.statusCode === 200); });
      request.once("error", () => resolve(false)); request.once("timeout", () => { request.destroy(); resolve(false); });
    });
  }
  return { running: observed.running, health: observed.health, active_revision: observed.revision, http_ready };
}
module.exports = { kind: "docker-nginx", gatewayResources, observe: observeDockerGateway };
