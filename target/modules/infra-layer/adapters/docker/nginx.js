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
// Local Docker inspection only. Targets come from the validated plan, never URLs.
async function observeDockerGateway(deployment) {
  const { execFile } = require("node:child_process");
  const { promisify } = require("node:util");
  const S = require("../../lib/spec");
  const { planInfrastructure } = require("../../lib/plan");
  const fail = (code) => { throw Object.assign(new Error(code), { code }); };
  const http = require("node:http");
  const https = require("node:https");
  if (!S.plainTree(deployment) || !S.record(deployment) || Object.keys(deployment).some((key) => !["id", "desired_revision", "container_id", "plan"].includes(key))
    || !S.identifier(deployment.id) || !/^[a-f0-9]{64}$/.test(deployment.container_id || "") || !deployment.plan?.inputs) fail("INVALID_DEPLOYMENT_DESCRIPTOR");
  const plan = deployment.plan;
  const expected = planInfrastructure(plan.inputs.spec, plan.inputs.requirements, plan.inputs.adapter_input);
  if (!plan.applicable || !expected.applicable || expected.revision !== plan.revision || plan.revision !== deployment.desired_revision
    || S.serialize(expected.artifacts) !== S.serialize(plan.artifacts) || !expected.inputs.spec.http.enabled) fail("INVALID_DEPLOYMENT_DESCRIPTOR");
  const { spec, adapter_input } = expected.inputs;
  const binding = adapter_input.bindings.find((entry) => ["127.0.0.1", "::1", "0.0.0.0", "::"].includes(entry.host_address));
  // This alpha observer supports host-local publication only, not LAN probes.
  if (!binding) fail("INVALID_DEPLOYMENT_DESCRIPTOR");
  const address = ["::", "::1"].includes(binding.host_address) ? "::1" : "127.0.0.1";
  const format = '{"id":{{json .Id}},"running":{{json .State.Running}},"health":{{if .State.Health}}{{json .State.Health.Status}}{{else}}"unknown"{{end}},"owner":{{json (index .Config.Labels "org.drumee.infra.owner")}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"revision":{{json (index .Config.Labels "org.drumee.infra.revision")}},"ports":{{json .NetworkSettings.Ports}}}';
  const { stdout } = await promisify(execFile)("docker", ["--host", "unix:///var/run/docker.sock", "inspect", "--format", format, deployment.container_id], { timeout: 10000, maxBuffer: 65536 });
  const observed = JSON.parse(stdout);
  const result = { running: observed.running === true, health: observed.health, observed_revision: observed.revision, loaded_configuration: { status: "unverified" }, diagnostic_codes: [] };
  const reject = (code) => ({ ...result, http_ready: false, diagnostic_codes: [code] });
  if (observed.id !== deployment.container_id) return reject("DEPLOYMENT_IDENTITY_MISMATCH");
  if (observed.owner !== adapter_input.project || observed.project !== adapter_input.project || observed.service !== "gateway") return reject("DEPLOYMENT_OWNERSHIP_MISMATCH");
  if (observed.revision !== expected.revision) return reject("DEPLOYMENT_REVISION_MISMATCH");
  const ports = observed.ports;
  const published = S.record(ports) && ports[`${adapter_input.listen_port}/tcp`];
  const expected_ports = adapter_input.bindings.map((entry) => `${entry.host_address}:${entry.host_port}`).sort();
  if (!Array.isArray(published) || published.some((entry) => !S.record(entry) || typeof entry.HostIp !== "string" || typeof entry.HostPort !== "string")
    || S.serialize(published.map((entry) => `${entry.HostIp}:${entry.HostPort}`).sort()) !== S.serialize(expected_ports)
    || Object.entries(ports).some(([key, entries]) => key !== `${adapter_input.listen_port}/tcp` && entries?.length)) return reject("DEPLOYMENT_PORT_MISMATCH");
  if (!result.running) return result;
  const probe = await new Promise((resolve) => {
    let request, complete = false;
    const finish = (http_ready, code) => { if (complete) return; complete = true; clearTimeout(deadline); resolve({ http_ready, code }); if (!http_ready) request?.destroy(); };
    const deadline = setTimeout(() => finish(false, "GATEWAY_PROBE_TIMEOUT"), 3000);
    try {
      request = (spec.http.https ? https : http).get({ hostname: address, family: address === "::1" ? 6 : 4, port: binding.host_port, path: "/__infra_ready",
        headers: { Host: `${expected.effective_domain}:${binding.host_port}` }, ...(spec.http.https ? { servername: expected.effective_domain, rejectUnauthorized: true } : {}) }, (response) => {
        if (response.statusCode >= 300 && response.statusCode < 400) { response.destroy(); finish(false, "GATEWAY_PROBE_REDIRECT"); return; }
        let size = 0; response.on("data", (chunk) => { size += chunk.length; if (size > 4096) finish(false, "GATEWAY_PROBE_FAILED"); });
        response.on("end", () => finish(response.statusCode === 200, response.statusCode === 200 ? undefined : "GATEWAY_PROBE_FAILED"));
        response.on("error", () => finish(false, "GATEWAY_PROBE_FAILED"));
      });
      request.once("error", () => finish(false, "GATEWAY_PROBE_FAILED"));
    } catch (_) { finish(false, "GATEWAY_PROBE_FAILED"); }
  });
  return { ...result, http_ready: probe.http_ready, diagnostic_codes: probe.code ? [probe.code] : [] };
}
module.exports = { kind: "docker-nginx", gatewayResources, observe: observeDockerGateway };
