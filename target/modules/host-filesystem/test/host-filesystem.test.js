"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const { FileIo, HostFilesystem } = require("../lib");

test("logical content resolves through one safe host-filesystem boundary", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-hostfs-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  fs.mkdirSync(path.join(root, "content"));
  fs.writeFileSync(path.join(root, "content", "original.docx"), "office-original");
  const host = new HostFilesystem({ root });
  const node = { hub_id: "a000000000000001", nid: "b000000000000002", filename: "report.docx", mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", storage_ref: { type: "local-content", relative: "content/original.docx" } };
  const original = host.original(node);
  assert.equal(fs.readFileSync(original.path, "utf8"), "office-original");
  const opaque_node = { ...node, storage_ref: `mfs-content:${node.hub_id}:${node.nid}` };
  fs.mkdirSync(path.join(root, node.hub_id));
  fs.writeFileSync(path.join(root, node.hub_id, node.nid), "opaque-original");
  assert.equal(fs.readFileSync(host.original(opaque_node).path, "utf8"), "opaque-original");
  assert.match(host.derived(node, "document").path, /representations.*document\.pdf$/);
  assert.throws(() => host.original({ ...node, storage_ref: { type: "local-content", relative: "../escape" } }), (error) => error.code === "HOST_ORIGINAL_INVALID");
  assert.throws(() => host.derived(node, "client-generator"), (error) => error.code === "MEDIA_REPRESENTATION_INVALID");
});

test("cross-filesystem move fallback and safety locks are enforced", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-hostfs-move-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const host = new HostFilesystem({ root, rename() { const error = new Error("cross device"); error.code = "EXDEV"; throw error; } });
  const source = path.join(root, "source"); const destination = path.join(root, "nested", "destination");
  fs.writeFileSync(source, "move-me");
  host.move(source, destination);
  assert.equal(fs.readFileSync(destination, "utf8"), "move-me");
  assert.equal(fs.existsSync(source), false);
  fs.writeFileSync(path.join(root, ".drumee-safety-lock"), "locked");
  assert.throws(() => host.remove(destination), (error) => error.code === "HOST_PATH_LOCKED");
});

test("FileIo emits internal redirect headers without returning physical paths", (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-fileio-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const filename = path.join(root, "download.zip"); fs.writeFileSync(filename, "PK\u0003\u0004fixture");
  const host = new HostFilesystem({ root });
  const file_io = new FileIo({ host_filesystem: host });
  const headers = file_io.headers(host.artifact(filename, "download.zip", "application/zip"));
  assert.equal(headers["Content-Type"], "application/zip");
  assert.equal(headers["Content-Length"], 11);
  assert.match(headers["X-Accel-Redirect"], /^\/__drumee_artifacts\//);
  assert.equal(JSON.stringify(headers).includes(root), false);
});
