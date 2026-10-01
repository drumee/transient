"use strict";

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const base = `http://127.0.0.1:${process.env.KERNEL_HTTP_PORT || 28642}`;
const hub_id = "b000000000000002";
const download_nid = "d000000000000004";
const media_nid = "e000000000000005";
const upload_root_nid = "f000000000000006";

async function service(name, input, method = "POST") {
  const response = await fetch(`${base}/-/svc/${name}`, { method, headers: method === "GET" ? {} : { "content-type": "application/json" }, body: method === "GET" ? undefined : JSON.stringify(input) });
  const value = await response.json();
  assert.equal(response.status, 200, JSON.stringify(value));
  return value.data;
}

test("Nginx delivers a filesystem ZIP prepared outside the HTTP process", async (t) => {
  const prepared = await service("mfs-transfer.download_prepare", { roots: [{ hub_id, nid: download_nid }] });
  t.after(async () => { await service("mfs-transfer.download_release", { transfer_id: prepared.transfer_id }).catch(() => {}); });
  let status;
  for (let attempt = 0; attempt < 100; attempt++) {
    status = await service("mfs-transfer.download_status", { transfer_id: prepared.transfer_id });
    if (status.status === "ready") break;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  assert.equal(status.status, "ready");
  const response = await fetch(`${base}/-/svc/mfs-transfer.download_retrieve?transfer_id=${encodeURIComponent(prepared.transfer_id)}`);
  const archive = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");
  assert.match(response.headers.get("content-disposition"), /download\.zip/);
  assert.deepEqual([...archive.subarray(0, 4)], [80, 75, 3, 4]);
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-nginx-"));
  const filename = path.join(directory, "download.zip");
  fs.writeFileSync(filename, archive);
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const content = child_process.execFileSync("unzip", ["-p", filename]);
  assert.equal(content.length, 256 * 1024);
  assert.equal(content.subarray(0, Buffer.byteLength("phase48-download-original\n")).toString(), "phase48-download-original\n");
  await service("mfs-transfer.download_release", { transfer_id: prepared.transfer_id });
});

test("Nginx delivers media.orig as the unchanged heavy original", async () => {
  const response = await fetch(`${base}/-/svc/media.orig?hub_id=${hub_id}&nid=${media_nid}`);
  const content = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200);
  assert.equal(content.length, 2 * 1024 * 1024);
  assert.equal(content.subarray(0, Buffer.byteLength("phase48-media-original\n")).toString(), "phase48-media-original\n");
  assert.match(response.headers.get("content-disposition"), /phase48-media\.bin/);
});

test("real HTTP binary upload streams out-of-order chunks into canonical content", async () => {
  const size = 2 * 1024 * 1024 + 512 * 1024;
  const content = Buffer.allocUnsafe(size);
  for (let index = 0; index < content.length; index += 1) content[index] = index % 251;
  const started = await service("mfs-transfer.upload_start", { destination: { hub_id, nid: upload_root_nid }, size, metadata: { filename: "binary-upload.bin", size, mimetype: "application/octet-stream", filetype: "file" } });
  assert.equal(started.chunk_size, 1024 * 1024);
  const send = async (index) => {
    const offset = index * started.chunk_size;
    const body = content.subarray(offset, Math.min(offset + started.chunk_size, size));
    const response = await fetch(`${base}/-/svc/mfs-transfer.upload_chunk?transfer_id=${encodeURIComponent(started.transfer_id)}&index=${index}`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body });
    const envelope = await response.json(); assert.equal(response.status, 200, JSON.stringify(envelope)); return envelope.data;
  };
  await send(2); await send(0);
  const resumed = await service("mfs-transfer.upload_status", { transfer_id: started.transfer_id });
  assert.deepEqual(resumed.chunks, [0, 2]);
  await send(0); await send(1);
  const sha256 = crypto.createHash("sha256").update(content).digest("hex");
  const completed = await service("mfs-transfer.upload_complete", { transfer_id: started.transfer_id, sha256 });
  const node = completed.result;
  const original = await fetch(`${base}/-/svc/media.orig?hub_id=${node.hub_id}&nid=${node.nid}`);
  const received = Buffer.from(await original.arrayBuffer());
  assert.equal(received.length, content.length); assert.equal(crypto.createHash("sha256").update(received).digest("hex"), sha256);
});

test("real HTTP upload rejects a chunk above the server maximum", async () => {
  const started = await service("mfs-transfer.upload_start", { destination: { hub_id, nid: upload_root_nid }, size: 1024 * 1024, metadata: { filename: "oversized.bin", size: 1024 * 1024 } });
  const response = await fetch(`${base}/-/svc/mfs-transfer.upload_chunk?transfer_id=${encodeURIComponent(started.transfer_id)}&index=0`, { method: "POST", headers: { "content-type": "application/octet-stream" }, body: Buffer.alloc(2 * 1024 * 1024 + 1) });
  assert.equal(response.status, 413); assert.equal((await response.json()).code, "UPLOAD_CHUNK_TOO_LARGE");
  await service("mfs-transfer.upload_abort", { transfer_id: started.transfer_id });
});
