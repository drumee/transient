"use strict";

const { identifier } = require("./spec");
async function inspectInfrastructure(deployment, adapter) {
  if (!deployment || !identifier(deployment.id) || !/^[a-f0-9]{64}$/.test(deployment.desired_revision || "") || !adapter || typeof adapter.observe !== "function") throw Object.assign(new Error("INVALID_OBSERVATION"), { code: "INVALID_OBSERVATION" });
  let observation;
  try { observation = await adapter.observe(deployment); } catch (_) { observation = { failed: true }; }
  if (!observation || typeof observation !== "object") observation = { failed: true };
  const codes = [];
  if (observation.failed) codes.push("OBSERVATION_FAILED");
  if (observation.running !== true) codes.push("GATEWAY_NOT_RUNNING");
  if (observation.health !== "healthy") codes.push("GATEWAY_HEALTH_NOT_CONFIRMED");
  if (observation.http_ready !== true) codes.push("GATEWAY_FUNCTIONAL_READINESS_NOT_CONFIRMED");
  const active_revision = /^[a-f0-9]{64}$/.test(observation.active_revision || "") ? observation.active_revision : undefined;
  if (active_revision !== deployment.desired_revision) codes.push("CONFIGURATION_REVISION_NOT_CONFIRMED");
  const state = {
    contract_version: "1", deployment: deployment.id, desired_revision: deployment.desired_revision,
    capabilities: [{ name: "http-gateway", required: true, readiness: codes.length ? observation.running ? "degraded" : "failed" : "ready", diagnostic_codes: codes }],
    dependencies: [{ name: "kernel-http", readiness: observation.http_ready === true ? "ready" : "unknown" }],
    metadata: { adapter: "explicit-observer" }
  };
  if (identifier(adapter.kind)) state.metadata.adapter = adapter.kind;
  if (/^[a-f0-9]{64}$/.test(deployment.container_id || "")) state.metadata.runtime_id = deployment.container_id;
  if (active_revision) state.active_revision = active_revision;
  return state;
}
function diagnoseInfrastructure(state, requirements) {
  const diagnostics = [];
  if (!state || state.contract_version !== "1" || !Array.isArray(state.capabilities)) return { ready: false, diagnostics: [{ code: "INVALID_OBSERVATION" }] };
  const allowed_codes = new Set(["OBSERVATION_FAILED", "GATEWAY_NOT_RUNNING", "GATEWAY_HEALTH_NOT_CONFIRMED", "GATEWAY_FUNCTIONAL_READINESS_NOT_CONFIRMED", "CONFIGURATION_REVISION_NOT_CONFIRMED"]);
  for (const capability of state.capabilities) for (const code of capability.diagnostic_codes || []) diagnostics.push({ code: allowed_codes.has(code) ? code : "INVALID_OBSERVATION", capability: "http-gateway" });
  if (!requirements || requirements.contract_version !== "1") diagnostics.push({ code: "INVALID_CONTRACT_VERSION" });
  return { ready: state.capabilities.length > 0 && state.capabilities.every((capability) => capability.readiness === "ready") && !diagnostics.length, diagnostics };
}
module.exports = { diagnoseInfrastructure, inspectInfrastructure };
