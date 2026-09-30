"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { ArchiveWorker } = require("./archive-worker");
const { TransferStaging } = require("./staging");

class MfsTransferService {
  constructor({ mfs_service, staging, host_filesystem, archive_worker, progress, ttl_ms = 15 * 60 * 1000, max_jobs = 128, now = () => Date.now() } = {}) {
    if (!mfs_service || !host_filesystem) throw new Error("mfs-transfer requires mfs-service and HostFilesystem");
    this.mfs_service = mfs_service;
    this.staging = staging || new TransferStaging();
    this.host_filesystem = host_filesystem;
    this.archive_worker = archive_worker || new ArchiveWorker({ host_filesystem });
    this.progress = progress || { publishOperation: async () => {} };
    this.ttl_ms = ttl_ms;
    this.max_jobs = max_jobs;
    this.now = now;
    this.uploads = new Map();
    this.downloads = new Map();
    this.cleanup_timer = setInterval(() => this.cleanupExpired(), Math.min(ttl_ms, 60000));
    if (typeof this.cleanup_timer.unref === "function") this.cleanup_timer.unref();
  }

  ensureCapacity() {
    this.cleanupExpired();
    if (this.uploads.size + this.downloads.size >= this.max_jobs) throw Object.assign(new Error("Transfer job capacity reached"), { code: "MFS_TRANSFER_CAPACITY" });
  }

  async uploadStart(input, context) {
    const transfer_id = input.transfer_id || crypto.randomUUID();
    if (this.uploads.has(transfer_id)) {
      const existing = this.requireUpload(transfer_id, context);
      return { transfer_id, status: existing.status, chunks: [...existing.chunks.keys()].sort((a, b) => a - b), uploaded: [...existing.chunks.values()].reduce((sum, chunk) => sum + chunk.size, 0), result: existing.result || null };
    }
    this.ensureCapacity();
    const prepared = await this.mfs_service.prepareUpload({ destination: input.destination, metadata: input.metadata || {}, size: Number(input.size || 0) }, context);
    const stage = this.staging.create();
    this.uploads.set(transfer_id, { transfer_id, stage, destination: prepared.destination, metadata: input.metadata || {}, operation_id: input.operation_id || transfer_id, size: Number(input.size || 0), chunks: new Map(), status: "uploading", context, expires_at: this.now() + this.ttl_ms });
    return { transfer_id, status: "uploading" };
  }

  async uploadChunk(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    if (job.status !== "uploading") throw new Error("Upload is not accepting chunks");
    const index = Number(input.index);
    if (!Number.isInteger(index) || index < 0) throw new Error("Upload chunk index is invalid");
    const filename = path.join(job.stage.directory, `${index}.chunk`);
    let size;
    if (input.uploaded_file) { this.staging.adoptInputFile(input.uploaded_file, job.stage.token, `${index}.chunk`); size = fs.statSync(filename).size; }
    else { const data = Buffer.isBuffer(input.data) ? input.data : Buffer.from(input.data || "", input.encoding || "base64"); fs.writeFileSync(filename, data); size = data.length; }
    job.chunks.set(index, { filename, size });
    job.expires_at = this.now() + this.ttl_ms;
    const uploaded = [...job.chunks.values()].reduce((sum, chunk) => sum + chunk.size, 0);
    await this.report(job, { domain: "transfer", type: "upload.progress", loaded: uploaded, total: job.size });
    return { transfer_id: job.transfer_id, uploaded, chunks: job.chunks.size };
  }

  uploadStatus(input, context) { const job = this.requireUpload(input.transfer_id, context); return { transfer_id: job.transfer_id, status: job.status, chunks: [...job.chunks.keys()].sort((a, b) => a - b), size: job.size }; }

  async uploadComplete(input, context) {
    const job = this.requireUpload(input.transfer_id, context);
    const filename = "assembled.payload";
    const output = path.join(job.stage.directory, filename);
    const hash = crypto.createHash("sha256");
    const handle = fs.openSync(output, "w");
    try { for (const [, chunk] of [...job.chunks.entries()].sort((a, b) => a[0] - b[0])) { const data = fs.readFileSync(chunk.filename); fs.writeSync(handle, data); hash.update(data); } }
    finally { fs.closeSync(handle); }
    const digest = hash.digest("hex");
    if (input.sha256 && input.sha256 !== digest) { this.finishUpload(job, "failed"); throw Object.assign(new Error("Upload integrity check failed"), { code: "MFS_UPLOAD_INTEGRITY" }); }
    job.status = "committing";
    const payload_ref = this.staging.payloadRef(job.stage.token, filename);
    try {
      const committed = await this.mfs_service.commitUpload({ destination: job.destination, payload_ref, metadata: job.metadata, operation_id: job.operation_id }, context || job.context);
      job.result = committed;
      this.finishUpload(job, "done");
      await this.report(job, { domain: "transfer", type: "upload.done", result: committed });
      return { transfer_id: job.transfer_id, sha256: digest, ...committed };
    } catch (error) { this.finishUpload(job, "failed"); throw error; }
  }

  finishUpload(job, status) { job.status = status; this.staging.release({ token: job.stage.token }); this.uploads.delete(job.transfer_id); }
  async uploadAbort(input, context) { const job = this.requireUpload(input.transfer_id, context); this.finishUpload(job, "cancelled"); await this.report(job, { domain: "transfer", type: "upload.cancelled" }); return { transfer_id: job.transfer_id, status: "cancelled" }; }

