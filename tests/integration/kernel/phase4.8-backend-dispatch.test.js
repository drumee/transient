"use strict";

const assert = require("node:assert/strict");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { DescriptorRegistry, ServiceDispatcher } = require(path.join(root, "target/foundation/server-runtime/lib"));

test("runtime dispatches authenticated mfs-service and mfs-transfer descriptors without owning their semantics", async () => {
  const registry = new DescriptorRegistry({ permissionValue: (value) => value === "write" ? 4 : 1 });
  registry.registerDirectory(path.join(root, "target/modules/mfs-service/server/acl"));
  registry.registerDirectory(path.join(root, "target/modules/mfs-transfer/server/acl"));
  const calls = [];
  const mfs_service = { async list(input, context) { calls.push(["list", input, context]); return { items: [], next_cursor: null }; } };
  const mfs_transfer = { uploadStatus(input, context) { calls.push(["upload-status", input, context]); return { transfer_id: input.transfer_id, status: "uploading" }; } };
  const dispatcher = new ServiceDispatcher({ registry, authorize: async () => ({ granted: true }), workerOptions: { mfs_service, mfs_transfer } });
  const session = { isAuthenticated: () => true, identity: () => ({ id: "a000000000000001" }) };
  assert.deepEqual(await dispatcher.dispatch({ service: "mfs.list", session, input: { location: { hub_id: "b000000000000002", nid: "c000000000000003" } } }), { items: [], next_cursor: null });
  assert.deepEqual(await dispatcher.dispatch({ service: "mfs-transfer.upload_status", session, input: { transfer_id: "transfer-1" } }), { transfer_id: "transfer-1", status: "uploading" });
  assert.equal(calls[0][2].principal_id, "a000000000000001");
  assert.equal(calls[1][2].principal_id, "a000000000000001");
});
