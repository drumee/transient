"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const { LocalContentStore, MfsFilesystem } = require(path.resolve(root, "../system-mfs"));
const { MfsEventPublisher, MfsService } = require(path.join(root, "target/modules/mfs-service/lib"));
const { MfsTransferService, TransferStaging } = require(path.join(root, "target/modules/mfs-transfer/lib"));

const principal_id = "a000000000000001";
const hub_id = "b000000000000002";
const destination = { hub_id, nid: "c000000000000003" };

class MemoryStore {
  constructor() { this.serial = 10; this.nodes = new Map([[`${hub_id}:${destination.nid}`, { ...destination, parent_id: "0", filename: "Root", filepath: "/", filetype: "root", owner_id: principal_id }]]); }
  key(node) { return `${node.hub_id}:${node.nid}`; }
  async resolveAccess() { return { allowed: true, permission: 63 }; }
  async reserveFile(_principal, parent, metadata) { return { hub_id: parent.hub_id, nid: (++this.serial).toString(16).padStart(16, "0"), destination: parent, filename: metadata.filename }; }
  async commitReservedFile(_principal, reservation, storage_ref, metadata) { const node = { hub_id: reservation.hub_id, nid: reservation.nid, parent_id: reservation.destination.nid, filename: reservation.filename, filepath: `/${reservation.filename}`, filetype: "file", filesize: metadata.size, storage_ref, metadata: { storage_ref } }; this.nodes.set(this.key(node), node); return structuredClone(node); }
  async releaseFileReservation() {}
  async enumerateTree(_principal, roots) { return { roots, entries: roots.map((root_node) => ({ ...structuredClone(this.nodes.get(this.key(root_node))), root_nid: root_node.nid, root_path: this.nodes.get(this.key(root_node)).filepath })) }; }
  async getNode(_principal, node) { return structuredClone(this.nodes.get(this.key(node))); }
}

test("upload staging commits through service/system-mfs and download returns authorized canonical bytes", async (t) => {
  const work = fs.mkdtempSync(path.join(os.tmpdir(), "phase48-transfer-boundary-"));
  const staging = new TransferStaging({ root: path.join(work, "staging") });
  const canonical = new LocalContentStore({ root: path.join(work, "canonical"), staging });
  t.after(() => fs.rmSync(work, { recursive: true, force: true }));
  const store = new MemoryStore();
  const published = [];
  const mfs_service = new MfsService({
    filesystem_factory: () => new MfsFilesystem({ store, principal: principal_id, content_store: canonical }),
    events: new MfsEventPublisher({ transport: { async publishRecipient(message) { published.push(message); } } })
  });
  const progress = [];
  const transfer = new MfsTransferService({ mfs_service, staging, content_reader: (ref) => canonical.read(ref), progress: { async publishOperation(event) { progress.push(event); } } });

  const upload = await transfer.uploadStart({ destination, size: 11, operation_id: "upload-boundary", metadata: { filename: "hello.txt", size: 11, mimetype: "text/plain", filetype: "text" } }, { uid: principal_id });
  await transfer.uploadChunk({ transfer_id: upload.transfer_id, index: 1, data: Buffer.from("world") }, { uid: principal_id });
  await transfer.uploadChunk({ transfer_id: upload.transfer_id, index: 0, data: Buffer.from("hello ") }, { uid: principal_id });
  const committed = await transfer.uploadComplete({ transfer_id: upload.transfer_id }, { uid: principal_id });
  assert.equal(committed.result.filename, "hello.txt");
  assert.equal(Object.hasOwn(committed.result, "storage_ref"), false);
  assert.equal((await canonical.read(canonical.ref({ hub_id, nid: committed.result.nid }))).toString(), "hello world");
  assert.equal(published.length, 1);
  assert.equal(published[0].payload.type, "node.created");
  assert.equal(published[0].payload.committed_from_transfer, true);

  const prepared = await transfer.downloadPrepare({ roots: [{ hub_id, nid: committed.result.nid }], operation_id: "download-boundary" }, { uid: principal_id });
  const archive = transfer.downloadRetrieve({ transfer_id: prepared.transfer_id }, { uid: principal_id }).data;
  assert.equal(archive.readUInt32LE(0), 0x04034b50);
  assert.ok(archive.includes(Buffer.from("hello.txt")));
  assert.ok(archive.includes(Buffer.from("hello world")));
  assert.ok(progress.filter((entry) => entry.operation_id === "download-boundary").every((entry) => entry.principal === principal_id));
  assert.equal(transfer.downloadRelease({ transfer_id: prepared.transfer_id }, { uid: principal_id }).status, "released");
});
