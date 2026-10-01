"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { HostFilesystem } = require("../../host-filesystem/lib");
const { MfsTransferService, TransferStaging } = require("../lib");

const principal_id = "a000000000000001";
const destination = { hub_id: "b000000000000002", nid: "c000000000000003" };
function environment(prefix) { const root = fs.mkdtempSync(path.join(os.tmpdir(), prefix)); const staging = new TransferStaging({ root: path.join(root, "transfers") }); return { root, staging, host: new HostFilesystem({ root }) }; }
function incoming(env, name, content) { const filename = path.join(env.root, name); fs.writeFileSync(filename, content); return filename; }
async function ready(service, transfer_id) { for (let attempt = 0; attempt < 100; attempt++) { const value = service.downloadStatus({ transfer_id }, { uid: principal_id }); if (value.status === "ready") return value; await new Promise((resolve) => setTimeout(resolve, 25)); } throw new Error("archive did not become ready"); }

test("upload writes out-of-order and duplicate chunks into one sparse staged payload", async (t) => {
  const env = environment("mfs-transfer-upload-"); t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  const commits = []; const progress = [];
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, max_jobs: 2, upload_chunk_size: 2, max_upload_chunk_size: 4, mfs_service: { async prepareUpload({ destination }) { return { destination }; }, async commitUpload(input) { const filename = env.staging.claim(input.payload_ref); commits.push(fs.readFileSync(filename)); return { operation_id: input.operation_id, result: { ...destination, nid: "d000000000000004" } }; } }, progress: { async publishOperation(value) { progress.push(value); } } });
  const started = await service.uploadStart({ destination, size: 5, operation_id: "upload-1", metadata: { size: 5 } }, { uid: principal_id });
  assert.equal(started.chunk_size, 2);
  const sparse = service.uploads.get(started.transfer_id).payload_file;
  assert.equal(fs.statSync(sparse).size, 5);
  assert.throws(() => service.uploadStatus({ transfer_id: started.transfer_id }, { uid: "b000000000000002" }), (error) => error.code === "MFS_TRANSFER_FORBIDDEN");
  const denied_file = incoming(env, "denied.tmp", "he");
  await assert.rejects(() => service.uploadChunk({ transfer_id: started.transfer_id, index: 0, uploaded_file: denied_file }, { uid: "b000000000000002" }), (error) => error.code === "MFS_TRANSFER_FORBIDDEN");
  assert.equal(fs.existsSync(denied_file), false);
  await assert.rejects(() => service.uploadComplete({ transfer_id: started.transfer_id }, { uid: "b000000000000002" }), (error) => error.code === "MFS_TRANSFER_FORBIDDEN");
  await assert.rejects(() => service.uploadAbort({ transfer_id: started.transfer_id }, { uid: "b000000000000002" }), (error) => error.code === "MFS_TRANSFER_FORBIDDEN");
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 2, uploaded_file: incoming(env, "chunk-2.tmp", "o") }, { uid: principal_id });
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 0, uploaded_file: incoming(env, "chunk-0.tmp", "he") }, { uid: principal_id });
  assert.deepEqual(service.uploadStatus({ transfer_id: started.transfer_id }, { uid: principal_id }).chunks, [0, 2]);
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 0, uploaded_file: incoming(env, "chunk-0-retry.tmp", "HE") }, { uid: principal_id });
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 1, uploaded_file: incoming(env, "chunk-1.tmp", "ll") }, { uid: principal_id });
  assert.deepEqual((await service.uploadStart({ transfer_id: started.transfer_id, destination }, { uid: principal_id })).chunks, [0, 1, 2]);
  const completed = await service.uploadComplete({ transfer_id: started.transfer_id }, { uid: principal_id });
  assert.equal(completed.result.nid, "d000000000000004"); assert.equal(commits[0].toString(), "HEllo"); assert.equal(service.uploads.size, 0);
  assert.ok(progress.every((entry) => entry.principal === principal_id));
});

