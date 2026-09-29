"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { zip } = require("./archive");
const { TransferStaging } = require("./staging");

class MfsTransferService {
  constructor({ mfs_service, staging, content_reader, progress, archive_async_threshold = 5 * 1024 * 1024 } = {}) {
    if (!mfs_service) throw new Error("mfs-transfer requires mfs-service");
    this.mfs_service = mfs_service;
    this.staging = staging || new TransferStaging();
    this.content_reader = content_reader || (async () => Buffer.alloc(0));
    this.progress = progress || { publishOperation: async () => {} };
    this.archive_async_threshold = archive_async_threshold;
    this.uploads = new Map();
    this.downloads = new Map();
  }

  async uploadStart(input, context) {
    const transfer_id = input.transfer_id || crypto.randomUUID();
    if (this.uploads.has(transfer_id)) {
      const existing = this.requireUpload(transfer_id, context);
      return { transfer_id, status: existing.status, chunks: [...existing.chunks.keys()].sort((a, b) => a - b), uploaded: [...existing.chunks.values()].reduce((sum, chunk) => sum + chunk.size, 0), result: existing.result || null };
    }
    await this.mfs_service.authorizeUpload({ destination: input.destination, metadata: input.metadata || {}, size: Number(input.size || 0) }, context);
    const stage = this.staging.create();
    this.uploads.set(transfer_id, {
      transfer_id, stage, destination: input.destination, metadata: input.metadata || {},
      operation_id: input.operation_id || transfer_id, size: Number(input.size || 0), chunks: new Map(), status: "uploading", context
    });
    return { transfer_id, status: "uploading" };
  }

