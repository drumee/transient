"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { createAuthorizer } = require("../../../foundation/server-runtime/lib");
const { MfsEventAclAuthorizer, MfsPermissionBackend, MfsEventPublisher, MfsService } = require("../lib");
const Logger = require("../../../../sources/server-essentials/lib/logger");

const uid = "a000000000000001";
const nobody = "ffffffffffffffff";
const hub_id = "b000000000000002";
const other_hub = "c000000000000003";
const root = { hub_id, nid: "d000000000000004" };

function filesystem() {
  return {
    async listChildren() { return { items: [{ ...root, filename: "safe", db_name: "private_db", home_dir: "/private", payload_ref: "private" }], next_cursor: null }; },
    async getNode({ node }) { return node.nid === root.nid ? { ...node, parent_id: "0", filename: "Root", filetype: "root", db_host: "private" } : { ...node, parent_id: root.nid, filename: "before.txt", filetype: "text", mfs_root: "/private" }; },
    async makeDirectory({ destination, name }) { return { hub_id: destination.hub_id, nid: "e000000000000005", parent_id: destination.nid, filename: name, filetype: "folder", db_name: "private" }; },
    async renameNode({ node, name }) { return { ...node, parent_id: root.nid, filename: name, filetype: "text", home_dir: "/private" }; },
    async removeNode({ node }) { return { node, parent: root, hard_delete: true, nodes: [{ ...node, payload_ref: "private" }] }; },
    async moveNodes({ nodes, destination }) { return { nodes: nodes.map((node) => ({ ...node, source_parent: root, destination, db_name: "private" })), destination }; },
    async copyTree({ sources, destination }) { return { nodes: sources.map((source) => ({ source, node: { hub_id: destination.hub_id, nid: "f000000000000006" }, item: { hub_id: destination.hub_id, nid: "f000000000000006", parent_id: destination.nid, payload_ref: "private" } })), destination }; },
    async commitFile({ destination, metadata }) { return { hub_id: destination.hub_id, nid: "1000000000000001", parent_id: destination.nid, filename: metadata.filename, filetype: "text", payload_ref: "private" }; },
    async enumerateTree({ roots }) { return { roots, entries: roots.map((node) => ({ ...node, filename: "download.txt", filetype: "file", storage_ref: "internal" })) }; }
  };
}

test("service and WebSocket projections exclude physical and staged-storage fields", async () => {
  const deliveries = [];
  const events = new MfsEventPublisher({ recipients: async () => [uid], authorize: async () => true, transport: { async publishRecipient(message) { deliveries.push(message); } } });
  const service = new MfsService({ filesystem_factory: filesystem, events });
  const listed = await service.list({ location: root, uid: "client-cannot-override" }, { uid });
  assert.deepEqual(listed.items[0], { hub_id, nid: root.nid, filename: "safe" });
  const created = await service.mkdir({ destination: root, name: "Docs", operation_id: "op-create", principal_id: "client-cannot-override" }, { uid });
  assert.equal(created.result.filename, "Docs");
  const serialized = JSON.stringify({ listed, created, deliveries });
  for (const secret of ["db_name", "home_dir", "mfs_root", "db_host", "fs_host", "payload_ref"]) assert.equal(serialized.includes(secret), false, secret);
});

test("hard removal, move, copy and upload commit retain only canonical identities", async () => {
  const service = new MfsService({ filesystem_factory: filesystem });
  const node = { hub_id, nid: "e000000000000005" };
  assert.equal((await service.remove({ node }, { uid })).result.hard_delete, true);
  assert.equal((await service.move({ nodes: [node], destination: root }, { uid })).result.destination.nid, root.nid);
  assert.equal((await service.copy({ sources: [node], destination: root }, { uid })).result.nodes[0].node.hub_id, hub_id);
  assert.equal((await service.commitUpload({ destination: root, payload_ref: { type: "opaque" }, metadata: { filename: "x" } }, { uid })).result.parent_id, root.nid);
  assert.equal((await service.prepareUpload({ destination: root, size: 1 }, { uid })).granted, true);
  assert.equal((await service.prepareDownload({ roots: [node] }, { uid })).entries[0].nid, node.nid);
});