test("upload completion fails closed on missing chunks, invalid geometry and hash mismatch", async (t) => {
  const env = environment("mfs-transfer-integrity-");
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, upload_chunk_size: 2, max_upload_chunk_size: 2, mfs_service: { async prepareUpload({ destination }) { return { destination }; }, async commitUpload() { throw new Error("must not commit"); } } });
  t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  const started = await service.uploadStart({ destination, size: 3 }, { uid: principal_id });
  await assert.rejects(() => service.uploadComplete({ transfer_id: started.transfer_id }, { uid: principal_id }), (error) => error.code === "MFS_UPLOAD_INCOMPLETE");
  const wrong = incoming(env, "wrong-final.tmp", "xx");
  await assert.rejects(() => service.uploadChunk({ transfer_id: started.transfer_id, index: 1, uploaded_file: wrong }, { uid: principal_id }), (error) => error.code === "MFS_UPLOAD_CHUNK_INVALID");
  assert.equal(fs.existsSync(wrong), false);
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 1, uploaded_file: incoming(env, "final.tmp", "c") }, { uid: principal_id });
  await service.uploadChunk({ transfer_id: started.transfer_id, index: 0, uploaded_file: incoming(env, "first.tmp", "ab") }, { uid: principal_id });
  await assert.rejects(() => service.uploadComplete({ transfer_id: started.transfer_id, sha256: "0".repeat(64) }, { uid: principal_id }), (error) => error.code === "MFS_UPLOAD_INTEGRITY");
  assert.equal(service.uploads.size, 0);
});

test("download uses filesystem references and an offline archive process", async (t) => {
  const env = environment("mfs-transfer-download-"); t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  fs.mkdirSync(path.join(env.root, "content")); fs.writeFileSync(path.join(env.root, "content", "a.txt"), "abc"); fs.writeFileSync(path.join(env.root, "content", "loose.txt"), "loose");
  const loose = { hub_id: destination.hub_id, nid: "f000000000000006" }; const progress = [];
  const manifest = { roots: [destination, loose], entries: [{ ...destination, filename: "Docs", filepath: "/Docs", root_nid: destination.nid, root_path: "/Docs", filetype: "folder" }, { hub_id: destination.hub_id, nid: "e000000000000005", filename: "a.txt", filepath: "/Docs/Sub/a.txt", root_nid: destination.nid, root_path: "/Docs", filetype: "file", storage_ref: { type: "local-content", relative: "content/a.txt" } }, { ...loose, filename: "loose.txt", filepath: "/loose.txt", root_nid: loose.nid, root_path: "/loose.txt", filetype: "file", storage_ref: { type: "local-content", relative: "content/loose.txt" } }] };
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, mfs_service: { async prepareDownload() { return structuredClone(manifest); } }, progress: { async publishOperation(value) { progress.push(value); } } });
  const prepared = await service.downloadPrepare({ roots: manifest.roots, operation_id: "download-1" }, { uid: principal_id });
  assert.equal(prepared.status, "preparing"); await ready(service, prepared.transfer_id);
  const result = service.downloadRetrieve({ transfer_id: prepared.transfer_id }, { uid: principal_id });
  assert.equal(Buffer.isBuffer(result.artifact), false); assert.equal(fs.existsSync(result.artifact.path), true); assert.equal(Object.hasOwn(service.downloads.get(prepared.transfer_id), "archive"), false); assert.equal(service.downloads.get(prepared.transfer_id).worker, null);
  assert.ok(progress.some((entry) => entry.event.type === "download.ready"));
  const directory = service.downloads.get(prepared.transfer_id).stage.directory;
  assert.equal(service.downloadRelease({ transfer_id: prepared.transfer_id }, { uid: principal_id }).status, "released"); assert.equal(fs.existsSync(directory), false);
});

