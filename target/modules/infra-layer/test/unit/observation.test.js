"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const cp = require("node:child_process");
const api = require("../../lib");
const adapter = require("../../adapters/docker/nginx");
const { inputs } = require("../support/inputs");
const container_id = "a".repeat(64);
function fixture(port = 28571) {
  const value = inputs("/fixture-host", port);
  const plan = api.planInfrastructure(value.spec, value.requirements, value.adapter_input);
  const deployment = { id: "gateway", desired_revision: plan.revision, container_id, plan };
  const inspected = { id: container_id, running: true, health: "healthy", owner: value.adapter_input.project, project: value.adapter_input.project, service: "gateway", revision: plan.revision, ports: { "8080/tcp": [{ HostIp: "127.0.0.1", HostPort: String(port) }] } };
  return { deployment, inspected };
}
function mockDocker(t, inspected, error) {
  const original = cp.execFile; let calls = 0;
  cp.execFile = (file, args, options, callback) => { calls++; assert.equal(file, "docker"); assert.deepEqual(args.slice(0, 4), ["--host", "unix:///var/run/docker.sock", "inspect", "--format"]); queueMicrotask(() => callback(error, JSON.stringify(inspected), "")); };
  cp.execFile[require("node:util").promisify.custom] = (...args) => new Promise((resolve, reject) => cp.execFile(...args, (failure, stdout, stderr) => failure ? reject(failure) : resolve({ stdout, stderr })));
  t.after(() => { cp.execFile = original; }); return () => calls;
}
function blockNetwork(t) {
  const original = http.get; let calls = 0;
  http.get = () => { calls++; throw new Error("UNEXPECTED_NETWORK_REQUEST"); };
  t.after(() => { http.get = original; }); return () => calls;
}
for (const [name, field, value] of [
  ["external URL", "url", "https://evil.example/__infra_ready"],
  ["metadata address", "url", "http://169.254.169.254/latest/meta-data"],
  ["wrong loopback port", "url", "http://127.0.0.1:22/__infra_ready"],
  ["wrong Host", "host", "evil.example"],
  ["URL credentials", "url", "http://secret:password@127.0.0.1:28571/__infra_ready"],
  ["unexpected path/query", "url", "http://127.0.0.1:28571/secret?token=secret"],
  ["encoded path", "url", "http://127.0.0.1:28571/%5f%5finfra_ready"],
  ["malformed URL", "url", "http://[invalid"]
]) test(`descriptor rejects ${name} before Docker or network access`, async (t) => {
  const { deployment, inspected } = fixture(); deployment[field] = value;
  const docker = mockDocker(t, inspected); const network = blockNetwork(t);
  const state = await api.inspectInfrastructure(deployment, adapter);
  assert.ok(state.capabilities[0].diagnostic_codes.includes("INVALID_DEPLOYMENT_DESCRIPTOR"));
  assert.equal(docker(), 0); assert.equal(network(), 0); assert.ok(!JSON.stringify(state).includes(value));
});
for (const [name, mutate, code] of [
  ["container identity", (value) => { value.id = "b".repeat(64); }, "DEPLOYMENT_IDENTITY_MISMATCH"],
  ["owner", (value) => { value.owner = "unrelated"; }, "DEPLOYMENT_OWNERSHIP_MISMATCH"],
  ["missing owner", (value) => { delete value.owner; }, "DEPLOYMENT_OWNERSHIP_MISMATCH"],
  ["Compose project", (value) => { value.project = "unrelated"; }, "DEPLOYMENT_OWNERSHIP_MISMATCH"],
  ["gateway service", (value) => { value.service = "database"; }, "DEPLOYMENT_OWNERSHIP_MISMATCH"],
  ["revision", (value) => { value.revision = "b".repeat(64); }, "DEPLOYMENT_REVISION_MISMATCH"],
  ["published port", (value) => { value.ports["8080/tcp"][0].HostPort = "22"; }, "DEPLOYMENT_PORT_MISMATCH"],
  ["published address", (value) => { value.ports["8080/tcp"][0].HostIp = "169.254.169.254"; }, "DEPLOYMENT_PORT_MISMATCH"],
  ["extra publication", (value) => { value.ports["9090/tcp"] = [{ HostIp: "127.0.0.1", HostPort: "22" }]; }, "DEPLOYMENT_PORT_MISMATCH"]
]) test(`Docker ${name} mismatch cannot start a network request`, async (t) => {
  const { deployment, inspected } = fixture(); mutate(inspected); mockDocker(t, inspected); const network = blockNetwork(t);
  const state = await api.inspectInfrastructure(deployment, adapter);
  assert.ok(state.capabilities[0].diagnostic_codes.includes(code)); assert.equal(network(), 0);
});
async function server(t, handler) {
  const instance = http.createServer(handler); await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve));
  t.after(() => { instance.closeAllConnections(); instance.close(); }); return instance.address().port;
}
test("owned gateway probes only fixed IP/path and expected hostname; labels do not prove loaded config", async (t) => {
  let calls = 0;
  const port = await server(t, (request, response) => { calls++; assert.equal(request.url, "/__infra_ready"); assert.equal(request.headers.host, `kernel.test:${port}`); response.end("ready"); });
  const { deployment, inspected } = fixture(port); mockDocker(t, inspected);
  const state = await api.inspectInfrastructure(deployment, adapter);
  assert.equal(calls, 1); assert.equal(state.desired_revision, deployment.desired_revision); assert.equal(state.observed_revision, inspected.revision);
  assert.equal(state.verification.functional, true); assert.equal(state.loaded_configuration.status, "unverified");
  assert.equal(state.verification.protected_delivery, "unverified"); assert.equal(api.diagnoseInfrastructure(state, deployment.plan.inputs.requirements).ready, false);
});
test("redirects are rejected and never followed", async (t) => {
  let calls = 0; const port = await server(t, (request, response) => { calls++; response.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data" }); response.end(); });
  const { deployment, inspected } = fixture(port); mockDocker(t, inspected);
  const state = await api.inspectInfrastructure(deployment, adapter);
  assert.equal(calls, 1); assert.ok(state.capabilities[0].diagnostic_codes.includes("GATEWAY_PROBE_REDIRECT"));
});
test("connection failures are redacted", async (t) => {
  const instance = http.createServer(); await new Promise((resolve) => instance.listen(0, "127.0.0.1", resolve)); const port = instance.address().port; await new Promise((resolve) => instance.close(resolve));
  const { deployment, inspected } = fixture(port); mockDocker(t, inspected);
  const state = await api.inspectInfrastructure(deployment, adapter); assert.ok(state.capabilities[0].diagnostic_codes.includes("GATEWAY_PROBE_FAILED"));
});
test("absolute probe deadline rejects a stalled response", async (t) => {
  const port = await server(t, () => {}); const { deployment, inspected } = fixture(port); mockDocker(t, inspected);
  const started = Date.now(); const state = await api.inspectInfrastructure(deployment, adapter);
  assert.ok(Date.now() - started >= 2900); assert.ok(state.capabilities[0].diagnostic_codes.includes("GATEWAY_PROBE_TIMEOUT"));
});
test("Docker errors are never copied into state", async (t) => {
  const { deployment, inspected } = fixture(); mockDocker(t, inspected, new Error("SECRET_RAW_DOCKER_ERROR")); const network = blockNetwork(t);
  const state = await api.inspectInfrastructure(deployment, adapter); assert.equal(network(), 0); assert.ok(!JSON.stringify(state).includes("SECRET_RAW_DOCKER_ERROR")); assert.ok(state.capabilities[0].diagnostic_codes.includes("OBSERVATION_FAILED"));
});
for (const [name, observation, ready, loaded_status] of [
  ["not running", {}, false, "unknown"],
  ["healthy process only", { running: true, health: "healthy" }, false, "unknown"],
  ["HTTP and matching label only", { running: true, health: "healthy", http_ready: true }, false, "unknown"],
  ["unverified loaded configuration", { running: true, health: "healthy", http_ready: true, loaded_configuration: { status: "unverified" } }, false, "unverified"],
  ["separate explicit attestations", { running: true, health: "healthy", http_ready: true, loaded_configuration: { status: "verified", evidence: "process-attestation" }, protected_delivery_verified: true }, true, "verified"],
  ["label is not an attestation", { running: true, health: "healthy", http_ready: true, loaded_configuration: { status: "verified", evidence: "docker-label" }, protected_delivery_verified: true }, false, "unknown"]
]) test(`readiness semantics: ${name}`, async () => {
  const { deployment } = fixture(); const value = { ...observation, observed_revision: deployment.desired_revision };
  if (value.loaded_configuration) value.loaded_configuration = { ...value.loaded_configuration, revision: deployment.desired_revision };
  const state = await api.inspectInfrastructure(deployment, { observe: async () => value });
  assert.equal(api.diagnoseInfrastructure(state, deployment.plan.inputs.requirements).ready, ready); assert.equal(state.loaded_configuration.status, loaded_status);
});
test("HTTPS probes preserve certificate verification and use the declared SNI", async (t) => {
  const https = require("node:https"); const { EventEmitter } = require("node:events"); const original = https.get;
  t.after(() => { https.get = original; }); let options;
  https.get = (value) => { options = value; const request = new EventEmitter(); request.destroy = () => {}; queueMicrotask(() => request.emit("error", new Error("CERTIFICATE_NOT_TRUSTED"))); return request; };
  const value = inputs("/fixture-host", 28571); value.spec.http.https = true;
  value.spec.tls = { provider: "provided", certificate_ref: { resource: "gateway", key: "cert" }, private_key_ref: { resource: "gateway", key: "key" } };
  value.adapter_input.tls_views = [{ ref: value.spec.tls.certificate_ref, source: "/cert/cert.pem", target: "/etc/tls/cert.pem" }, { ref: value.spec.tls.private_key_ref, source: "/cert/key.pem", target: "/etc/tls/key.pem" }];
  const plan = api.planInfrastructure(value.spec, value.requirements, value.adapter_input); const { inspected } = fixture(); inspected.revision = plan.revision; mockDocker(t, inspected);
  await api.inspectInfrastructure({ id: "gateway", desired_revision: plan.revision, container_id, plan }, adapter);
  assert.equal(options.hostname, "127.0.0.1"); assert.equal(options.servername, "kernel.test"); assert.equal(options.rejectUnauthorized, true);
});
test("missing protected-delivery evidence and wrong loaded revision cannot produce full readiness", async () => {
  const { deployment } = fixture();
  const base = { running: true, health: "healthy", http_ready: true, observed_revision: deployment.desired_revision,
    loaded_configuration: { status: "verified", revision: deployment.desired_revision, evidence: "process-attestation" } };
  const missing = await api.inspectInfrastructure(deployment, { observe: async () => base });
  assert.equal(api.diagnoseInfrastructure(missing, deployment.plan.inputs.requirements).ready, false); assert.ok(missing.capabilities[0].diagnostic_codes.includes("PROTECTED_DELIVERY_NOT_VERIFIED"));
  const wrong = await api.inspectInfrastructure(deployment, { observe: async () => ({ ...base, protected_delivery_verified: true, loaded_configuration: { ...base.loaded_configuration, revision: "b".repeat(64) } }) });
  assert.equal(wrong.loaded_configuration.status, "unknown"); assert.equal(api.diagnoseInfrastructure(wrong, deployment.plan.inputs.requirements).ready, false);
});
test("a valid plan for a LAN/metadata binding is not an approved host-local observation target", async (t) => {
  const value = inputs(); value.adapter_input.bindings[0].host_address = "169.254.169.254";
  const plan = api.planInfrastructure(value.spec, value.requirements, value.adapter_input); assert.equal(plan.applicable, true);
  const docker = mockDocker(t, {}); const network = blockNetwork(t);
  const state = await api.inspectInfrastructure({ id: "gateway", desired_revision: plan.revision, container_id, plan }, adapter);
  assert.ok(state.capabilities[0].diagnostic_codes.includes("INVALID_DEPLOYMENT_DESCRIPTOR")); assert.equal(docker(), 0); assert.equal(network(), 0);
});