test("trusted current hub fills omitted hub_id while client infrastructure locators are ignored", async () => {
  let received;
  const service = new MfsService({ filesystem_factory: () => ({ async getNode(input) { received = input.node; return { ...input.node, filename: "x", filetype: "text" }; } }) });
  const value = await service.get({ node: { nid: root.nid }, db_name: "evil", home_dir: "/evil", mfs_root: "/evil" }, { uid, current_hub_id: hub_id });
  assert.deepEqual(received, root);
  assert.deepEqual(value, { ...root, filename: "x", filetype: "text" });
});

test("runtime ACL uses Session uid and the MFS backend only supplies resources and effective permissions", async () => {
  const grants = new Map([
    [`${uid}:${hub_id}:${root.nid}`, 63],
    [`${uid}:${other_hub}:2000000000000002`, 3],
    [`${nobody}:${hub_id}:${root.nid}`, 0]
  ]);
  const backend = new MfsPermissionBackend({ permission_store: { effectivePermission(actor, node) { return grants.get(`${actor}:${node.hub_id}:${node.nid}`) || 0; } } });
  const hubAuthorizer = { async authorizeResource({ hub_id }) { return { granted: true, hub_context: { hub_id, authorized: true } }; } };
  const authorize = createAuthorizer({ hubAuthorizer, mfsPermissionBackend: backend });
  const session = { uid: () => uid };
  assert.equal((await authorize({ service: "mfs.get", permission: { scope: "mfs", src: 2 }, input: { node: root, uid: nobody }, session })).granted, true);
  assert.equal((await authorize({ service: "mfs.remove", permission: { scope: "mfs", src: 8 }, input: { node: root, principal_id: nobody }, session })).granted, true);
  const source = { hub_id: other_hub, nid: "2000000000000002" };
  assert.equal((await authorize({ service: "mfs.copy", permission: { scope: "mfs", src: 2, dest: 4 }, input: { sources: [source], destination: root }, session })).granted, true);
  assert.equal((await authorize({ service: "mfs.copy", permission: { scope: "mfs", src: 4, dest: 4 }, input: { sources: [source], destination: root }, session })).granted, false);
  assert.equal((await authorize({ service: "mfs.copy", permission: { scope: "mfs", src: 2, dest: 4 }, input: { sources: [root], destination: source }, session })).granted, false);
  assert.equal((await authorize({ service: "mfs.get", permission: { scope: "mfs", src: 2 }, input: { node: root }, session: { uid: () => nobody } })).granted, false);
  const token_uid = "d000000000000004";
  grants.set(`${token_uid}:${hub_id}:${root.nid}`, 3);
  assert.equal((await authorize({ service: "mfs.get", permission: { scope: "mfs", src: 2 }, input: { node: root, uid }, session: {} })).granted, false, "sessions without uid() fail closed");
  assert.equal((await authorize({ service: "mfs.get", permission: { scope: "mfs", src: 2 }, input: { node: root, uid }, session: { uid: () => token_uid } })).granted, true, "validated MFS tokens resolve a trusted pseudo-identity through Session.uid()");
});

test("list and get expose only the caller effective Hub and node access contract", async () => {
  const permission = { read: 2, write: 4, delete: 8, admin: 16, owner: 32 };
  const backend = { async effectivePermission(actor) { return actor === uid ? 15 : 3; } };
  const service = new MfsService({ filesystem_factory: filesystem, permission_backend: backend, permission_contract: permission });
  const owner_context = { uid, hub_context: { hub_id, privilege: 63, authorized: true } };
  const reader_context = { uid: nobody, hub_context: { hub_id, privilege: 3, authorized: true } };
  const owner_node = (await service.list({ location: root }, owner_context)).items[0];
  const reader_node = await service.get({ node: root }, reader_context);
  const created_node = (await service.mkdir({ destination: root, name: "Caller access" }, owner_context)).result;
  assert.deepEqual(owner_node.access, { known: true, hub_privilege: 63, node_privilege: 15, permission });
  assert.deepEqual(reader_node.access, { known: true, hub_privilege: 3, node_privilege: 3, permission });
  assert.equal(owner_node.privilege, 15);
  assert.equal(reader_node.privilege, 3);
  assert.deepEqual(created_node.access, { known: true, hub_privilege: 63, node_privilege: 15, permission });
  assert.equal(JSON.stringify({ owner_node, reader_node }).includes("entity_id"), false);
});