test("cancel, failure and expiry clean workers and artifacts", async (t) => {
  const env = environment("mfs-transfer-lifetime-"); let clock = 1; const kills = [];
  const pending_worker = { start({ job_dir }) { return { child: { kill() { kills.push(job_dir); } }, promise: new Promise(() => {}) }; } };
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, archive_worker: pending_worker, ttl_ms: 10, now: () => clock, mfs_service: { async prepareDownload({ roots }) { return { roots, entries: [] }; }, async prepareUpload({ destination }) { return { destination }; } } });
  t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  const cancelled = await service.downloadPrepare({ roots: [destination] }, { uid: principal_id }); const cancel_dir = service.downloads.get(cancelled.transfer_id).stage.directory;
  await service.downloadCancel({ transfer_id: cancelled.transfer_id }, { uid: principal_id }); assert.equal(fs.existsSync(cancel_dir), false); assert.equal(kills.length, 1);
  const stale = await service.downloadPrepare({ roots: [destination] }, { uid: principal_id }); const stale_dir = service.downloads.get(stale.transfer_id).stage.directory; clock = 20; service.cleanupExpired();
  assert.equal(service.downloads.size, 0); assert.equal(fs.existsSync(stale_dir), false); assert.equal(kills.length, 2);
});

test("archive failure releases filesystem artifacts and remains bounded until expiry", async (t) => {
  const env = environment("mfs-transfer-failure-"); let clock = 1;
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, ttl_ms: 10, now: () => clock, archive_worker: { start() { return { child: { kill() {} }, promise: Promise.reject(Object.assign(new Error("archive failed"), { code: "ARCHIVE_FAILED" })) }; } }, mfs_service: { async prepareDownload({ roots }) { return { roots, entries: [] }; } } });
  t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  const prepared = await service.downloadPrepare({ roots: [destination] }, { uid: principal_id });
  const directory = service.downloads.get(prepared.transfer_id).stage.directory;
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(service.downloads.get(prepared.transfer_id).status, "failed");
  assert.equal(service.downloads.get(prepared.transfer_id).worker, null);
  assert.equal(fs.existsSync(directory), false);
  clock = 20; service.cleanupExpired();
  assert.equal(service.downloads.size, 0);
});

test("Input tempfile ownership transfers once and canonical content survives cleanup", async (t) => {
  const env = environment("mfs-transfer-input-"); t.after(() => { service.destroy(); fs.rmSync(env.root, { recursive: true, force: true }); });
  const input_file = path.join(env.root, "input.tmp"); const canonical = path.join(env.root, "canonical-content"); fs.writeFileSync(input_file, "from Input");
  const service = new MfsTransferService({ staging: env.staging, host_filesystem: env.host, upload_chunk_size: 10, max_upload_chunk_size: 10, mfs_service: { async prepareUpload({ destination }) { return { destination }; }, async commitUpload(input) { fs.renameSync(env.staging.claim(input.payload_ref), canonical); return { result: { ...destination, filename: "committed.txt" } }; } } });
  const started = await service.uploadStart({ destination, size: 10 }, { uid: principal_id }); await service.uploadChunk({ transfer_id: started.transfer_id, index: 0, uploaded_file: input_file }, { uid: principal_id });
  assert.equal(fs.existsSync(input_file), false); const completed = await service.uploadComplete({ transfer_id: started.transfer_id }, { uid: principal_id });
  assert.equal(fs.readFileSync(canonical, "utf8"), "from Input"); assert.equal(JSON.stringify(completed).includes("payload_ref"), false); assert.equal(fs.existsSync(canonical), true);
});

test("backend boundaries retain semantic separation", () => {
  const source = fs.readdirSync(path.resolve(__dirname, "../lib")).filter((name) => name.endsWith(".js")).map((name) => fs.readFileSync(path.resolve(__dirname, "../lib", name), "utf8")).join("\n");
  assert.doesNotMatch(source, /@drumee\/system-mfs|job\.archive\s*=|content_reader/);
});
