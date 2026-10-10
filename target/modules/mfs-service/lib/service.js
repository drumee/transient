"use strict";

const crypto = require("node:crypto");
const { MfsEventPublisher, publicAccess, publicEvent, publicNode, publicResult } = require("./events");

const ID_PATTERN = /^[a-f0-9]{16}$/i;

function operationId(input = {}) { return input.operation_id || crypto.randomUUID(); }

function principalContext(context = {}) {
  const uid = context.uid;
  if (!ID_PATTERN.test(uid || "")) throw Object.assign(new Error("Trusted MFS Session uid is required"), { code: "MFS_PRINCIPAL_REQUIRED" });
  const current_hub_id = ID_PATTERN.test(context.current_hub_id || "") ? context.current_hub_id.toLowerCase() : null;
  const host = typeof context.host === "string" && context.host.trim() ? context.host.trim().toLowerCase() : null;
  const hub_context = context.hub_context && context.hub_context.authorized ? context.hub_context : null;
  const hub_contexts = context.hub_contexts && typeof context.hub_contexts === "object" ? context.hub_contexts : null;
  return { uid: uid.toLowerCase(), current_hub_id, host, hub_context, hub_contexts };
}

function resource(value, principal, label) {
  if (!value || !ID_PATTERN.test(value.nid || "")) throw Object.assign(new Error(`${label} requires a valid nid`), { code: "MFS_IDENTITY_INVALID" });
  const hub_id = value.hub_id || principal.current_hub_id;
  if (!ID_PATTERN.test(hub_id || "")) throw Object.assign(new Error(`${label} requires hub_id or trusted current hub context`), { code: "MFS_IDENTITY_INVALID" });
  return { hub_id: hub_id.toLowerCase(), nid: value.nid.toLowerCase() };
}

function normalizeInput(method, input, principal) {
  const value = { ...(input || {}) };
  if (value.location) value.location = resource(value.location, principal, "location");
  if (value.node) value.node = resource(value.node, principal, "node");
  if (value.destination) value.destination = resource(value.destination, principal, "destination");
  if (value.nodes) value.nodes = value.nodes.map((node) => resource(node, principal, "node"));
  if (value.sources) value.sources = value.sources.map((node) => resource(node, principal, "source"));
  if (value.roots) value.roots = value.roots.map((node) => resource(node, principal, "root"));
  return value;
}

class MfsService {
  constructor({ filesystem_factory, events, permission_backend, permission_contract = {} } = {}) {
    if (typeof filesystem_factory !== "function") throw new Error("mfs-service requires a filesystem factory");
    this.filesystem_factory = filesystem_factory;
    this.events = events instanceof MfsEventPublisher ? events : new MfsEventPublisher(events);
    this.permission_backend = permission_backend || null;
    this.permission_contract = permission_contract;
  }

  hubContext(principal, hub_id) {
    if (principal.hub_context && principal.hub_context.hub_id === hub_id) return principal.hub_context;
    return principal.hub_contexts && principal.hub_contexts[hub_id] || null;
  }

  async decorateNode(node, principal) {
    const value = publicNode(node);
    if (!value || !value.hub_id || !value.nid || !this.permission_backend) return value;
    const hub = this.hubContext(principal, value.hub_id);
    if (!hub) return { ...value, access: { known: false } };
    const node_privilege = Number(await this.permission_backend.effectivePermission(principal.uid, value) || 0);
    const access = publicAccess({ known: true, hub_privilege: Number(hub.privilege || 0), node_privilege, permission: this.permission_contract });
    return { ...value, privilege: node_privilege, hub_privilege: access.hub_privilege, access };
  }

  async decorateResult(value, principal) {
    if (!value || typeof value !== "object") return value;
    if (value.hub_id && value.nid) return this.decorateNode(value, principal);
    if (Array.isArray(value)) return Promise.all(value.map((entry) => this.decorateResult(entry, principal)));
    const result = {};
    for (const [key, entry] of Object.entries(value)) result[key] = await this.decorateResult(entry, principal);
    return result;
  }

