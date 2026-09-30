"use strict";

const NODE_FIELDS = ["hub_id", "nid", "parent_id", "filename", "filetype", "filesize", "mimetype", "ext", "ctime", "mtime", "status", "rank", "filepath"];

function publicNode(value) {
  if (!value || typeof value !== "object") return value || null;
  const result = {};
  for (const key of NODE_FIELDS) if (value[key] !== undefined && value[key] !== null) result[key] = value[key];
  return result;
}

function publicResult(value) {
  if (!value || typeof value !== "object") return value || null;
  if (value.nid) return publicNode(value);
  if (Array.isArray(value)) return value.map(publicResult);
  if (value.items) return { items: value.items.map(publicNode), next_cursor: value.next_cursor || null };
  if (value.hard_delete) return { node: publicNode(value.node), parent: publicNode(value.parent), nodes: (value.nodes || []).map(publicNode), hard_delete: true };
  if (value.nodes && value.destination) return {
    nodes: value.nodes.map((entry) => entry.source || entry.item ? { source: publicNode(entry.source), node: publicNode(entry.node), item: publicNode(entry.item) } : publicNode(entry)),
    destination: publicNode(value.destination)
  };
  return {};
}

function publicEvent(event) {
  return {
    type: event.type,
    operation_id: event.operation_id,
    node: publicNode(event.node),
    source_parent: publicNode(event.source_parent),
    destination: publicNode(event.destination),
    result: publicResult(event.result),
    hard_delete: Boolean(event.hard_delete),
    committed_from_transfer: Boolean(event.committed_from_transfer)
  };
}

class MfsEventPublisher {
  constructor({ recipients, project, transport } = {}) {
    this.recipients = recipients || (async ({ principal }) => [principal]);
    this.project = project || (async ({ event }) => event);
    this.transport = transport;
  }

  async publish({ event, principal, filesystem }) {
    if (!this.transport || typeof this.transport.publishRecipient !== "function") return [];
    const recipients = await this.recipients({ event, principal, filesystem });
    const deliveries = [];
    for (const recipient of recipients || []) {
      const projected = await this.project({ event: publicEvent(event), recipient, principal, filesystem });
      if (!projected) continue;
      deliveries.push(await this.transport.publishRecipient({ principal: recipient, service: "mfs.event", payload: publicEvent(projected) }));
    }
    return deliveries;
  }
}

module.exports = { MfsEventPublisher, publicEvent, publicNode, publicResult };
