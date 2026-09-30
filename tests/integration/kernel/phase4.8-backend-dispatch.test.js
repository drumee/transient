"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { DescriptorRegistry, ServiceDispatcher } = require(path.join(root, "target/foundation/server-runtime/lib"));
const { MfsAclAuthorizer } = require(path.join(root, "target/modules/mfs-service/lib"));

const uid = "a000000000000001";
const hub_a = "b000000000000002";
const hub_b = "c000000000000003";
const source_a = { hub_id: hub_a, nid: "d000000000000004" };
const source_b = { hub_id: hub_b, nid: "e000000000000005" };
const destination = { hub_id: hub_b, nid: "f000000000000006" };

function registry() {
  const value = new DescriptorRegistry({ permissionValue(name) { return { anonymous: 0, read: 1, write: 4, delete: 8 }[name]; } });
  value.registerDirectory(path.join(root, "target/modules/mfs-service/server/acl"));
  value.registerDirectory(path.join(root, "target/modules/mfs-transfer/server/acl"));
  return value;
}

function runtime(grants, calls = []) {
  const authorizer = new MfsAclAuthorizer({ permission_store: { effectivePermission(actor, node) { assert.equal(actor, uid); return grants.get(`${node.hub_id}:${node.nid}`) || 0; } } });
  const mfs_service = Object.fromEntries(["list", "get", "mkdir", "rename", "remove", "move", "copy", "commitUpload"].map((method) => [method, async (input, context) => { calls.push([method, input, context]); return { method }; }]));
  return new ServiceDispatcher({ registry: registry(), authorize: authorizer.authorize.bind(authorizer), workerOptions: { mfs_service } });
}

async function decision(grants, service, input) {
  const dispatcher = runtime(new Map(grants));
  try {
    await dispatcher.dispatch({ service, session: { uid: () => uid, identity: () => ({ id: uid }) }, input });
    return true;
  } catch (error) {
    assert.equal(error.code, "PERMISSION_DENIED");
    return false;
  }
}

test("runtime ACL dispatch uses trusted Session uid for read/write/remove", async () => {
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 1]], "mfs.get", { node: source_a, uid: "ffffffffffffffff" }), true);
  assert.equal(await decision([], "mfs.get", { node: source_a }), false);
  assert.equal(await decision([[`${hub_b}:${destination.nid}`, 4]], "mfs.mkdir", { destination, name: "Docs" }), true);
  assert.equal(await decision([], "mfs.mkdir", { destination, name: "Docs" }), false);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 8]], "mfs.remove", { node: source_a }), true);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 4]], "mfs.remove", { node: source_a }), false);
});

test("runtime ACL dispatch requires every source and destination, including cross-hub resources", async () => {
  const both = [[`${hub_a}:${source_a.nid}`, 9], [`${hub_b}:${source_b.nid}`, 9], [`${hub_b}:${destination.nid}`, 4]];
  assert.equal(await decision(both, "mfs.copy", { sources: [source_a, source_b], destination }), true);
  assert.equal(await decision(both.slice(1), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both.slice(0, 2), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both, "mfs.move", { nodes: [source_a, source_b], destination }), true);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 8], [`${hub_b}:${destination.nid}`, 4]], "mfs.move", { nodes: [source_a, source_b], destination }), false);
});

test("authorized dispatch reaches workers with server-created context only", async () => {
  const calls = [];
  const dispatcher = runtime(new Map([[`${hub_a}:${source_a.nid}`, 1]]), calls);
  assert.deepEqual(await dispatcher.dispatch({ service: "mfs.list", session: { uid: () => uid, identity: () => ({ id: uid }) }, input: { location: source_a, principal_id: "ffffffffffffffff" } }), { method: "list" });
  assert.equal(calls[0][2].uid, uid);
  assert.equal(calls[0][2].principal_id, undefined);
});
