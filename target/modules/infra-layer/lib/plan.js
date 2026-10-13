"use strict";

const S = require("./spec");
const { diagnostic, validateAdapter, validateSpec } = require("./validation");
const { renderNginx } = require("../capabilities/http/nginx");
const { gatewayResources } = require("../adapters/docker/nginx");

function planInfrastructure(spec, requirements, adapter_input, observation = {}) {
  const normalized = validateSpec(spec, requirements);
  const diagnostics = [...normalized.diagnostics];
  const base = { contract_version: "1", diagnostics, artifacts: [], resources: [], prerequisites: [], conflicts: [], compatibility: [], applicable: false };
  if (!normalized.valid) return base;
  const checked = validateAdapter(adapter_input, normalized);
  diagnostics.push(...checked.diagnostics);
  if (!checked.valid) return base;
  if (!S.plainTree(observation) || !S.record(observation) || Object.keys(observation).some((key) => !["ports"].includes(key)) || (observation.ports !== undefined && (!Array.isArray(observation.ports) || observation.ports.some((entry) => !S.record(entry) || Object.keys(entry).some((key) => !["address", "port", "protocol"].includes(key)) || !require("node:net").isIP(entry.address) || !S.port(entry.port) || !["tcp", "udp"].includes(entry.protocol))))) {
    diagnostics.push(diagnostic("INVALID_OBSERVATION", "observation")); return base;
  }
  const inputs = { spec: normalized.spec, requirements: normalized.requirements, adapter_input: S.clone(adapter_input) };
  inputs.adapter_input.bindings.sort((a, b) => S.lexical(`${a.host_address}:${a.host_port}`, `${b.host_address}:${b.host_port}`));
  inputs.adapter_input.public_views.sort((a, b) => S.lexical(a.id, b.id));
  if (inputs.adapter_input.tls_views) inputs.adapter_input.tls_views.sort((a, b) => S.lexical(a.target, b.target));
  const bindings = inputs.adapter_input.bindings;
  const conflict = (field) => base.conflicts.push(diagnostic("CONFLICTING_PORT_BINDING", field));
  const overlaps = (a, b) => a === b || ["0.0.0.0", "::"].includes(a) || ["0.0.0.0", "::"].includes(b);
  for (let i = 0; i < bindings.length; i++) {
    if (bindings.slice(0, i).some((other) => other.host_port === bindings[i].host_port && overlaps(other.host_address, bindings[i].host_address))) conflict("adapter.bindings");
    if ((observation.ports || []).some((entry) => entry.protocol === "tcp" && entry.port === bindings[i].host_port && overlaps(entry.address, bindings[i].host_address))) conflict("observation.ports");
  }
  // Only configuration inputs affect the revision; observations affect applicability.
  const nginx = inputs.spec.http.enabled ? renderNginx(inputs, normalized.effective_domain) : "";
  const descriptor = inputs.spec.http.enabled ? gatewayResources(inputs, normalized.effective_domain, "") : {};
  const revision = S.digest({ inputs, nginx, descriptor });
  const plan = { ...base, revision, inputs };
  if (normalized.effective_domain) plan.effective_domain = normalized.effective_domain;
  if (inputs.spec.dns.mode === "local") plan.prerequisites.push({ owner: "IL-2", code: "LOCAL_DNS_REQUIRED_NOT_IMPLEMENTED" });
  if (!inputs.spec.http.enabled) {
    plan.applicable = !base.conflicts.length;
    plan.compatibility.push({ code: "GATEWAY_DISABLED", satisfied: true });
    return plan;
  }
  const compose = `${JSON.stringify(S.canonical(gatewayResources(inputs, normalized.effective_domain, revision)), null, 2)}\n`;
  plan.artifacts = [{ path: "nginx.conf", content: nginx, mode: 0o644 }, { path: "gateway.compose.json", content: compose, mode: 0o644 }].map((artifact) => ({ ...artifact, digest: S.digest(artifact.content) }));
  plan.resources = [{ id: "gateway", kind: "container", owner: inputs.adapter_input.project, persistent: false }, { id: "protected-artifacts", kind: "filesystem-view", read_only: true, kernel_target: inputs.adapter_input.artifact_view.kernel_target, gateway_target: inputs.adapter_input.artifact_view.target }];
  plan.compatibility = [{ code: "KERNEL_AUTHORITY_REQUIRED", validation: "runtime-only" }, { code: "SINGLE_TRANSFER_BACKEND_REQUIRED", validation: "composition-owner" }, { code: "DIRECT_EDGE_PROXY_TRUST_ONLY", validation: "configuration-enforced" }];
  plan.prerequisites.push({ owner: "distribution", code: "UPSTREAMS_AND_SCOPED_VIEWS_REQUIRED" }, { owner: "operator", code: "NGINX_SYNTAX_AND_FUNCTIONAL_VALIDATION_REQUIRED" });
  if (inputs.spec.http.https) plan.prerequisites.push({ owner: "operator", code: "EXISTING_CERTIFICATE_MATERIAL_REQUIRED" });
  plan.applicable = !base.conflicts.length;
  return plan;
}
module.exports = { planInfrastructure };
