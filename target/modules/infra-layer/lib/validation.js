"use strict";

const net = require("node:net");
const S = require("./spec");

function diagnostic(code, field, severity = "error") { return { code, field, severity }; }
function keys(value, allowed, field, diagnostics) {
  if (!S.record(value)) { diagnostics.push(diagnostic("INVALID_CONFIGURATION", field)); return false; }
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) diagnostics.push(diagnostic(/password|token|secret_value|credential|authorization/i.test(key) ? "SECRET_VALUE_FORBIDDEN" : "UNSUPPORTED_GATEWAY_REQUIREMENT", field));
  }
  return true;
}
function secretRef(value) {
  return S.record(value) && Object.keys(value).every((key) => ["resource", "key"].includes(key)) && S.identifier(value.resource) && S.identifier(value.key);
}

function validateSpec(spec, requirements) {
  const diagnostics = [];
  if (!S.plainTree(spec) || !S.plainTree(requirements)) return { valid: false, diagnostics: [diagnostic("INVALID_CONFIGURATION", "input")] };
  if (!keys(spec, ["contract_version", "instance", "dns", "http", "tls"], "spec", diagnostics)
    || !keys(requirements, ["contract_version", "http"], "requirements", diagnostics)) return { valid: false, diagnostics };
  for (const [value, field] of [[spec, "spec"], [requirements, "requirements"]]) {
    if (value.contract_version !== "1") diagnostics.push(diagnostic("INVALID_CONTRACT_VERSION", `${field}.contract_version`));
  }
  if (keys(spec.instance, ["id", "domain"], "spec.instance", diagnostics)) {
    if (!S.identifier(spec.instance.id)) diagnostics.push(diagnostic("INVALID_CONFIGURATION", "spec.instance.id"));
    if (spec.instance.domain !== undefined && !S.hostname(spec.instance.domain)) diagnostics.push(diagnostic("INVALID_HOSTNAME", "spec.instance.domain"));
  }
  if (keys(spec.dns, ["mode"], "spec.dns", diagnostics) && !["none", "local", "localhost"].includes(spec.dns.mode)) diagnostics.push(diagnostic("INVALID_DNS_MODE", "spec.dns.mode"));
  if (keys(spec.http, ["enabled", "https", "accepted_hosts"], "spec.http", diagnostics)) {
    if (typeof spec.http.enabled !== "boolean" || typeof spec.http.https !== "boolean") diagnostics.push(diagnostic("INVALID_CONFIGURATION", "spec.http"));
    if (spec.http.accepted_hosts !== undefined && (!Array.isArray(spec.http.accepted_hosts) || spec.http.accepted_hosts.some((host) => !S.hostname(host)))) diagnostics.push(diagnostic("INVALID_HOSTNAME", "spec.http.accepted_hosts"));
  }
  if (spec.tls !== undefined) {
    if (keys(spec.tls, ["provider", "certificate_ref", "private_key_ref"], "spec.tls", diagnostics)
      && (spec.tls.provider !== "provided" || !secretRef(spec.tls.certificate_ref) || !secretRef(spec.tls.private_key_ref))) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "spec.tls"));
  }
  const http = requirements.http;
  if (keys(http, ["service_endpoint", "page_endpoint", "websocket_endpoint", "public_assets", "delegated_artifact_root", "internal_artifact_prefix", "max_binary_chunk_bytes", "readiness_path", "bootstrap_paths"], "requirements.http", diagnostics)) {
    for (const field of ["service_endpoint", "page_endpoint", "websocket_endpoint"]) {
      if (!keys(http[field], ["host", "port", "transport"], `requirements.http.${field}`, diagnostics) || !S.endpoint(http[field])) diagnostics.push(diagnostic("INVALID_ENDPOINT", `requirements.http.${field}`));
    }
    if (!S.resourcePath(http.delegated_artifact_root)) diagnostics.push(diagnostic("MISSING_ARTIFACT_ROOT", "requirements.http.delegated_artifact_root"));
    if (!S.prefix(http.internal_artifact_prefix) || http.internal_artifact_prefix.startsWith("/-/") || http.internal_artifact_prefix === "/__infra_ready/") diagnostics.push(diagnostic("INVALID_INTERNAL_ARTIFACT_PREFIX", "requirements.http.internal_artifact_prefix"));
    if (!Number.isSafeInteger(http.max_binary_chunk_bytes) || http.max_binary_chunk_bytes < 1 || http.max_binary_chunk_bytes > 64 * 1024 * 1024) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "requirements.http.max_binary_chunk_bytes"));
    if (typeof http.readiness_path !== "string" || !/^\/[a-zA-Z0-9_/-]+$/.test(http.readiness_path) || http.readiness_path.includes("//")) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "requirements.http.readiness_path"));
    if (!Array.isArray(http.bootstrap_paths) || http.bootstrap_paths.some((entry) => typeof entry !== "string" || !/^\/[a-zA-Z0-9_-]+\.js$/.test(entry))) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "requirements.http.bootstrap_paths"));
    if (!Array.isArray(http.public_assets) || !http.public_assets.length) diagnostics.push(diagnostic("MISSING_ARTIFACT_ROOT", "requirements.http.public_assets"));
    else {
      const ids = new Set(); const prefixes = [];
      for (const asset of http.public_assets) {
        if (!keys(asset, ["id", "url_prefix", "root"], "requirements.http.public_assets", diagnostics)) continue;
        if (!S.identifier(asset.id) || ids.has(asset.id) || !S.resourcePath(asset.root)) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "requirements.http.public_assets"));
        ids.add(asset.id);
        if (!S.prefix(asset.url_prefix) || !["/-/app/", "/-/api/", "/-/plugins/", "/-/static/", "/-/images/", "/-/fonts/"].includes(asset.url_prefix)
          || prefixes.some((other) => other.startsWith(asset.url_prefix) || asset.url_prefix.startsWith(other))) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "requirements.http.public_assets"));
        if (typeof asset.url_prefix === "string") prefixes.push(asset.url_prefix);
        if (S.resourcePath(asset.root) && S.resourcePath(http.delegated_artifact_root) && (S.contains(asset.root, http.delegated_artifact_root) || S.contains(http.delegated_artifact_root, asset.root))) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "requirements.http.public_assets"));
      }
    }
  }
  let effective_domain;
  if (spec.instance && spec.dns && ["none", "local", "localhost"].includes(spec.dns.mode)) {
    effective_domain = S.resolveDomain(spec);
    if (spec.http && spec.http.enabled && !effective_domain) diagnostics.push(diagnostic("MISSING_REQUIRED_HOSTNAME", "spec.instance.domain"));
    if (spec.dns.mode === "localhost" && spec.instance.domain !== undefined) diagnostics.push(diagnostic("SUPPLIED_DOMAIN_OVERRIDDEN", "spec.instance.domain", "info"));
  }
  if (spec.http && spec.http.https && !spec.tls) diagnostics.push(diagnostic("MISSING_TLS_REFERENCE", "spec.tls"));
  if (spec.tls && spec.http && !spec.http.https) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "spec.tls"));
  const valid = !diagnostics.some((entry) => entry.severity === "error");
  if (!valid) return { valid, diagnostics };
  const normalized_spec = S.clone(spec);
  if (normalized_spec.http.accepted_hosts) normalized_spec.http.accepted_hosts = [...new Set(normalized_spec.http.accepted_hosts)].sort();
  if (normalized_spec.dns.mode === "localhost") {
    delete normalized_spec.instance.domain; // irrelevant supplied name must not change the revision
    if (normalized_spec.http.accepted_hosts && normalized_spec.http.accepted_hosts.some((host) => host !== "localhost")) return { valid: false, diagnostics: [diagnostic("INVALID_HOSTNAME", "spec.http.accepted_hosts")] };
  }
  const normalized_requirements = S.clone(requirements);
  normalized_requirements.http.public_assets.sort((a, b) => S.lexical(a.id, b.id));
  normalized_requirements.http.bootstrap_paths = [...new Set(http.bootstrap_paths)].sort();
  return { valid, diagnostics, effective_domain, spec: normalized_spec, requirements: normalized_requirements };
}

