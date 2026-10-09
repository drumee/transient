"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { Websocket } = require(path.resolve(root, "../ui-runtime/src/websocket"));
const finder_root = process.env.KERNEL_FINDER_ROOT || path.resolve(root, "../finder");
const { MfsSync } = require(path.join(finder_root, "lib/mfs-sync"));
const { HubAuthorizer } = require(path.join(root, "target/foundation/server-runtime/lib"));
const { MfsEventAclAuthorizer, MfsEventPublisher, MfsService } = require(path.join(root, "target/modules/mfs-service/lib"));
const { permissionValue } = require(path.join(root, "sources/server-essentials/lib/lex/permission"));

const client_a = "a000000000000001";
const client_b = "b000000000000002";
const hub = "c000000000000003";
const source = { hub_id: hub, nid: "d000000000000004" };
const destination = { hub_id: hub, nid: "e000000000000005" };
const unrelated = { hub_id: hub, nid: "f000000000000006" };

class ScopeFinder {
  constructor(id, location) { this.finder_id = id; this.location = location; this.events = []; this.refreshes = 0; }
  hasItem(node) { return this.items && this.items.has(`${node.hub_id}:${node.nid}`); }
  applyMfsEvent(event) { this.events.push(event); }
  async refresh() { this.refreshes++; }
}

function filesystem() {
  let serial = 20;
  const nodes = new Map([[`${hub}:1000000000000001`, { hub_id: hub, nid: "1000000000000001", parent_id: source.nid, filename: "before.txt", filetype: "file", secret: "private" }]]);
  return {
    async getNode({ node }) { return structuredClone(nodes.get(`${node.hub_id}:${node.nid}`)); },
    async makeDirectory({ destination: parent, name }) { const node = { hub_id: parent.hub_id, nid: (++serial).toString(16).padStart(16, "0"), parent_id: parent.nid, filename: name, filetype: "folder", secret: "private" }; nodes.set(`${node.hub_id}:${node.nid}`, node); return structuredClone(node); },
    async renameNode({ node, name }) { const value = nodes.get(`${node.hub_id}:${node.nid}`); value.filename = name; return structuredClone(value); },
    async removeNode({ node }) { const value = nodes.get(`${node.hub_id}:${node.nid}`); nodes.delete(`${node.hub_id}:${node.nid}`); return { node, parent: { hub_id: node.hub_id, nid: value.parent_id }, nodes: [value], hard_delete: true }; },
    async moveNodes({ nodes: moving, destination: parent }) { return { nodes: moving.map((node) => { const value = nodes.get(`${node.hub_id}:${node.nid}`); const source_parent = { hub_id: node.hub_id, nid: value.parent_id }; value.parent_id = parent.nid; return { ...value, source_parent, destination: parent }; }), destination: parent }; },
    async copyTree({ sources, destination: parent }) { return { nodes: sources.map((node) => ({ source: node, node: { hub_id: parent.hub_id, nid: (++serial).toString(16).padStart(16, "0") }, item: { hub_id: parent.hub_id, nid: serial.toString(16).padStart(16, "0"), parent_id: parent.nid, filename: "copy.txt", filetype: "file" } })), destination: parent }; },
    async commitFile({ destination: parent, metadata }) { return { hub_id: parent.hub_id, nid: (++serial).toString(16).padStart(16, "0"), parent_id: parent.nid, filename: metadata.filename, filetype: "file", secret: "private" }; }
  };
}

test("two independent runtime Websocket clients receive filtered, idempotent MFS events and reconcile", async () => {
  const sockets = new Map([[client_a, new Websocket({})], [client_b, new Websocket({})]]);
  const delivered = [];
  const transport = { async publishRecipient({ principal, service, payload }) { delivered.push({ principal, payload }); sockets.get(principal)._onMessage({ data: JSON.stringify({ service, data: payload }) }); } };
  const fs_api = filesystem();
  const events = new MfsEventPublisher({
    recipients: async () => [client_a, client_b],
    authorize: async () => true,
    project: async ({ event, recipient }) => recipient === client_a ? event : { ...event, result: event.result && { ...event.result, secret: undefined } },
    transport
  });
  const service = new MfsService({ filesystem_factory: () => fs_api, events });
  const sync_a = new MfsSync({ websocket: sockets.get(client_a) });
  const sync_b = new MfsSync({ websocket: sockets.get(client_b) });
  const a_source = new ScopeFinder("a-source", source); const a_destination = new ScopeFinder("a-destination", destination); const a_unrelated = new ScopeFinder("a-unrelated", unrelated);
  const b_source = new ScopeFinder("b-source", source); const b_destination = new ScopeFinder("b-destination", destination);
  [a_source, a_destination, a_unrelated].forEach((finder) => sync_a.register(finder));
  [b_source, b_destination].forEach((finder) => sync_b.register(finder));

  const created = await service.mkdir({ destination: source, name: "Created", operation_id: "create-1" }, { uid: client_a });
  assert.equal(a_source.events.length, 1); assert.equal(b_source.events.length, 1); assert.equal(a_unrelated.events.length, 0);
  const created_node = { hub_id: hub, nid: created.result.nid };
  await service.rename({ node: created_node, name: "Renamed", operation_id: "rename-1" }, { uid: client_a });
  assert.equal(a_source.events.at(-1).type, "node.renamed");
  await service.move({ nodes: [created_node], destination, operation_id: "move-1" }, { uid: client_a });
  assert.equal(a_source.events.at(-1).type, "node.moved"); assert.equal(a_destination.events.at(-1).type, "node.moved");
  await service.copy({ sources: [created_node], destination: source, operation_id: "copy-1" }, { uid: client_a });
  assert.equal(b_source.events.at(-1).type, "node.copied");
  await service.commitUpload({ destination: destination, payload_ref: { type: "opaque" }, metadata: { filename: "upload.txt" }, operation_id: "upload-1" }, { uid: client_a });
  assert.equal(b_destination.events.at(-1).type, "node.created");
  await service.remove({ node: created_node, operation_id: "remove-1" }, { uid: client_a });
  assert.equal(a_destination.events.at(-1).type, "node.removed");

  const before_duplicate = a_source.events.length;
  const duplicate = delivered.find((entry) => entry.principal === client_a && entry.payload.operation_id === "create-1").payload;
  sockets.get(client_a)._onMessage({ data: JSON.stringify({ service: "mfs.event", data: duplicate }) });
  assert.equal(a_source.events.length, before_duplicate);
  assert.equal(delivered.find((entry) => entry.principal === client_b && entry.payload.operation_id === "create-1").payload.result.secret, undefined);

  sockets.get(client_a).emit("connected", {}); sockets.get(client_b).emit("connected", {});
  await new Promise((resolve) => setImmediate(resolve));
  assert.deepEqual([a_source.refreshes, a_destination.refreshes, a_unrelated.refreshes, b_source.refreshes, b_destination.refreshes], [1, 1, 1, 1, 1]);
  sync_a.unregister(a_unrelated); sync_a.destroy(); sync_b.destroy();
});

