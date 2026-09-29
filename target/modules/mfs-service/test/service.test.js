"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { MfsEventPublisher, MfsService } = require("../lib");

const principal_id = "a000000000000001";
const hub_id = "b000000000000002";
const root = { hub_id, nid: "c000000000000003" };

function filesystem() {
  return {
    async listChildren() { return { items: [], next_cursor: null }; },
    async getNode({ node }) { return { ...node, parent_id: root.nid, filename: "before.txt", secret: "owner-only" }; },
    async makeDirectory({ destination, name }) { return { hub_id: destination.hub_id, nid: "d000000000000004", parent_id: destination.nid, filename: name, filetype: "folder", secret: "owner-only" }; },
    async renameNode({ node, name }) { return { ...node, parent_id: root.nid, filename: name, secret: "owner-only" }; },
    async removeNode({ node }) { return { node, parent: root, hard_delete: true, nodes: [node] }; },
    async moveNodes({ nodes, destination }) { return { nodes: nodes.map((node) => ({ ...node, source_parent: root, destination })), destination }; },
    async copyTree({ sources, destination }) { return { nodes: sources.map((source) => ({ source, node: { hub_id: destination.hub_id, nid: "e000000000000005" }, item: { hub_id: destination.hub_id, nid: "e000000000000005", parent_id: destination.nid } })), destination }; },
    async commitFile({ destination, metadata }) { return { hub_id: destination.hub_id, nid: "f000000000000006", parent_id: destination.nid, filename: metadata.filename, secret: "owner-only" }; },
    async enumerateTree({ roots }) { return { roots, entries: roots.map((node) => ({ ...node, filename: "download.txt", filetype: "file" })) }; },
    async resolveAccess({ node, operation }) { return { allowed: node.nid === root.nid && operation === "create" }; }
  };
}

test("semantic mutations publish recipient-safe projections through an injected runtime adapter", async () => {
  const deliveries = [];
  const events = new MfsEventPublisher({
    recipients: async () => [principal_id, "1000000000000001"],
    project: async ({ event, recipient }) => recipient === principal_id ? event : { ...event, result: { ...event.result, secret: undefined } },
    transport: { async publishRecipient(message) { deliveries.push(message); return message.principal; } }
  });
  const service = new MfsService({ filesystem_factory: filesystem, events });
  const created = await service.mkdir({ destination: root, name: "Docs", operation_id: "op-create" }, { principal_id });
  assert.equal(created.result.filename, "Docs");
  assert.equal(deliveries.length, 2);
  assert.equal(deliveries[0].service, "mfs.event");
  assert.equal(deliveries[0].payload.result.secret, "owner-only");
  assert.equal(deliveries[1].payload.result.secret, undefined);
  assert.equal(Object.hasOwn(events, "sockets"), false);
});

test("hard removal, move, copy and upload commit retain canonical identities", async () => {
  const published = [];
  const service = new MfsService({ filesystem_factory: filesystem, events: { transport: { async publishRecipient(value) { published.push(value); } } } });
  const node = { hub_id, nid: "d000000000000004" };
  assert.equal((await service.remove({ node }, { principal_id })).result.hard_delete, true);
  assert.equal((await service.move({ nodes: [node], destination: root }, { principal_id })).result.destination.nid, root.nid);
  assert.equal((await service.copy({ sources: [node], destination: root }, { principal_id })).result.nodes[0].node.hub_id, hub_id);
  assert.equal((await service.commitUpload({ destination: root, payload_ref: { type: "opaque" }, metadata: { filename: "x" } }, { principal_id })).result.parent_id, root.nid);
  assert.equal((await service.authorizeUpload({ destination: root, size: 1 }, { principal_id })).granted, true);
  assert.equal((await service.authorizeDownload({ roots: [node] }, { principal_id })).entries[0].nid, node.nid);
});

test("operation-level authorization is coordinated before filesystem execution", async () => {
  let called = false;
  const denied = new MfsService({ filesystem_factory: () => ({ async listChildren() { called = true; } }), authorize: async ({ method }) => ({ granted: false, method }) });
  await assert.rejects(() => denied.list({ location: root }, { principal_id }), (error) => error.code === "MFS_OPERATION_DENIED");
  assert.equal(called, false);
});