  filesystem(context) {
    const principal = principalContext(context);
    return { principal, filesystem: this.filesystem_factory(principal) };
  }

  async list(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("list", input, value.principal);
    const result = await value.filesystem.listChildren(normalized);
    return { items: await Promise.all((result.items || []).map((item) => this.decorateNode(item, value.principal))), next_cursor: result.next_cursor || null };
  }

  async get(input, context) {
    const value = this.filesystem(context);
    return this.decorateNode(await value.filesystem.getNode(normalizeInput("get", input, value.principal)), value.principal);
  }

  mkdir(input, context) { return this.mutate("node.created", "mkdir", input, context, (filesystem, normalized) => filesystem.makeDirectory(normalized), { destination: true }); }

  async rename(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("rename", input, value.principal);
    const before = await value.filesystem.getNode({ node: normalized.node });
    return this.mutateWith("node.renamed", normalized, value, (filesystem) => filesystem.renameNode(normalized), { source_parent: { hub_id: normalized.node.hub_id, nid: before.parent_id } });
  }

  async remove(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("remove", input, value.principal);
    const before = await value.filesystem.getNode({ node: normalized.node });
    return this.mutateWith("node.removed", normalized, value, (filesystem) => filesystem.removeNode(normalized), { source_parent: { hub_id: normalized.node.hub_id, nid: before.parent_id }, hard_delete: true });
  }

  async move(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("move", input, value.principal);
    const first = normalized.nodes && normalized.nodes[0] ? await value.filesystem.getNode({ node: normalized.nodes[0] }) : null;
    return this.mutateWith("node.moved", normalized, value, (filesystem) => filesystem.moveNodes(normalized), { source_parent: first && { hub_id: normalized.nodes[0].hub_id, nid: first.parent_id }, destination: normalized.destination });
  }

  copy(input, context) { return this.mutate("node.copied", "copy", input, context, (filesystem, normalized) => filesystem.copyTree(normalized), { destination: true }); }
  commitUpload(input, context) { return this.mutate("node.created", "commit_upload", input, context, (filesystem, normalized) => filesystem.commitFile(normalized), { destination: true, committed_from_transfer: true }); }

  async prepareDownload(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("download", input, value.principal);
    return value.filesystem.enumerateTree({ roots: normalized.roots });
  }

  async prepareUpload(input, context) {
    const value = this.filesystem(context);
    const normalized = normalizeInput("upload", input, value.principal);
    const destination = await value.filesystem.getNode({ node: normalized.destination });
    if (!destination || !["folder", "root"].includes(destination.filetype)) throw Object.assign(new Error("Upload destination is not a folder"), { code: "MFS_DESTINATION_INVALID" });
    return { granted: true, destination: normalized.destination };
  }

  authorizeDownload(input, context) { return this.prepareDownload(input, context); }
  authorizeUpload(input, context) { return this.prepareUpload(input, context); }

  mutate(type, method, input, context, operation, details = {}) {
    const value = this.filesystem(context);
    const normalized = normalizeInput(method, input, value.principal);
    const expanded = { ...details };
    if (expanded.destination === true) expanded.destination = normalized.destination;
    return this.mutateWith(type, normalized, value, operation, expanded);
  }

  async mutateWith(type, input, { principal, filesystem }, operation, details = {}) {
    const operation_id = operationId(input);
    const internal_result = await operation(filesystem, input);
    const result = await this.decorateResult(publicResult(internal_result), principal);
    const event = publicEvent({ type, operation_id, node: result && result.nid ? { hub_id: result.hub_id, nid: result.nid } : input.node || null, source_parent: details.source_parent || null, destination: details.destination || null, result, hard_delete: details.hard_delete || false, committed_from_transfer: details.committed_from_transfer || false });
    await this.events.publish({ event, principal, filesystem });
    return { operation_id, result };
  }
}

module.exports = { MfsService, normalizeInput, operationId, principalContext, resource };
