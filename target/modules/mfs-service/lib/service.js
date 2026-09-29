"use strict";

const crypto = require("node:crypto");
const { MfsEventPublisher } = require("./events");

function operationId(input = {}) {
  return input.operation_id || crypto.randomUUID();
}

function principalContext(context = {}) {
  const principal_id = context.principal_id || context.id;
  if (!/^[a-f0-9]{16}$/i.test(principal_id || "")) throw Object.assign(new Error("Authenticated MFS principal is required"), { code: "MFS_PRINCIPAL_REQUIRED" });
  return { principal_id: principal_id.toLowerCase() };
}

class MfsService {
  constructor({ filesystem_factory, events, authorize } = {}) {
    if (typeof filesystem_factory !== "function") throw new Error("mfs-service requires a filesystem factory");
    this.filesystem_factory = filesystem_factory;
    this.events = events instanceof MfsEventPublisher ? events : new MfsEventPublisher(events);
    this.authorize = authorize || (async () => ({ granted: true }));
  }

  filesystem(context) {
    const principal = principalContext(context);
    return { principal, filesystem: this.filesystem_factory(principal) };
  }

  async list(input, context) { const value = this.filesystem(context); await this.requireIntent("list", input, value); return value.filesystem.listChildren(input); }
  async get(input, context) { const value = this.filesystem(context); await this.requireIntent("get", input, value); return value.filesystem.getNode(input); }

  async mkdir(input, context) {
    return this.mutate("node.created", "mkdir", input, context, (filesystem) => filesystem.makeDirectory(input), {
      destination: input.destination
    });
  }

  async rename(input, context) {
    const before = await this.get({ node: input.node }, context);
    return this.mutate("node.renamed", "rename", input, context, (filesystem) => filesystem.renameNode(input), {
      source_parent: { hub_id: input.node.hub_id, nid: before.parent_id }
    });
  }

  async remove(input, context) {
    const before = await this.get({ node: input.node }, context);
    return this.mutate("node.removed", "remove", input, context, (filesystem) => filesystem.removeNode(input), {
      source_parent: { hub_id: input.node.hub_id, nid: before.parent_id },
      hard_delete: true
    });
  }

  async move(input, context) {
    const first = input.nodes && input.nodes[0] ? await this.get({ node: input.nodes[0] }, context) : null;
    return this.mutate("node.moved", "move", input, context, (filesystem) => filesystem.moveNodes(input), {
      source_parent: first && { hub_id: input.nodes[0].hub_id, nid: first.parent_id },
      destination: input.destination
    });
  }

  async copy(input, context) {
    return this.mutate("node.copied", "copy", input, context, (filesystem) => filesystem.copyTree(input), {
      destination: input.destination
    });
  }

  async commitUpload(input, context) {
    return this.mutate("node.created", "commit_upload", input, context, (filesystem) => filesystem.commitFile(input), {
      destination: input.destination,
      committed_from_transfer: true
    });
  }

  async authorizeDownload(input, context) {
    const value = this.filesystem(context);
    await this.requireIntent("download", input, value);
    const { filesystem } = value;
    return filesystem.enumerateTree({ roots: input.roots });
  }

  async authorizeUpload(input, context) {
    const value = this.filesystem(context);
    await this.requireIntent("upload", input, value);
    const access = await value.filesystem.resolveAccess({ node: input.destination, operation: "create" });
    if (!access || !access.allowed) throw Object.assign(new Error("Upload destination is not writable"), { code: "MFS_OPERATION_DENIED", details: access });
    return { granted: true, destination: input.destination };
  }

  async requireIntent(method, input, { principal, filesystem }) {
    const decision = await this.authorize({ method, input, principal, filesystem });
    if (!decision || !decision.granted) throw Object.assign(new Error(`MFS operation '${method}' is not authorized`), { code: "MFS_OPERATION_DENIED", details: decision });
  }

  async mutate(type, method, input, context, operation, details = {}) {
    const { principal, filesystem } = this.filesystem(context);
    await this.requireIntent(method, input, { principal, filesystem });
    const operation_id = operationId(input);
    const result = await operation(filesystem);
    const event = {
      type,
      operation_id,
      node: result && result.nid ? { hub_id: result.hub_id || input.destination && input.destination.hub_id || input.node && input.node.hub_id, nid: result.nid } : input.node || null,
      source_parent: details.source_parent || null,
      destination: details.destination || null,
      result,
      hard_delete: details.hard_delete || false,
      committed_from_transfer: details.committed_from_transfer || false
    };
    await this.events.publish({ event, principal, filesystem });
    return { operation_id, result };
  }
}

module.exports = { MfsService, operationId, principalContext };
