"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const api = require("../../lib");
const { digest } = require("../../lib/spec");
const { inputs } = require("../support/inputs");
function plan(values = inputs(), observation) { return api.planInfrastructure(values.spec, values.requirements, values.adapter_input, observation); }
function expectCode(values, code) { const result = plan(values); assert.equal(result.applicable, false); assert.ok(result.diagnostics.some((entry) => entry.code === code), JSON.stringify(result.diagnostics)); assert.equal(result.artifacts.length, 0); }
function temp(t) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "il1-render-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; }

for (const [mode, domain, expected] of [["none", "example.com", "example.com"], ["none", null, undefined], ["local", "example.com", "example.com"], ["local", null, "drumee.lan"], ["localhost", "example.com", "localhost"], ["localhost", null, "localhost"]]) {
  test(`DNS ${mode}, supplied ${domain}, effective ${expected}`, () => {
    const value = inputs(); value.spec.dns.mode = mode;
    if (domain) value.spec.instance.domain = domain; else delete value.spec.instance.domain;
    value.spec.http.enabled = false;
    const validated = api.validateSpec(value.spec, value.requirements);
    assert.equal(validated.valid, true); assert.equal(validated.effective_domain, expected);
    const result = plan(value); assert.equal(result.applicable, true); assert.equal(result.effective_domain, expected);
    assert.equal(result.resources.some((entry) => entry.kind === "dns"), false);
  });
}
test("an enabled hostname-dependent gateway rejects DNS none without a domain", () => { const value = inputs(); delete value.spec.instance.domain; expectCode(value, "MISSING_REQUIRED_HOSTNAME"); });
test("DNS, contract, endpoint and internal prefix errors have stable codes", () => {
  for (const [mutate, code] of [
    [(v) => { v.spec.contract_version = "2"; }, "INVALID_CONTRACT_VERSION"],
    [(v) => { v.spec.dns.mode = "external"; }, "INVALID_DNS_MODE"],
    [(v) => { v.spec.instance.domain = "evil; include /etc/passwd"; }, "INVALID_HOSTNAME"],
    [(v) => { v.requirements.http.service_endpoint.host = "user:pass@backend"; }, "INVALID_ENDPOINT"],
    [(v) => { delete v.requirements.http.delegated_artifact_root; }, "MISSING_ARTIFACT_ROOT"],
    [(v) => { v.requirements.http.internal_artifact_prefix = "/-/static/"; }, "INVALID_INTERNAL_ARTIFACT_PREFIX"],
    [(v) => { v.adapter_input.public_views[0].target = "/srv/../etc"; }, "UNSAFE_RESOURCE_PATH"],
    [(v) => { v.adapter_input.artifact_view.source += "/"; }, "UNSAFE_RESOURCE_PATH"],
    [(v) => { v.adapter_input.image = "nginx:latest"; }, "INCOMPATIBLE_ADAPTER_CONFIGURATION"],
    [(v) => { v.requirements.http.multipart_upload = true; }, "UNSUPPORTED_GATEWAY_REQUIREMENT"]
  ]) { const value = inputs(); mutate(value); expectCode(value, code); }
});
test("localhost forces loopback publication; local DNS is a future prerequisite only", () => {
  const value = inputs(); value.spec.dns.mode = "localhost"; value.adapter_input.bindings[0].host_address = "0.0.0.0"; expectCode(value, "INCOMPATIBLE_ADAPTER_CONFIGURATION");
  value.spec.dns.mode = "local"; const result = plan(value); assert.ok(result.prerequisites.some((entry) => entry.code === "LOCAL_DNS_REQUIRED_NOT_IMPLEMENTED"));
  assert.equal(JSON.stringify(result).includes('"image":"bind'), false);
});
test("observed occupied ports and duplicate overlapping bindings block applicability", () => {
  const value = inputs(); const original = plan(value);
  const conflicted = plan(value, { ports: [{ address: "0.0.0.0", port: 29871, protocol: "tcp" }] });
  assert.equal(conflicted.revision, original.revision); assert.equal(conflicted.applicable, false); assert.equal(conflicted.conflicts[0].code, "CONFLICTING_PORT_BINDING");
  assert.equal(plan(value, { ports: [{ address: "127.0.0.1", port: 29871, protocol: "udp" }] }).applicable, true);
  value.adapter_input.bindings.push({ host_address: "0.0.0.0", host_port: 29871 }); assert.equal(plan(value).applicable, false);
});
test("public filesystem views cannot contain or be inside protected storage", () => {
  const value = inputs(); value.adapter_input.public_views[0].source = value.adapter_input.artifact_view.source; expectCode(value, "UNSAFE_RESOURCE_PATH");
  const second = inputs(); second.requirements.http.public_assets[0].root = "/fixture/artifacts/ui"; expectCode(second, "UNSAFE_RESOURCE_PATH");
});
test("inputs are normalized without mutation; reordered equivalent declarations have equal revisions and bytes", () => {
  const value = inputs(); const before = JSON.stringify(value); const first = plan(value);
  assert.equal(JSON.stringify(value), before);
  const reorder = JSON.parse(before); reorder.requirements.http.public_assets.reverse(); reorder.adapter_input.public_views.reverse();
  assert.deepEqual(plan(reorder), first);
  assert.equal(first.applicable, true); assert.equal(first.revision.length, 64);
  for (const artifact of first.artifacts) assert.equal(artifact.digest, digest(artifact.content));
  reorder.requirements.http.service_endpoint.port++; assert.notEqual(plan(reorder).revision, first.revision);
});
test("irrelevant supplied localhost domain never alters configuration revision", () => {
  const value = inputs(); value.spec.dns.mode = "localhost"; const first = plan(value);
  value.spec.instance.domain = "other.example.com"; const second = plan(value);
  assert.equal(first.revision, second.revision); assert.deepEqual(first.artifacts, second.artifacts);
});
test("planning has no filesystem/process/time/random dependencies", () => {
  const value = inputs(); const first = plan(value);
  for (let index = 0; index < 4; index++) assert.deepEqual(plan(value), first);
  for (const file of ["spec.js", "validation.js", "plan.js", "../capabilities/http/nginx/index.js", "../adapters/docker/nginx.js"]) {
    // Adapter read-only observe is intentionally separate from its pure resource generator.
    const code = fs.readFileSync(path.resolve(__dirname, "../../lib", file), "utf8").split("// Explicit read-only observation")[0];
    assert.doesNotMatch(code, /Date\.now|new Date|randomBytes|writeFile|execFile|spawn\(/);
  }
});
test("secrets and unknown observations are rejected without echoing their values", () => {
  const value = inputs(); value.spec.password = "TOP-SECRET-MARKER"; const invalid = plan(value);
  assert.equal(JSON.stringify(invalid).includes("TOP-SECRET-MARKER"), false); assert.ok(invalid.diagnostics.some((entry) => entry.code === "SECRET_VALUE_FORBIDDEN"));
  const observed = plan(inputs(), { ports: [], token: "TOP-SECRET-MARKER" }); assert.equal(observed.applicable, false); assert.equal(JSON.stringify(observed).includes("TOP-SECRET-MARKER"), false);
});
test("accessors and cyclic input are rejected without executing getters", () => {
  const value = inputs(); Object.defineProperty(value.spec, "password", { get() { throw new Error("must not read"); }, enumerable: true });
  expectCode(value, "INVALID_CONFIGURATION"); const cyclic = inputs(); cyclic.spec.self = cyclic.spec; expectCode(cyclic, "INVALID_CONFIGURATION");
});
test("rendering is idempotent, preserves unrelated files and never activates", (t) => {
  const directory = temp(t); const result = plan(inputs()); fs.writeFileSync(path.join(directory, "unrelated.txt"), "keep");
  assert.equal(api.renderPlan(result, directory).activated, false);
  const first = fs.readFileSync(path.join(directory, "nginx.conf")); api.renderPlan(result, directory);
  assert.deepEqual(fs.readFileSync(path.join(directory, "nginx.conf")), first); assert.equal(fs.readFileSync(path.join(directory, "unrelated.txt"), "utf8"), "keep");
  const next = inputs(); next.requirements.http.service_endpoint.port++; api.renderPlan(plan(next), directory);
  assert.notDeepEqual(fs.readFileSync(path.join(directory, "nginx.conf")), first);
});
test("render refuses unowned or edited destinations without truncating either file", (t) => {
  const directory = temp(t); fs.writeFileSync(path.join(directory, "nginx.conf"), "operator-value");
  assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_DESTINATION_UNOWNED" }); assert.equal(fs.readFileSync(path.join(directory, "nginx.conf"), "utf8"), "operator-value");
  fs.unlinkSync(path.join(directory, "nginx.conf")); api.renderPlan(plan(), directory); fs.appendFileSync(path.join(directory, "gateway.compose.json"), "edited");
  const first = fs.readFileSync(path.join(directory, "nginx.conf")); assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_DESTINATION_UNOWNED" }); assert.deepEqual(fs.readFileSync(path.join(directory, "nginx.conf")), first);
});
test("symlink output roots, artifact destinations, hardlinks and forged content are rejected", (t) => {
  const directory = temp(t); const actual = path.join(directory, "actual"); fs.mkdirSync(actual); fs.symlinkSync(actual, path.join(directory, "linked"));
  assert.throws(() => api.renderPlan(plan(), path.join(directory, "linked", "nested")), { code: "UNSAFE_RESOURCE_PATH" });
  fs.writeFileSync(path.join(directory, "outside"), "keep"); fs.symlinkSync(path.join(directory, "outside"), path.join(actual, "nginx.conf"));
  assert.throws(() => api.renderPlan(plan(), actual), { code: "UNSAFE_RESOURCE_PATH" }); assert.equal(fs.readFileSync(path.join(directory, "outside"), "utf8"), "keep");
  fs.unlinkSync(path.join(actual, "nginx.conf")); fs.linkSync(path.join(directory, "outside"), path.join(actual, "nginx.conf")); assert.throws(() => api.renderPlan(plan(), actual), { code: "UNSAFE_RESOURCE_PATH" });
  const forged = plan(); forged.artifacts[0].content = "include /etc/passwd;"; forged.artifacts[0].digest = digest(forged.artifacts[0].content); assert.throws(() => api.renderPlan(forged, path.join(directory, "forged")), { code: "ARTIFACT_CONTENT_INVALID" });
  assert.throws(() => api.renderPlan(plan(), `${directory}/../escape`), { code: "UNSAFE_RESOURCE_PATH" });
});
test("state requires an observed functional probe and active revision, with no secret projection", async () => {
  const result = plan(); const deployment = { id: "il1", desired_revision: result.revision };
  const adapter = { observe: async () => ({ running: true, health: "healthy", password: "TOP-SECRET-MARKER" }) };
  const state = await api.inspectInfrastructure(deployment, adapter); assert.equal(state.capabilities[0].readiness, "degraded"); assert.equal(JSON.stringify(state).includes("TOP-SECRET-MARKER"), false);
  assert.equal(api.diagnoseInfrastructure(state, inputs().requirements).ready, false);
  adapter.observe = async () => ({ running: true, health: "healthy", http_ready: true, active_revision: result.revision });
  assert.equal(api.diagnoseInfrastructure(await api.inspectInfrastructure(deployment, adapter), inputs().requirements).ready, true);
});
test("gateway descriptor is scoped, rootless, read-only and has no host networking", () => {
  const result = plan(); const config = JSON.parse(result.artifacts.find((artifact) => artifact.path === "gateway.compose.json").content);
  const gateway = config.services.gateway; assert.equal(gateway.user, "101:101"); assert.equal(gateway.read_only, true); assert.deepEqual(gateway.cap_drop, ["ALL"]); assert.equal(gateway.network_mode, undefined);
  assert.ok(gateway.volumes.every((view) => view.read_only)); assert.match(gateway.healthcheck.test.join(" "), /__infra_ready/);
});
test("TLS planning carries references only and rejects secret/public view overlap", () => {
  const value = inputs(); value.spec.http.https = true;
  value.spec.tls = { provider: "provided", certificate_ref: { resource: "gateway", key: "certificate" }, private_key_ref: { resource: "gateway", key: "key" } };
  value.adapter_input.tls_views = [{ ref: value.spec.tls.certificate_ref, source: "/operator/tls/certificate.pem", target: "/etc/tls/certificate.pem" }, { ref: value.spec.tls.private_key_ref, source: "/operator/tls/key.pem", target: "/etc/tls/key.pem" }];
  const result = plan(value); assert.equal(result.applicable, true); assert.match(result.artifacts[0].content, /ssl_certificate_key \/etc\/tls\/key.pem/); assert.doesNotMatch(JSON.stringify(result), /BEGIN PRIVATE KEY/);
  value.adapter_input.tls_views[1].source = value.adapter_input.public_views[0].source + "/key.pem"; expectCode(value, "UNSAFE_RESOURCE_PATH");
  value.adapter_input.tls_views[1].source = "/operator/tls/key.pem";
  value.adapter_input.tls_views[1].target = value.adapter_input.tls_views[0].target; expectCode(value, "UNSAFE_RESOURCE_PATH");
});
test("mount collisions and mixed external port authorities are explicitly unsupported", () => {
  const value = inputs(); value.adapter_input.public_views[0].target = "/etc/nginx"; expectCode(value, "UNSAFE_RESOURCE_PATH");
  const ports = inputs(); ports.adapter_input.bindings.push({ host_address: "127.0.0.1", host_port: 29872 }); expectCode(ports, "UNSUPPORTED_GATEWAY_REQUIREMENT");
});
test("atomic rendering rolls back owned files after a simulated rename failure", (t) => {
  const directory = temp(t); api.renderPlan(plan(), directory);
  const before = fs.readFileSync(path.join(directory, "nginx.conf")); const manifest = fs.readFileSync(path.join(directory, ".infra-layer-render.json"));
  const next = inputs(); next.requirements.http.service_endpoint.port++;
  const original = fs.renameSync; let renames = 0;
  fs.renameSync = (...args) => { if (++renames === 2) throw new Error("SIMULATED_RENAME_FAILURE"); return original(...args); };
  try { assert.throws(() => api.renderPlan(plan(next), directory), /SIMULATED_RENAME_FAILURE/); } finally { fs.renameSync = original; }
  assert.deepEqual(fs.readFileSync(path.join(directory, "nginx.conf")), before); assert.deepEqual(fs.readFileSync(path.join(directory, ".infra-layer-render.json")), manifest);
  assert.equal(fs.readdirSync(directory).some((entry) => entry.startsWith(".infra-render-")), false);
});
test("rendering cannot replace another instance's owned output", (t) => {
  const directory = temp(t); api.renderPlan(plan(), directory); const other = inputs(); other.spec.instance.id = "other-instance";
  assert.throws(() => api.renderPlan(plan(other), directory), { code: "RENDER_OWNERSHIP_INVALID" });
});
test("malformed nested declarations return stable diagnostics instead of throwing", () => {
  const paths = [["spec", "instance"], ["spec", "dns"], ["spec", "http"], ["requirements", "http"], ["adapter_input", "timeouts"], ["adapter_input", "artifact_view"], ["adapter_input", "bindings", 0], ["adapter_input", "public_views", 0], ["requirements", "http", "public_assets", 0]];
  for (const fields of paths) for (const malformed of [null, 0, "bad", []]) {
    const value = inputs(); let parent = value; for (const field of fields.slice(0, -1)) parent = parent[field]; parent[fields.at(-1)] = malformed;
    assert.equal(plan(value).applicable, false);
  }
  for (const prefix of [null, 0, [], {}]) {
    const value = inputs(); value.requirements.http.public_assets[0].url_prefix = prefix;
    assert.equal(plan(value).applicable, false);
  }
  const value = inputs(); value.requirements.http.bootstrap_paths = [["/bootstrap.js"]];
  expectCode(value, "UNSUPPORTED_GATEWAY_REQUIREMENT");
});
test("observer errors are diagnosed without leaking adapter error details", async () => {
  const state = await api.inspectInfrastructure({ id: "il1", desired_revision: plan().revision }, { observe: async () => { throw new Error("TOP-SECRET-MARKER"); } });
  assert.equal(JSON.stringify(state).includes("TOP-SECRET-MARKER"), false); assert.ok(state.capabilities[0].diagnostic_codes.includes("OBSERVATION_FAILED"));
});