  async uploadChunk(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    if (job.status !== "uploading") throw new Error("Upload is not accepting chunks");
    const index = Number(input.index);
    if (!Number.isInteger(index) || index < 0) throw new Error("Upload chunk index is invalid");
    const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || "", input.encoding || "base64");
    const filename = path.join(job.stage.directory, `${index}.chunk`);
    fs.writeFileSync(filename, data);
    job.chunks.set(index, { filename, size: data.length });
    const uploaded = [...job.chunks.values()].reduce((sum, chunk) => sum + chunk.size, 0);
    await this.report(job, { domain: "transfer", type: "upload.progress", loaded: uploaded, total: job.size });
    return { transfer_id: job.transfer_id, uploaded, chunks: job.chunks.size };
  }

  uploadStatus(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    return { transfer_id: job.transfer_id, status: job.status, chunks: [...job.chunks.keys()].sort((a, b) => a - b), size: job.size };
  }

  async uploadComplete(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    const chunks = [...job.chunks.entries()].sort((left, right) => left[0] - right[0]);
    const filename = "assembled.payload";
    const output = path.join(job.stage.directory, filename);
    const hash = crypto.createHash("sha256");
    const handle = fs.openSync(output, "w");
    try {
      for (const [, chunk] of chunks) {
        const data = fs.readFileSync(chunk.filename);
        fs.writeSync(handle, data);
        hash.update(data);
      }
    } finally {
      fs.closeSync(handle);
    }
    const digest = hash.digest("hex");
    if (input.sha256 && input.sha256 !== digest) {
      job.status = "failed";
      this.staging.release({ token: job.stage.token });
      throw Object.assign(new Error("Upload integrity check failed"), { code: "MFS_UPLOAD_INTEGRITY" });
    }
    job.status = "committing";
    const payload_ref = this.staging.payloadRef(job.stage.token, filename);
    try {
      const committed = await this.mfs_service.commitUpload({ destination: job.destination, payload_ref, metadata: job.metadata, operation_id: job.operation_id }, context || job.context);
      job.status = "done";
      job.result = committed;
      this.staging.release(payload_ref);
      await this.report(job, { domain: "transfer", type: "upload.done", result: committed });
      return { transfer_id: job.transfer_id, sha256: digest, ...committed };
    } catch (error) {
      job.status = "failed";
      job.error = error;
      this.staging.release({ token: job.stage.token });
      throw error;
    }
  }

  async uploadAbort(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    job.status = "cancelled";
    this.staging.release({ token: job.stage.token });
    await this.report(job, { domain: "transfer", type: "upload.cancelled" });
    return { transfer_id: job.transfer_id, status: job.status };
  }

  async downloadPrepare(input, context) {
    const transfer_id = input.transfer_id || crypto.randomUUID();
    const manifest = await this.mfs_service.authorizeDownload({ roots: input.roots }, context);
    const total = manifest.entries.reduce((sum, entry) => sum + Number(entry.filesize || 0), 0);
    const job = { transfer_id, operation_id: input.operation_id || transfer_id, status: "preparing", manifest, total, context, cancelled: false };
    this.downloads.set(transfer_id, job);
    if (total > this.archive_async_threshold) {
      setImmediate(() => this.prepareArchive(job).catch((error) => { job.status = "failed"; job.error = error; }));
      return { transfer_id, status: "preparing", total };
    }
    await this.prepareArchive(job);
    return { transfer_id, status: job.status, total, size: job.archive.length };
  }

  async prepareArchive(job) {
    const entries = [];
    let loaded = 0;
    const roots = new Map(job.manifest.roots.map((root) => [`${root.hub_id}:${root.nid}`, root]));
    const root_entries = new Map(job.manifest.entries.filter((entry) => roots.has(`${entry.hub_id}:${entry.nid}`)).map((entry) => [`${entry.hub_id}:${entry.nid}`, entry]));
    for (const item of job.manifest.entries) {
      if (job.cancelled) return;
      const root_id = item.root_nid || (roots.has(`${item.hub_id}:${item.nid}`) ? item.nid : null);
      const root = root_id && root_entries.get(`${item.hub_id}:${root_id}`);
      const root_name = root && (root.filename || `root-${root.nid}`);
      const relative = root && item.nid !== root.nid ? String(item.filepath || "").slice(String(item.root_path || root.filepath || "").length).replace(/^\/+/, "") : "";
      const name = root ? (relative ? `${root_name}/${relative}` : root_name) : item.filepath.replace(/^\/+/, "");
      if (["folder", "root"].includes(item.filetype)) entries.push({ name: `${name.replace(/\/$/, "")}/`, data: Buffer.alloc(0), directory: true });
      else {
        const data = await this.content_reader(item.storage_ref, item);
        entries.push({ name, data });
        loaded += data.length;
      }
      await this.report(job, { domain: "transfer", type: "download.progress", loaded, total: job.total });
    }
    if (job.cancelled) return;
    job.archive = zip(entries);
    job.status = "ready";
    await this.report(job, { domain: "transfer", type: "download.ready", size: job.archive.length });
  }

  downloadStatus(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    return { transfer_id: job.transfer_id, status: job.status, total: job.total, size: job.archive && job.archive.length || 0 };
  }

  async downloadCancel(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    job.cancelled = true;
    job.status = "cancelled";
    job.archive = null;
    await this.report(job, { domain: "transfer", type: "download.cancelled" });
    return { transfer_id: job.transfer_id, status: job.status };
  }

  downloadRetrieve(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    if (job.status !== "ready" || !job.archive) throw Object.assign(new Error("Archive is not ready"), { code: "MFS_ARCHIVE_NOT_READY" });
    return { transfer_id: job.transfer_id, content_type: "application/zip", data: job.archive };
  }

  downloadRelease(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    job.archive = null;
    this.downloads.delete(job.transfer_id);
    return { transfer_id: job.transfer_id, status: "released" };
  }

  requireUpload(id, context) { const job = this.uploads.get(id); if (!job) throw Object.assign(new Error("Upload not found"), { code: "MFS_UPLOAD_NOT_FOUND" }); this.requireOwner(job, context); return job; }
  requireDownload(id, context) { const job = this.downloads.get(id); if (!job) throw Object.assign(new Error("Download not found"), { code: "MFS_DOWNLOAD_NOT_FOUND" }); this.requireOwner(job, context); return job; }
  requireOwner(job, context) { const owner = job.context && job.context.principal_id; if (!owner || !context || context.principal_id !== owner) throw Object.assign(new Error("Transfer operation belongs to another principal"), { code: "MFS_TRANSFER_FORBIDDEN" }); }
  report(job, event) { return this.progress.publishOperation({ operation_id: job.operation_id, transfer_id: job.transfer_id, principal: job.context && job.context.principal_id, event }); }
  destroy() { for (const job of this.uploads.values()) this.staging.release({ token: job.stage.token }); this.uploads.clear(); this.downloads.clear(); }
}

module.exports = { MfsTransferService };
