"use strict";

const assert = require("node:assert/strict");
const events = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { FileIo, HostFilesystem } = require("../../host-filesystem/lib");
const { MediaService, RepresentationManager } = require("../lib");

const hub_id = "a000000000000001";
const ids = { image: "b000000000000002", document: "c000000000000003", video: "d000000000000004" };

test("media.orig always resolves canonical image, Office and video originals", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-media-orig-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const nodes = new Map(); fs.mkdirSync(path.join(root, "content"));
  for (const [type, nid] of Object.entries(ids)) { const ext = { image: "png", document: "docx", video: "mov" }[type]; const relative = `content/${type}.${ext}`; fs.writeFileSync(path.join(root, relative), `${type}-original`); nodes.set(nid, { hub_id, nid, filename: `${type}.${ext}`, filetype: type, mimetype: "application/octet-stream", storage_ref: { type: "local-content", relative } }); }
  const host = new HostFilesystem({ root });
  const manager = new RepresentationManager({ host_filesystem: host, generators: {} });
  const service = new MediaService({ node_resolver: ({ nid }) => nodes.get(nid), host_filesystem: host, representations: manager });
  for (const [type, nid] of Object.entries(ids)) { const result = await service.resolve("orig", { hub_id, nid }); assert.equal(fs.readFileSync(result.artifact.path, "utf8"), `${type}-original`); assert.equal(result.artifact.path.includes("representations"), false); }
});

test("known derived services reuse artifacts and arbitrary generators are impossible", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-media-derived-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "content")); fs.writeFileSync(path.join(root, "content", "source.bin"), "source");
  const node = { hub_id, nid: ids.image, filename: "source.png", filetype: "image", storage_ref: { type: "local-content", relative: "content/source.bin" } };
  const calls = [];
  const host = new HostFilesystem({ root });
  const generators = Object.fromEntries(["preview", "thumb", "document", "video"].map((name) => [name, async ({ destination }) => { calls.push(name); fs.writeFileSync(destination, name); }]));
  const manager = new RepresentationManager({ host_filesystem: host, generators });
  const service = new MediaService({ node_resolver: () => node, host_filesystem: host, representations: manager });
  for (const representation of ["preview", "thumb", "document", "video"]) assert.equal((await service.resolve(representation, { hub_id, nid: node.nid })).artifact.exists, true);
  await service.resolve("preview", { hub_id, nid: node.nid });
  assert.deepEqual(calls, ["preview", "thumb", "document", "video"]);
  await assert.rejects(() => service.resolve("create_anything", { hub_id, nid: node.nid }), (error) => error.code === "MEDIA_REPRESENTATION_INVALID");
});

test("HLS playlists are bounded control artifacts while segments use FileIo", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-media-hls-")); t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "content")); fs.writeFileSync(path.join(root, "content", "video.mov"), "video-original");
  const node = { hub_id, nid: ids.video, filename: "video.mov", filetype: "video", storage_ref: { type: "local-content", relative: "content/video.mov" } };
  const host = new HostFilesystem({ root });
  let starts = 0; let detached = 0;
  const manager = new RepresentationManager({ host_filesystem: host, hls_generator({ destination }) { starts += 1; fs.mkdirSync(path.join(path.dirname(destination), "stream-0"), { recursive: true }); fs.writeFileSync(destination, "#EXTM3U\nstream-0/playlist.m3u8"); fs.writeFileSync(path.join(path.dirname(destination), "stream-0", "playlist.m3u8"), "#EXTM3U\nsegment-0.ts"); fs.writeFileSync(path.join(path.dirname(destination), "stream-0", "segment-0.ts"), "segment-bytes"); const worker = new events.EventEmitter(); worker.unref = () => { detached += 1; }; worker.kill = () => {}; setImmediate(() => worker.emit("exit", 0)); return worker; } });
  const service = new MediaService({ node_resolver: () => node, host_filesystem: host, representations: manager });
  const master = await service.resolve("master", { hub_id, nid: node.nid }, { keysel: "trusted-selector" });
  assert.match(master.body, /playlist\.m3u8\?keysel=trusted-selector/);
  assert.equal(starts, 1); assert.equal(detached, 1); assert.equal(manager.workers.size, 1, "the first usable playlist returns before the finite conversion worker exits");
  await service.resolve("master", { hub_id, nid: node.nid }); assert.equal(starts, 1, "an existing master playlist is reused");
  const stream = await service.resolve("stream", { hub_id, nid: node.nid, serial: 0 }, { keysel: "trusted-selector" });
  assert.match(stream.body, /segment-0\.ts\?keysel=trusted-selector/);
  const segment = await service.resolve("segment", { hub_id, nid: node.nid, serial: 0, segment: 0 });
  const headers = new FileIo({ host_filesystem: host }).headers(segment.artifact);
  assert.equal(headers["Content-Type"], "video/MP2T");
  assert.equal(Object.hasOwn(segment, "body"), false);
  manager.stop(); assert.equal(manager.workers.size, 0);
});
