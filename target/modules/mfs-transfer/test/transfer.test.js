"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { MfsTransferService, TransferStaging } = require("../lib");

const principal_id = "a000000000000001";
const destination = { hub_id: "b000000000000002", nid: "c000000000000003" };

test("upload stages chunks, commits once through mfs-service and scopes progress", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mfs-transfer-test-"));
  const staging = new TransferStaging({ root });
  t.after(() => staging.destroy());
  const commits = [];
  const progress = [];
  const service = new MfsTransferService({
    staging,
    mfs_service: { async authorizeUpload() { return { granted: true }; }, async commitUpload(input) { const filename = staging.claim(input.payload_ref); commits.push({ input, bytes: fs.readFileSync(filename) }); return { operation_id: input.operation_id, result: { hub_id: destination.hub_id, nid: "d000000000000004" } }; } },
    progress: { async publishOperation(value) { progress.push(value); } }
  });
  const started = await service.uploadStart({ destination, size: 5, metadata: { filename: "hello.txt" }, operation_id: "upload-1" }, { principal_id });
  assert.throws(() => service.uploadStatus({ transfer_id: started.transfer_id }, { principal_id: "b000000000000002" }), (error) => error.code === "MFS_TRANSFER_FORBIDDEN");
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 1, data: Buffer.from("lo") }, { principal_id });
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 0, data: Buffer.from("hel") }, { principal_id });
  const resumed = await service.uploadStart({ transfer_id: started.transfer_id, destination, size: 5 }, { principal_id });
  assert.deepEqual(resumed.chunks, [0, 1]);
  assert.equal(resumed.uploaded, 5);
  const completed = await service.uploadComplete({ transfer_id: started.transfer_id }, { principal_id });
  assert.equal(completed.result.nid, "d000000000000004");
  assert.equal(commits.length, 1);
  assert.equal(commits[0].bytes.toString(), "hello");
  assert.equal(commits[0].input.payload_ref.type, "mfs-staged-payload");
  assert.ok(progress.every((entry) => entry.operation_id === "upload-1" && entry.principal === principal_id));
});

test("download uses an authorized manifest, builds an archive and supports cancel/release", async () => {
  const progress = [];
  const loose = { hub_id: destination.hub_id, nid: "f000000000000006" };
  const service = new MfsTransferService({
    archive_async_threshold: 100,
    mfs_service: { async authorizeDownload({ roots }) { return { roots, entries: [{ ...roots[0], filename: "Docs", filepath: "/Docs", root_nid: roots[0].nid, root_path: "/Docs", filetype: "folder", filesize: 0 }, { hub_id: roots[0].hub_id, nid: "e000000000000005", filename: "a.txt", filepath: "/Docs/Sub/a.txt", root_nid: roots[0].nid, root_path: "/Docs", filetype: "file", filesize: 3, storage_ref: "content-a" }, { ...roots[1], filename: "loose.txt", filepath: "/loose.txt", root_nid: roots[1].nid, root_path: "/loose.txt", filetype: "file", filesize: 5, storage_ref: "content-loose" }] }; } },
    content_reader: async (ref) => ref === "content-a" ? Buffer.from("abc") : Buffer.from("loose"),
    progress: { async publishOperation(value) { progress.push(value); } }
  });
  const prepared = await service.downloadPrepare({ roots: [destination, loose], operation_id: "download-1" }, { principal_id });
  assert.equal(prepared.status, "ready");
  const archive = service.downloadRetrieve({ transfer_id: prepared.transfer_id }, { principal_id });
  assert.equal(archive.data.readUInt32LE(0), 0x04034b50);
  assert.ok(archive.data.includes(Buffer.from("Docs/Sub/a.txt")));
  assert.ok(archive.data.includes(Buffer.from("loose.txt")));
  assert.ok(progress.every((entry) => entry.operation_id === "download-1" && entry.principal === principal_id));
  assert.equal(service.downloadRelease({ transfer_id: prepared.transfer_id }, { principal_id }).status, "released");

  const async_service = new MfsTransferService({ archive_async_threshold: 0, mfs_service: service.mfs_service, content_reader: service.content_reader });
  const waiting = await async_service.downloadPrepare({ roots: [destination, loose] }, { principal_id });
  assert.equal(waiting.status, "preparing");
  assert.equal((await async_service.downloadCancel({ transfer_id: waiting.transfer_id }, { principal_id })).status, "cancelled");
});

test("upload cancel and integrity failure clean temporary staging", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "mfs-transfer-cleanup-"));
  const staging = new TransferStaging({ root });
  t.after(() => staging.destroy());
  const service = new MfsTransferService({ staging, mfs_service: { async authorizeUpload() { return { granted: true }; }, async commitUpload() { throw new Error("must not commit"); }, async authorizeDownload() { return { roots: [], entries: [] }; } } });
  const cancelled = await service.uploadStart({ destination, size: 1 }, { principal_id });
  await service.uploadChunk({ transfer_id: cancelled.transfer_id, index: 0, data: Buffer.from("x") }, { principal_id });
  await service.uploadAbort({ transfer_id: cancelled.transfer_id }, { principal_id });
  assert.equal(staging.payloads.size, 0);
  const failed = await service.uploadStart({ destination, size: 1 }, { principal_id });
  await service.uploadChunk({ transfer_id: failed.transfer_id, index: 0, data: Buffer.from("x") }, { principal_id });
  await assert.rejects(() => service.uploadComplete({ transfer_id: failed.transfer_id, sha256: "wrong" }, { principal_id }), (error) => error.code === "MFS_UPLOAD_INTEGRITY");
  assert.equal(staging.payloads.size, 0);
});

test("backend boundaries do not acquire forbidden semantic or transport dependencies", () => {
  const transfer_source = fs.readdirSync(path.resolve(__dirname, "../lib")).filter((name) => name.endsWith(".js")).map((name) => fs.readFileSync(path.resolve(__dirname, "../lib", name), "utf8")).join("\n");
  const service_source = fs.readdirSync(path.resolve(__dirname, "../../mfs-service/lib")).filter((name) => name.endsWith(".js")).map((name) => fs.readFileSync(path.resolve(__dirname, "../../mfs-service/lib", name), "utf8")).join("\n");
  assert.doesNotMatch(transfer_source, /@drumee\/system-mfs|require\([^)]*system-mfs/);
  assert.doesNotMatch(service_source, /WebSocket|socket_get|ioredis|require\([^)]*redis/);
});