test("current Hub and node ACL suppress WebSocket delivery and isolate cross-Hub projections", async () => {
  const delivered = [];
  const destination_hub = "1000000000000007";
  const destination_node = { hub_id: destination_hub, nid: "1000000000000008" };
  const sessions = new Map([client_a, client_b].map((uid) => [uid, {
    uid: () => uid,
    isAuthenticated: () => true,
    identity: () => ({ id: uid, domainId: 1, kind: "drumate" })
  }]));
  const hub_acl = new Map([
    [`${client_a}:${hub}`, 63], [`${client_a}:${destination_hub}`, 63],
    [`${client_b}:${hub}`, 3], [`${client_b}:${destination_hub}`, 3]
  ]);
  const node_acl = new Map();
  for (const uid of [client_a, client_b]) for (const node of [source, destination_node]) node_acl.set(`${uid}:${node.hub_id}:${node.nid}`, 3);
  const hub_authorizer = new HubAuthorizer({
    permissionValue,
    resolver: {
      async resolveAuthorized({ hub_id, uid, asked_permission, capabilities }) {
        assert.deepEqual(capabilities, ["system-mfs"]);
        const privilege = hub_acl.get(`${uid}:${hub_id}`) || 0;
        if ((privilege & asked_permission) !== asked_permission) throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" });
        return { hub_id, privilege, authorized: true };
      }
    }
  });
  const acl = new MfsEventAclAuthorizer({
    session_resolver: async (recipient) => sessions.get(recipient),
    hub_authorizer,
    permission_backend: { async effectivePermission(uid, node) { return node_acl.get(`${uid}:${node.hub_id}:${node.nid}`) || 0; } },
    read_permission: permissionValue("read")
  });
  const publisher = new MfsEventPublisher({
    recipients: async () => [client_a, client_b],
    authorize: (request) => acl.authorize(request),
    transport: { async publishRecipient(message) { delivered.push(message); } }
  });
  const event = { type: "node.created", operation_id: "rights-1", destination: source, result: { ...source, filename: "safe" } };
  await publisher.publish({ event, principal: client_a, filesystem: filesystem() });
  assert.deepEqual(delivered.map((entry) => entry.principal), [client_a, client_b]);
  hub_acl.delete(`${client_b}:${hub}`);
  await publisher.publish({ event: { ...event, operation_id: "rights-2" }, principal: client_a, filesystem: filesystem() });
  assert.deepEqual(delivered.map((entry) => entry.principal), [client_a, client_b, client_a]);

  hub_acl.set(`${client_b}:${hub}`, 3);
  node_acl.delete(`${client_b}:${hub}:${source.nid}`);
  await publisher.publish({ event: { ...event, operation_id: "node-denied" }, principal: client_a, filesystem: filesystem() });
  assert.equal(delivered.filter((entry) => entry.payload.operation_id === "node-denied" && entry.principal === client_b).length, 0);

  const cross_hub = {
    type: "node.copied",
    operation_id: "cross-hub",
    source_parent: source,
    destination: destination_node,
    result: { nodes: [{ source: { ...source, filename: "source-secret.txt" }, node: destination_node, item: { ...destination_node, filename: "copy.txt" } }], destination: destination_node }
  };
  await publisher.publish({ event: cross_hub, principal: client_a, filesystem: filesystem() });
  const projected = delivered.find((entry) => entry.principal === client_b && entry.payload.operation_id === "cross-hub").payload;
  assert.equal(JSON.stringify(projected).includes("source-secret.txt"), false);
  assert.equal(JSON.stringify(projected).includes(destination_hub), true);

  const failing = new MfsEventPublisher({ recipients: async () => [client_b], authorize: async () => { throw new Error("ACL unavailable"); }, transport: { async publishRecipient(message) { delivered.push(message); } } });
  await failing.publish({ event, principal: client_a, filesystem: filesystem() });
  assert.equal(delivered.filter((entry) => entry.payload.operation_id === "rights-1" && entry.principal === client_b).length, 1);
  assert.throws(() => new MfsEventPublisher({ transport: { async publishRecipient() {} } }), (error) => error.code === "MFS_EVENT_AUTHORIZER_REQUIRED");
});
