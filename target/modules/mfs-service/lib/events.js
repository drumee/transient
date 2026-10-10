"use strict";

const NODE_FIELDS = ["hub_id", "nid", "parent_id", "filename", "filetype", "filesize", "mimetype", "ext", "ctime", "mtime", "status", "rank", "filepath", "privilege", "hub_privilege", "access"];

function publicAccess(value) {
  if (!value || typeof value !== "object") return undefined;
  if (value.known !== true) return { known: false };
  const permission = {};
  for (const name of ["read", "write", "delete", "admin", "owner"]) if (Number.isInteger(Number(value.permission && value.permission[name]))) permission[name] = Number(value.permission[name]);
  return { known: true, hub_privilege: Number(value.hub_privilege || 0), node_privilege: Number(value.node_privilege || 0), permission };
}

function publicNode(value) {
  if (!value || typeof value !== "object") return value || null;
  const result = {};
  for (const key of NODE_FIELDS) if (value[key] !== undefined && value[key] !== null) result[key] = value[key];
  if (result.access) result.access = publicAccess(result.access);
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
    committed_from_transfer: Boolean(event.committed_from_transfer),
    reconcile: (event.reconcile || []).map(publicNode).filter(Boolean)
  };
}

function eventHubIds(event) {
  const ids = new Set();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.hub_id === "string") ids.add(value.hub_id);
    if (Array.isArray(value)) for (const entry of value) visit(entry);
    else for (const entry of Object.values(value)) visit(entry);
  };
  visit(publicEvent(event));
  return [...ids].sort();
}

function eventNodes(event) {
  const nodes = new Map();
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (typeof value.hub_id === "string" && typeof value.nid === "string") nodes.set(`${value.hub_id}:${value.nid}`, { hub_id: value.hub_id, nid: value.nid });
    if (Array.isArray(value)) for (const entry of value) visit(entry);
    else for (const entry of Object.values(value)) visit(entry);
  };
  visit(publicEvent(event));
  return [...nodes.values()];
}

function projectVisibleNodes(value, visible, access = new Map()) {
  if (!value || typeof value !== "object") return value;
  if (typeof value.hub_id === "string" && typeof value.nid === "string") {
    const key = `${value.hub_id}:${value.nid}`;
    if (!visible.has(key)) return null;
    value = { ...value, access: access.get(key) || { known: false } };
  }
  if (Array.isArray(value)) return value.map((entry) => projectVisibleNodes(entry, visible, access)).filter(Boolean);
  const projected = {};
  for (const [key, entry] of Object.entries(value)) {
    const next = projectVisibleNodes(entry, visible, access);
    if (next !== null) projected[key] = next;
  }
  return projected;
}

function affectedFolders(event) {
  const folders = new Map();
  for (const value of [event && event.source_parent, event && event.destination, event && event.result && event.result.parent]) {
    if (value && value.hub_id && value.nid) folders.set(`${value.hub_id}:${value.nid}`, { hub_id: value.hub_id, nid: value.nid });
  }
  return [...folders.values()];
}

function hasRemovalIdentity(event) {
  if (event && event.node && event.node.hub_id && event.node.nid) return true;
  return Boolean(event && event.result && Array.isArray(event.result.nodes) && event.result.nodes.some((entry) => entry && (entry.nid || entry.node && entry.node.nid || entry.item && entry.item.nid)));
}

