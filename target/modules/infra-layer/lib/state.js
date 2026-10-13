"use strict";

const { identifier, plainTree } = require("./spec");
const { observation_codes } = require("./diagnostics");
async function inspectInfrastructure(deployment, adapter) {
  if (!plainTree(deployment) || !deployment || !identifier(deployment.id) || !/^[a-f0-9]{64}$/.test(deployment.desired_revision || "") || !adapter || typeof adapter.observe !== "function") throw Object.assign(new Error("INVALID_OBSERVATION"), { code: "INVALID_OBSERVATION" });
  let observation;
  try { observation = await adapter.observe(deployment); } catch (error) { observation = { failed: true, diagnostic_codes: [observation_codes.has(error?.code) ? error.code : "OBSERVATION_FAILED"] }; }
  if (!observation || !plainTree(observation) || typeof observation !== "object") observation = { failed: true };
  const codes = [];
  for (const code of Array.isArray(observation.diagnostic_codes) ? observation.diagnostic_codes : []) codes.push(observation_codes.has(code) ? code : "OBSERVATION_FAILED");
  if (observation.failed) codes.push("OBSERVATION_FAILED");
  if (observation.running !== true) codes.push("GATEWAY_NOT_RUNNING");
  if (observation.health !== "healthy") codes.push("GATEWAY_HEALTH_NOT_CONFIRMED");
  if (observation.http_ready !== true) codes.push("GATEWAY_FUNCTIONAL_READINESS_NOT_CONFIRMED");
  const observed_revision = observation.observed_revision || observation.active_revision;
  const active_revision = /^[a-f0-9]{64}$/.test(observed_revision || "") ? observed_revision : undefined;
  if (active_revision !== deployment.desired_revision) codes.push("CONFIGURATION_REVISION_NOT_CONFIRMED");
  const loaded = observation.loaded_configuration;
  const loaded_verified = loaded?.status === "verified" && loaded.revision === deployment.desired_revision && ["activation-attestation", "process-attestation"].includes(loaded.evidence);
  if (!loaded_verified) codes.push("LOADED_CONFIGURATION_NOT_VERIFIED");
  if (observation.protected_delivery_verified !== true) codes.push("PROTECTED_DELIVERY_NOT_VERIFIED");
  const state = {
    contract_version: "1", deployment: deployment.id, desired_revision: deployment.desired_revision,
    capabilities: [{ name: "http-gateway", required: true, readiness: codes.length ? observation.running === true ? "degraded" : "failed" : "ready", diagnostic_codes: [...new Set(codes)] }],
    dependencies: [{ name: "kernel-http", readiness: observation.http_ready === true ? "ready" : "unknown" }],
    metadata: { adapter: "explicit-observer" },
    loaded_configuration: loaded_verified ? { status: "verified", revision: loaded.revision, evidence: loaded.evidence } : { status: loaded?.status === "unverified" ? "unverified" : "unknown" },
    verification: { functional: observation.http_ready === true, protected_delivery: observation.protected_delivery_verified === true ? "verified" : "unverified" }
  };
  if (identifier(adapter.kind)) state.metadata.adapter = adapter.kind;
  if (/^[a-f0-9]{64}$/.test(deployment.container_id || "")) state.metadata.runtime_id = deployment.container_id;
  if (active_revision) { state.active_revision = active_revision; state.observed_revision = active_revision; }
  return state;
}
function diagnoseInfrastructure(state, requirements) {
  const diagnostics = [];
  if (!state || state.contract_version !== "1" || !Array.isArray(state.capabilities)) return { ready: false, diagnostics: [{ code: "INVALID_OBSERVATION" }] };
  for (const capability of state.capabilities) for (const code of capability.diagnostic_codes || []) diagnostics.push({ code: observation_codes.has(code) ? code : "INVALID_OBSERVATION", capability: "http-gateway" });
  if (!requirements || requirements.contract_version !== "1") diagnostics.push({ code: "INVALID_CONTRACT_VERSION" });
  return { ready: state.capabilities.length > 0 && state.capabilities.every((capability) => capability.readiness === "ready") && !diagnostics.length, diagnostics };
}
module.exports = { diagnoseInfrastructure, inspectInfrastructure };
