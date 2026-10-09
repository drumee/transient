"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { CapabilityResolver, DescriptorRegistry, HubAuthorizer, ServiceDispatcher, createAuthorizer } = require(path.join(root, "target/foundation/server-runtime/lib"));
const { MfsPermissionBackend } = require(path.join(root, "target/modules/mfs-service/lib"));

const uid = "a000000000000001";
const hub_a = "b000000000000002";
const hub_b = "c000000000000003";
const source_a = { hub_id: hub_a, nid: "d000000000000004" };
const source_b = { hub_id: hub_b, nid: "e000000000000005" };
const destination = { hub_id: hub_b, nid: "f000000000000006" };

function registry() {
  const value = new DescriptorRegistry({ permissionValue(name) { return { anonymous: 1, read: 2, write: 4, delete: 8, admin: 16, owner: 32 }[name]; } });
  value.registerDirectory(path.join(root, "target/modules/mfs-service/server/acl"));
  value.registerDirectory(path.join(root, "target/modules/mfs-transfer/server/acl"));
  return value;
}

function runtime(grants, calls = [], hub_grants = new Map([[hub_a, 63], [hub_b, 63]])) {
  const transfer_resources = new Map();
  const mfs_transfer = Object.fromEntries(["uploadStart", "uploadChunk", "uploadStatus", "uploadComplete", "uploadAbort", "downloadPrepare", "downloadStatus", "downloadCancel", "downloadRetrieve", "downloadRelease"].map((method) => [method, async (input, context) => { calls.push([method, input, context]); if (method === "uploadStart") transfer_resources.set(input.transfer_id, { dest: [input.destination] }); if (method === "downloadPrepare") transfer_resources.set(input.transfer_id, { src: input.roots }); return { method }; }]));
  mfs_transfer.resourceFor = ({ input }) => transfer_resources.get(input.transfer_id) || {};
  const backend = new MfsPermissionBackend({ permission_store: { effectivePermission(actor, node) { assert.equal(actor, uid); return grants.get(`${node.hub_id}:${node.nid}`) || 0; } }, transfer_resource: (value) => mfs_transfer.resourceFor(value) });
  const mfs_service = Object.fromEntries(["list", "get", "mkdir", "rename", "remove", "move", "copy", "commitUpload"].map((method) => [method, async (input, context) => { calls.push([method, input, context]); return { method }; }]));
  const file_io = { send() { return { delegated: true }; } };
  const resolver = { async resolveAuthorized({ hub_id, asked_permission }) { const privilege = hub_grants.get(hub_id) || 0; if ((privilege & asked_permission) !== asked_permission) throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" }); return { hub_id, database_name: `trusted_${hub_id}`, privilege, authorized: true }; } };
  const session_options = { hub_contexts_seen: [] };
  return {
    dispatcher: new ServiceDispatcher({
      registry: registry(),
      authorize: createAuthorizer({ hubAuthorizer: new HubAuthorizer({ resolver, permissionValue(name) { return { read: 2, write: 4, delete: 8, admin: 16, owner: 32 }[name]; } }), mfsPermissionBackend: backend }),
      capability_resolver: new CapabilityResolver({ providers: { "system-mfs": async () => true } }),
      workerOptions: { mfs_service, mfs_transfer, file_io, session_options }
    }),
    transfer_resources
  };
}

function trustedSession(actor = uid) { return { uid: () => actor, isAnonymous: () => false, isAuthenticated: () => true, identity: () => ({ id: actor, domainId: 41, kind: "drumate" }) }; }

async function decision(grants, service, input, calls = [], session = trustedSession(), hub_grants) {
  try { await runtime(new Map(grants), calls, hub_grants).dispatcher.dispatch({ service, session, input }); return true; }
  catch (error) { assert.equal(error.code, "PERMISSION_DENIED"); return false; }
}

test("runtime ACL owns read/write/delete decisions and worker execution boundary", async () => {
  const denied_calls = [];
  assert.equal(await decision([], "mfs.get", { node: source_a }, denied_calls), false); assert.equal(denied_calls.length, 0, "DENIED must not load/invoke a worker");
  const allowed_calls = [];
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 3]], "mfs.get", { node: source_a, uid: "ffffffffffffffff", principal_id: "ffffffffffffffff" }, allowed_calls), true);
  assert.equal(allowed_calls.length, 1); assert.equal(allowed_calls[0][2].uid, uid);
  assert.equal(await decision([[`${hub_b}:${destination.nid}`, 4]], "mfs.mkdir", { destination }), true);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 4]], "mfs.remove", { node: source_a }), false);
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 8]], "mfs.remove", { node: source_a }), true);
});

test("runtime checks every source and destination independently across hubs", async () => {
  const both = [[`${hub_a}:${source_a.nid}`, 15], [`${hub_b}:${source_b.nid}`, 15], [`${hub_b}:${destination.nid}`, 7]];
  assert.equal(await decision(both, "mfs.copy", { sources: [source_a, source_b], destination }), true);
  assert.equal(await decision(both.slice(1), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both.slice(0, 2), "mfs.copy", { sources: [source_a, source_b], destination }), false);
  assert.equal(await decision(both, "mfs.move", { nodes: [source_a, source_b], destination }), true);
});

test("Hub ACL is checked independently from node ACL for every source and destination", async () => {
  const node_grants = [[`${hub_a}:${source_a.nid}`, 63], [`${hub_b}:${destination.nid}`, 63]];
  assert.equal(await decision(node_grants, "mfs.copy", { sources: [source_a], destination }, [], trustedSession(), new Map([[hub_a, 3], [hub_b, 7]])), true);
  assert.equal(await decision(node_grants, "mfs.copy", { sources: [source_a], destination }, [], trustedSession(), new Map([[hub_a, 3], [hub_b, 3]])), false);
  assert.equal(await decision(node_grants, "mfs.copy", { sources: [source_a], destination }, [], trustedSession(), new Map([[hub_a, 1], [hub_b, 7]])), false);
});

test("missing trusted identity/backend and unsupported scope fail closed", async () => {
  assert.equal(await decision([[`${hub_a}:${source_a.nid}`, 3]], "mfs.get", { node: source_a }, [], { isAnonymous: () => false }), false);
  const value = registry();
  const dispatcher = new ServiceDispatcher({ registry: value, authorize: createAuthorizer(), workerOptions: { mfs_service: { get() { throw new Error("must not run"); } } } });
  await assert.rejects(() => dispatcher.dispatch({ service: "mfs.get", session: { uid: () => uid, isAnonymous: () => false }, input: { node: source_a } }), (error) => error.code === "PERMISSION_DENIED");
  assert.equal((await createAuthorizer()({ permission: { scope: "future" } })).granted, false);
});

test("transfer start and persistent endpoints re-enter runtime ACL", async () => {
  const grants = new Map([[`${hub_b}:${destination.nid}`, 7], [`${hub_a}:${source_a.nid}`, 3]]); const calls = [];
  const { dispatcher, transfer_resources } = runtime(grants, calls);
  const session = trustedSession();
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