test("partially visible move and deletion invalidate only authorized folders without leaking hidden identities", async () => {
  const reader = "reader0000000001";
  const owner = "owner0000000002";
  const source = { hub_id, nid: "source0000000001", filename: "Visible source" };
  const destination = { hub_id, nid: "dest000000000002", filename: "Hidden destination" };
  const moved = { hub_id, nid: "moved00000000001", filename: "Hidden after move" };
  const permission = { read: 2, write: 4, delete: 8, admin: 16, owner: 32 };
  const effective = new Map([
    [`${reader}:${source.nid}`, 3],
    [`${owner}:${source.nid}`, 63], [`${owner}:${destination.nid}`, 63], [`${owner}:${moved.nid}`, 63]
  ]);
  const authorizer = new MfsEventAclAuthorizer({
    session_resolver: ({ uid: actor }) => ({ uid: () => actor }),
    hub_authorizer: { async authorizeResource({ session }) { return { granted: true, hub_context: { hub_id, privilege: session.uid() === owner ? 63 : 3 } }; } },
    permission_backend: { async effectivePermission(actor, node) { return effective.get(`${actor}:${node.nid}`) || 0; } },
    permission_contract: permission,
    read_permission: permission.read
  });
  const event = {
    type: "node.moved", operation_id: "partially-visible-move", node: moved, source_parent: source, destination,
    result: { nodes: [{ ...moved, parent_id: destination.nid }], destination }
  };
  const projected = await authorizer.authorize({ recipient: { uid: reader }, event });
  assert.equal(projected.allowed, true);
  assert.deepEqual(projected.event.reconcile.map(({ hub_id: value_hub, nid }) => ({ hub_id: value_hub, nid })), [{ hub_id, nid: source.nid }]);
  assert.equal(projected.event.node, undefined);
  assert.equal(projected.event.destination, undefined);
  const serialized = JSON.stringify(projected.event);
  for (const hidden of [destination.nid, destination.filename, moved.nid, moved.filename]) assert.equal(serialized.includes(hidden), false, hidden);
  assert.deepEqual(projected.event.reconcile[0].access, { known: true, hub_privilege: 3, node_privilege: 3, permission });

  const removed = await authorizer.authorize({ recipient: { uid: reader }, event: { type: "node.removed", operation_id: "partially-visible-delete", node: moved, source_parent: source, result: { hard_delete: true, node: moved, parent: source, nodes: [moved] } } });
  assert.deepEqual(removed.event.reconcile.map((entry) => entry.nid), [source.nid]);
  assert.equal(JSON.stringify(removed.event).includes(moved.nid), false);

  const owner_projection = await authorizer.authorize({ recipient: { uid: owner }, event });
  assert.equal(owner_projection.event.node.nid, moved.nid);
  assert.deepEqual(owner_projection.event.reconcile, []);
  assert.equal(owner_projection.event.node.access.node_privilege, 63);
});

test("server Output sanitizer remains a final barrier after explicit projection", () => {
  const logger = Object.create(Logger.prototype);
  const value = logger.sanitize({ public: "ok", db_name: "internal", home_dir: "/internal", mfs_root: "/internal", db_host: "internal", fs_host: "internal", nested: { session_id: "secret", password: "secret" } });
  assert.deepEqual(value, { public: "ok", nested: {} });
});
