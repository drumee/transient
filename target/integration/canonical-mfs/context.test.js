"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const TransferWorker = require("../../modules/mfs-transfer/server/service/mfs-transfer");
const MediaWorker = require("../../modules/media-service/server/service/media");
const { MediaService } = require("../../modules/media-service/lib");

test("transfer worker forwards runtime-authorized Hub contexts, not browser authorities", async () => {
  const hub = Object.freeze({ hub_id: "a000000000000001", authorized: true });
  const hubs = Object.freeze({ [hub.hub_id]: hub });
  let observed;
  const worker = new TransferWorker({ session: { uid: () => "b000000000000002" }, hub_context: hub, hub_contexts: hubs, mfs_transfer: { async uploadStart(input, context) { observed = context; return {}; } } });
  await worker.upload_start({ hub_context: { authorized: false } });
  assert.equal(observed.hub_context, hub);
  assert.equal(observed.hub_contexts, hubs);
  assert.equal(observed.uid, "b000000000000002");
});

test("media worker and resolver retain authorized context through original resolution", async () => {
  const hub = Object.freeze({ hub_id: "a000000000000001", authorized: true });
  let observed;
  const service = new MediaService({ node_resolver: async (_node, context) => { observed = context; return { filename: "synthetic.txt" }; }, host_filesystem: { original: node => node }, representations: {} });
  const worker = new MediaWorker({ session: { uid: () => "b000000000000002", output: {} }, hub_context: hub, file_io: { send: () => null }, media_service: service });
  await worker.orig({ hub_id: hub.hub_id, nid: "c000000000000003", hub_context: { authorized: false } });
  assert.equal(observed.hub_context, hub);
  assert.equal(observed.uid, "b000000000000002");
});
