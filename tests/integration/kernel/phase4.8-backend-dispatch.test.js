"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { DescriptorRegistry, ServiceDispatcher, createAuthorizer } = require(path.join(root, "target/foundation/server-runtime/lib"));
const { MfsPermissionBackend } = require(path.join(root, "target/modules/mfs-service/lib"));

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
  const transfer_resources = new Map();
  const mfs_transfer = Object.fromEntries(["uploadStart", "uploadChunk", "uploadStatus", "uploadComplete", "uploadAbort", "downloadPrepare", "downloadStatus", "downloadCancel", "downloadRetrieve", "downloadRelease"].map((method) => [method, async (input, context) => { calls.push([method, input, context]); if (method === "uploadStart") transfer_resources.set(input.transfer_id, { dest: [input.destination] }); if (method === "downloadPrepare") transfer_resources.set(input.transfer_id, { src: input.roots }); return { method }; }]));
  mfs_transfer.resourceFor = ({ input }) => transfer_resources.get(input.transfer_id) || {};
  const backend = new MfsPermissionBackend({ permission_store: { effectivePermission(actor, node) { assert.equal(actor, uid); return grants.get(`${node.hub_id}:${node.nid}`) || 0; } }, transfer_resource: (value) => mfs_transfer.resourceFor(value) });
  const mfs_service = Object.fromEntries(["list", "get", "mkdir", "rename", "remove", "move", "copy", "commitUpload"].map((method) => [method, async (input, context) => { calls.push([method, input, context]); return { method }; }]));
  const file_io = { send() { return { delegated: true }; } };
  return { dispatcher: new ServiceDispatcher({ registry: registry(), authorize: createAuthorizer({ mfsPermissionBackend: backend }), workerOptions: { mfs_service, mfs_transfer, file_io } }), transfer_resources };
}

async function decision(grants, service, input, calls = [], session = { uid: () => uid, isAnonymous: () => false }) {
  try { await runtime(new Map(grants), calls).dispatcher.dispatch({ service, session, input }); return true; }
  catch (error) { assert.equal(error.code, "PERMISSION_DENIED"); return false; }
}

test("runtime ACL owns read/write/delete decisions and worker execution boundary", async () => {
  const denied_calls = [];
  assert.equal(await decision([], "mfs.get", { node: source_a }, denied_calls), false); assert.equal(denied_calls.length, 0, "DENIED must not load/invoke a worker");
  const allowed_calls = [];
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 1]], "mfs.get", { node: source_a, uid: "ffffffffffffffff", principal_id: "ffffffffffffffff" }, allowed_calls), true);
  assert.equal(allowed_calls.length, 1); assert.equal(allowed_calls[0][2].uid, uid);
  assert.equal(await decision([[`${hub_b}:${destination.nid}`, 4]], "mfs.mkdir", { destination }), true);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 4]], "mfs.remove", { node: source_a }), false);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 8]], "mfs.remove", { node: source_a }), true);
});

test("runtime checks every source and destination independently across hubs", async () => {
  const both = [[`${hub_a}:${source_a.nid}`, 9], [`${hub_b}:${source_b.nid}`, 9], [`${hub_b}:${destination.nid}`, 4]];
  assert.equal(await decision(both, "mfs.copy", { sources: [source_a, source_b], destination }), true);
  assert.equal(await decision(both.slice(1), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both.slice(0, 2), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both, "mfs.move", { nodes: [source_a, source_b], destination }), true);
});

test("missing trusted identity/backend and unsupported scope fail closed", async () => {
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 1]], "mfs.get", { node: source_a }, [], { isAnonymous: () => false }), false);
  const value = registry();
  const dispatcher = new ServiceDispatcher({ registry: value, authorize: createAuthorizer(), workerOptions: { mfs_service: { get() { throw new Error("must not run"); } } } });
  await assert.rejects(() => dispatcher.dispatch({ service: "mfs.get", session: { uid: () => uid, isAnonymous: () => false }, input: { node: source_a } }), (error) => error.code === "PERMISSION_DENIED");
  assert.equal((await createAuthorizer()({ permission: { scope: "future" } })).granted, false);
});

test("transfer start and persistent endpoints re-enter runtime ACL", async () => {
  const grants = new Map([[`${hub_b}:${destination.nid}`, 4], [`${hub_a}:${source_a.nid}`, 1]]); const calls = [];
  const { dispatcher, transfer_resources } = runtime(grants, calls);
  const session = { uid: () => uid, isAnonymous: () => false };
  await dispatcher.dispatch({ service: "mfs-transfer.upload_start", session, input: { transfer_id: "upload-123", destination } });
  transfer_resources.set("upload-123", { dest: [destination] });
  await dispatcher.dispatch({ service: "mfs-transfer.upload_status", session, input: { transfer_id: "upload-123" } });
  await dispatcher.dispatch({ service: "mfs-transfer.download_prepare", session, input: { transfer_id: "download-123", roots: [source_a] } });
  transfer_resources.set("download-123", { src: [source_a] });
  await dispatcher.dispatch({ service: "mfs-transfer.download_retrieve", session, input: { transfer_id: "download-123" } });
  await dispatcher.dispatch({ service: "mfs-transfer.download_release", session, input: { transfer_id: "download-123" } });
  assert.deepEqual(calls.map((entry) => entry[0]), ["uploadStart", "uploadStatus", "downloadPrepare", "downloadRetrieve", "downloadRelease"]);
  grants.delete(`${hub_a}:${source_a.nid}`);
  await assert.rejects(() => dispatcher.dispatch({ service: "mfs-transfer.download_status", session, input: { transfer_id: "download-123" } }), (error) => error.code === "PERMISSION_DENIED");
});