  async downloadPrepare(input, context) {
    this.ensureCapacity();
    const transfer_id = input.transfer_id || crypto.randomUUID();
    if (this.downloads.has(transfer_id)) throw Object.assign(new Error("Download transfer already exists"), { code: "MFS_TRANSFER_INVALID" });
    const manifest = await this.mfs_service.prepareDownload({ roots: input.roots }, context);
    const stage = this.staging.create(transfer_id);
    const job = { transfer_id, operation_id: input.operation_id || transfer_id, status: "preparing", roots: manifest.roots, context, stage, archive_path: path.join(stage.directory, "download.zip"), expires_at: this.now() + this.ttl_ms, worker: null };
    this.downloads.set(transfer_id, job);
    this.writeState(job);
    const running = this.archive_worker.start({ job_dir: stage.directory, manifest, on_progress: (event) => this.report(job, { domain: "transfer", type: "download.progress", loaded: event.completed, total: event.total }) });
    job.worker = running.child;
    manifest.entries = [];
    running.promise.then(async (artifact) => {
      job.worker = null; job.status = "ready"; job.archive_path = artifact.path; job.expires_at = this.now() + this.ttl_ms; this.writeState(job);
      await this.report(job, { domain: "transfer", type: "download.ready", size: artifact.size });
    }, async (error) => { job.worker = null; job.status = "failed"; job.error = error.code || error.message; this.staging.release({ token: job.stage.token }); await this.report(job, { domain: "transfer", type: "download.failed" }); });
    return { transfer_id, status: "preparing" };
  }

  downloadStatus(input, context) { const job = this.requireDownload(input.transfer_id, context); const stat = job.status === "ready" ? fs.statSync(job.archive_path, { throwIfNoEntry: false }) : null; return { transfer_id: job.transfer_id, status: job.status, size: stat && stat.size || 0 }; }

  async downloadCancel(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    if (job.worker && typeof job.worker.kill === "function") job.worker.kill("SIGTERM");
    job.worker = null; job.status = "cancelled"; this.staging.release({ token: job.stage.token }); this.downloads.delete(job.transfer_id);
    await this.report(job, { domain: "transfer", type: "download.cancelled" });
    return { transfer_id: job.transfer_id, status: "cancelled" };
  }

  downloadRetrieve(input, context) {
    const job = this.requireDownload(input.transfer_id, context);
    if (job.status !== "ready") throw Object.assign(new Error("Archive is not ready"), { code: "MFS_ARCHIVE_NOT_READY" });
    return { transfer_id: job.transfer_id, artifact: this.host_filesystem.artifact(job.archive_path, "download.zip", "application/zip") };
  }

  downloadRelease(input, context) { const job = this.requireDownload(input.transfer_id, context); if (job.worker) job.worker.kill("SIGTERM"); this.staging.release({ token: job.stage.token }); this.downloads.delete(job.transfer_id); return { transfer_id: job.transfer_id, status: "released" }; }

  writeState(job) { fs.writeFileSync(path.join(job.stage.directory, "state.json"), JSON.stringify({ transfer_id: job.transfer_id, owner: job.context && job.context.uid, roots: job.roots, status: job.status, expires_at: job.expires_at })); }
  requireUpload(id, context) { this.cleanupExpired(); const job = this.uploads.get(id); if (!job) throw Object.assign(new Error("Upload not found"), { code: "MFS_UPLOAD_NOT_FOUND" }); this.requireOwner(job, context); return job; }
  requireDownload(id, context) { this.cleanupExpired(); const job = this.downloads.get(id); if (!job) throw Object.assign(new Error("Download not found"), { code: "MFS_DOWNLOAD_NOT_FOUND" }); this.requireOwner(job, context); return job; }
  requireOwner(job, context) { const owner = job.context && job.context.uid; if (!owner || !context || context.uid !== owner) throw Object.assign(new Error("Transfer operation belongs to another principal"), { code: "MFS_TRANSFER_FORBIDDEN" }); }
  resourceFor({ service, input } = {}) { const id = input && input.transfer_id; const upload = this.uploads.get(id); if (upload) return { dest: [upload.destination] }; const download = this.downloads.get(id); if (download) return { src: download.roots }; return String(service || "").includes("upload_") ? { dest: [] } : { src: [] }; }
  report(job, event) { return this.progress.publishOperation({ operation_id: job.operation_id, transfer_id: job.transfer_id, principal: job.context && job.context.uid, event }); }

  cleanupExpired() {
    const now = this.now();
    for (const job of [...this.uploads.values()]) if (job.expires_at <= now) { this.staging.release({ token: job.stage.token }); this.uploads.delete(job.transfer_id); }
    for (const job of [...this.downloads.values()]) if (job.expires_at <= now) { if (job.worker) job.worker.kill("SIGTERM"); this.staging.release({ token: job.stage.token }); this.downloads.delete(job.transfer_id); }
  }

  destroy() {
    clearInterval(this.cleanup_timer);
    for (const job of this.downloads.values()) if (job.worker) job.worker.kill("SIGTERM");
    for (const job of this.uploads.values()) this.staging.release({ token: job.stage.token });
    for (const job of this.downloads.values()) this.staging.release({ token: job.stage.token });
    this.uploads.clear(); this.downloads.clear();
  }
}

module.exports = { MfsTransferService };