class MfsEventAclAuthorizer {
  constructor({ session_resolver, hub_authorizer, permission_backend, permission_contract = {}, read_permission = 2 } = {}) {
    if (typeof session_resolver !== "function") throw Object.assign(new Error("MFS event authorization requires a session resolver"), { code: "MFS_EVENT_SESSION_RESOLVER_REQUIRED" });
    if (!hub_authorizer || typeof hub_authorizer.authorizeResource !== "function") throw Object.assign(new Error("MFS event authorization requires the Hub authorizer"), { code: "MFS_EVENT_HUB_AUTHORIZER_REQUIRED" });
    if (!permission_backend || typeof permission_backend.effectivePermission !== "function") throw Object.assign(new Error("MFS event authorization requires the MFS permission backend"), { code: "MFS_EVENT_PERMISSION_BACKEND_REQUIRED" });
    this.session_resolver = session_resolver;
    this.hub_authorizer = hub_authorizer;
    this.permission_backend = permission_backend;
    this.permission_contract = permission_contract;
    this.read_permission = Number(read_permission);
  }

  async authorize({ event, recipient }) {
    const session = await this.session_resolver(recipient);
    const uid = session && typeof session.uid === "function" ? session.uid() : null;
    if (!uid) return { allowed: false, event: null };
    const visible = new Set();
    const access = new Map();
    for (const node of eventNodes(event)) {
      try {
        const hub = await this.hub_authorizer.authorizeResource({ session, hub_id: node.hub_id, asked_permission: this.read_permission, capabilities: ["system-mfs"] });
        if (!hub || !hub.granted) continue;
        const effective = Number(await this.permission_backend.effectivePermission(uid, node) || 0);
        if ((effective & this.read_permission) === this.read_permission) {
          const key = `${node.hub_id}:${node.nid}`;
          visible.add(key);
          access.set(key, publicAccess({ known: true, hub_privilege: hub.hub_context && hub.hub_context.privilege, node_privilege: effective, permission: this.permission_contract }));
        }
      } catch (_) {
        // Authorization backend failures are closed: this resource is hidden.
      }
    }
    const projected = projectVisibleNodes(publicEvent(event), visible, access);
    if (["node.moved", "node.removed"].includes(projected.type) && !hasRemovalIdentity(projected)) {
      projected.reconcile = affectedFolders(event).filter((folder) => visible.has(`${folder.hub_id}:${folder.nid}`)).map((folder) => ({ ...folder, access: access.get(`${folder.hub_id}:${folder.nid}`) }));
    }
    return { allowed: eventHubIds(projected).length > 0, event: projected };
  }
}

class MfsEventPublisher {
  constructor({ recipients, authorize, project, transport } = {}) {
    this.recipients = recipients || (async ({ principal }) => [principal]);
    if (transport && typeof authorize !== "function") throw Object.assign(new Error("MFS event delivery requires an authorization callback"), { code: "MFS_EVENT_AUTHORIZER_REQUIRED" });
    this.authorize = authorize || null;
    this.project = project || (async ({ event }) => event);
    this.transport = transport;
  }

  async publish({ event, principal, filesystem }) {
    if (!this.transport || typeof this.transport.publishRecipient !== "function") return [];
    if (!this.authorize) throw Object.assign(new Error("MFS event delivery requires authorization"), { code: "MFS_EVENT_AUTHORIZER_REQUIRED" });
    const recipients = await this.recipients({ event, principal, filesystem });
    const deliveries = [];
    const candidate = publicEvent(event);
    for (const recipient of recipients || []) {
      let authorization;
      try {
        authorization = await this.authorize({ event: candidate, hub_ids: eventHubIds(candidate), recipient, principal, filesystem });
      } catch (_) {
        continue;
      }
      if (!authorization || authorization.allowed === false) continue;
      const authorized_event = authorization === true ? candidate : authorization.event;
      if (!authorized_event) continue;
      const projected = await this.project({ event: authorized_event, recipient, principal, filesystem });
      if (!projected) continue;
      deliveries.push(await this.transport.publishRecipient({ principal: recipient, service: "mfs.event", payload: publicEvent(projected) }));
    }
    return deliveries;
  }
}

module.exports = { MfsEventAclAuthorizer, MfsEventPublisher, affectedFolders, eventHubIds, eventNodes, hasRemovalIdentity, projectVisibleNodes, publicAccess, publicEvent, publicNode, publicResult };