function validateAdapter(adapter, normalized) {
  const diagnostics = [];
  if (!S.plainTree(adapter) || !keys(adapter, ["kind", "project", "network", "image", "listen_port", "health_port", "bindings", "artifact_view", "public_views", "tls_views", "tmpfs_bytes", "timeouts"], "adapter", diagnostics)) return { valid: false, diagnostics: diagnostics.length ? diagnostics : [diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter")] };
  if (adapter.kind !== "docker-nginx" || !S.identifier(adapter.project) || !S.identifier(adapter.network) || !portSafe(adapter.listen_port) || !portSafe(adapter.health_port) || adapter.health_port === adapter.listen_port) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter"));
  if (typeof adapter.image !== "string" || !/^(?:[a-zA-Z0-9._/-]+(?::\d+)?[a-zA-Z0-9._/-]*)@sha256:[a-f0-9]{64}$/.test(adapter.image)) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.image"));
  if (!Number.isSafeInteger(adapter.tmpfs_bytes) || adapter.tmpfs_bytes < 1024 * 1024 || adapter.tmpfs_bytes > 1024 * 1024 * 1024) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.tmpfs_bytes"));
  if (!keys(adapter.timeouts, ["client_body_seconds", "upstream_seconds", "websocket_seconds", "send_seconds"], "adapter.timeouts", diagnostics)
    || Object.values(adapter.timeouts).some((value) => !Number.isInteger(value) || value < 1 || value > 86400)
    || Object.keys(adapter.timeouts).length !== 4) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.timeouts"));
  if (!Array.isArray(adapter.bindings) || adapter.bindings.length < 1 || adapter.bindings.length > 8) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.bindings"));
  else for (const binding of adapter.bindings) {
    if (!keys(binding, ["host_address", "host_port"], "adapter.bindings", diagnostics) || !net.isIP(binding.host_address) || !S.port(binding.host_port)) diagnostics.push(diagnostic("INVALID_ENDPOINT", "adapter.bindings"));
    if (S.record(binding) && normalized.spec.dns.mode === "localhost" && !["127.0.0.1", "::1"].includes(binding.host_address)) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.bindings"));
  }
  if (Array.isArray(adapter.bindings) && new Set(adapter.bindings.filter(S.record).map((binding) => binding.host_port)).size > 1) diagnostics.push(diagnostic("UNSUPPORTED_GATEWAY_REQUIREMENT", "adapter.bindings"));
  const view = adapter.artifact_view;
  if (!keys(view, ["source", "target", "kernel_target"], "adapter.artifact_view", diagnostics) || !S.resourcePath(view.source) || !S.resourcePath(view.target) || view.kernel_target !== normalized.requirements.http.delegated_artifact_root) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.artifact_view"));
  if (!Array.isArray(adapter.public_views)) diagnostics.push(diagnostic("MISSING_ARTIFACT_ROOT", "adapter.public_views"));
  else {
    const expected = new Set(normalized.requirements.http.public_assets.map((asset) => asset.id));
    const seen = new Set();
    for (const public_view of adapter.public_views) {
      if (!keys(public_view, ["id", "source", "target"], "adapter.public_views", diagnostics)) continue;
      if (!expected.has(public_view.id) || seen.has(public_view.id)) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.public_views"));
      seen.add(public_view.id);
      if (!S.resourcePath(public_view.source) || !S.resourcePath(public_view.target)) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.public_views"));
      else if (view && S.resourcePath(view.source) && S.resourcePath(view.target) && ["source", "target"].some((field) => S.contains(public_view[field], view[field]) || S.contains(view[field], public_view[field]))) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.public_views"));
    }
    if (seen.size !== expected.size) diagnostics.push(diagnostic("MISSING_ARTIFACT_ROOT", "adapter.public_views"));
    if (new Set(adapter.public_views.map((entry) => entry && entry.target)).size !== adapter.public_views.length) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.public_views"));
  }
  if (normalized.spec.http.https) {
    if (!Array.isArray(adapter.tls_views) || adapter.tls_views.length !== 2) diagnostics.push(diagnostic("MISSING_TLS_REFERENCE", "adapter.tls_views"));
    else for (const tls_view of adapter.tls_views) {
      if (!keys(tls_view, ["ref", "source", "target"], "adapter.tls_views", diagnostics) || !secretRef(tls_view.ref) || !S.resourcePath(tls_view.source) || !S.resourcePath(tls_view.target)) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.tls_views"));
    }
    for (const ref of [normalized.spec.tls.certificate_ref, normalized.spec.tls.private_key_ref]) if (!(Array.isArray(adapter.tls_views) ? adapter.tls_views : []).some((entry) => S.record(entry) && S.serialize(entry.ref) === S.serialize(ref))) diagnostics.push(diagnostic("MISSING_TLS_REFERENCE", "adapter.tls_views"));
    if (S.serialize(normalized.spec.tls.certificate_ref) === S.serialize(normalized.spec.tls.private_key_ref)) diagnostics.push(diagnostic("MISSING_TLS_REFERENCE", "spec.tls"));
    if (Array.isArray(adapter.tls_views)) for (const tls_view of adapter.tls_views) {
      for (const view of [adapter.artifact_view, ...(Array.isArray(adapter.public_views) ? adapter.public_views : [])]) if (S.record(view) && S.record(tls_view) && ["source", "target"].some((field) => typeof view[field] === "string" && typeof tls_view[field] === "string" && (S.contains(view[field], tls_view[field]) || S.contains(tls_view[field], view[field])))) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.tls_views"));
    }
    if (Array.isArray(adapter.tls_views) && new Set(adapter.tls_views.map((entry) => entry && entry.target)).size !== adapter.tls_views.length) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.tls_views"));
  } else if (adapter.tls_views !== undefined) diagnostics.push(diagnostic("INCOMPATIBLE_ADAPTER_CONFIGURATION", "adapter.tls_views"));
  // View destinations cannot cover executable configuration or writable temp state.
  for (const view of [adapter.artifact_view, ...(Array.isArray(adapter.public_views) ? adapter.public_views : [])]) {
    if (S.record(view) && S.resourcePath(view.target) && ["/etc/nginx", "/tmp", "/usr", "/bin", "/proc", "/dev"].some((protected_path) => S.contains(view.target, protected_path) || S.contains(protected_path, view.target))) diagnostics.push(diagnostic("UNSAFE_RESOURCE_PATH", "adapter.views"));
  }
  return { valid: !diagnostics.some((entry) => entry.severity === "error"), diagnostics };
}
function portSafe(value) { return S.port(value) && value >= 1024; }

module.exports = { diagnostic, validateAdapter, validateSpec };
