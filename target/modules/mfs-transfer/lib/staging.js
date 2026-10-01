"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { pipeline } = require("node:stream/promises");

class TransferStaging {
  constructor({ root, now = () => Date.now() } = {}) {
    this.root = root || fs.mkdtempSync(path.join(os.tmpdir(), "drumee-mfs-transfer-"));
    this.now = now;
    this.payloads = new Map();
    fs.mkdirSync(this.root, { recursive: true });
  }

  create(requested_token) {
    const token = requested_token || crypto.randomUUID();
    if (!/^[a-zA-Z0-9-]{8,80}$/.test(token) || this.payloads.has(token)) throw Object.assign(new Error("Invalid or duplicate staging token"), { code: "MFS_TRANSFER_INVALID" });
    const directory = path.join(this.root, token);
    fs.mkdirSync(directory, { recursive: true });
    this.payloads.set(token, { directory, created_at: this.now(), claimed: false });
    return { token, directory };
  }

  payloadRef(token, filename) {
    const payload = this.payloads.get(token);
    if (!payload) throw Object.assign(new Error("Unknown staged payload"), { code: "MFS_TRANSFER_NOT_FOUND" });
    payload.filename = filename;
    return Object.freeze({ type: "mfs-staged-payload", token });
  }

  createSparseFile(token, filename, size) {
    const payload = this.payloads.get(token);
    if (!payload || path.basename(filename) !== filename) throw Object.assign(new Error("Invalid staged payload target"), { code: "MFS_TRANSFER_INVALID" });
    const destination = path.join(payload.directory, filename);
    const handle = fs.openSync(destination, "w");
    try { fs.ftruncateSync(handle, size); } finally { fs.closeSync(handle); }
    return destination;
  }

  async writeInputFile(source, token, filename, offset) {
    const payload = this.payloads.get(token);
    if (!payload || !source || !fs.existsSync(source) || path.basename(filename) !== filename) throw Object.assign(new Error("Input upload tempfile is unavailable"), { code: "MFS_INPUT_FILE_INVALID" });
    const destination = path.join(payload.directory, filename);
    try {
      await pipeline(fs.createReadStream(source), fs.createWriteStream(destination, { flags: "r+", start: offset }));
    } finally {
      fs.rmSync(source, { force: true });
    }
    return destination;
  }

  adoptInputFile(source, token, filename) {
    const payload = this.payloads.get(token);
    if (!payload || !source || !fs.existsSync(source)) throw Object.assign(new Error("Input upload tempfile is unavailable"), { code: "MFS_INPUT_FILE_INVALID" });
    const destination = path.join(payload.directory, filename);
    try {
      fs.renameSync(source, destination);
    } catch (error) {
      if (error.code !== "EXDEV") throw error;
      fs.copyFileSync(source, destination);
      fs.rmSync(source, { force: true });
    }
    return destination;
  }

  claim(payload_ref) {
    if (!payload_ref || payload_ref.type !== "mfs-staged-payload") throw Object.assign(new Error("Invalid staged payload reference"), { code: "MFS_PAYLOAD_REF_INVALID" });
    const payload = this.payloads.get(payload_ref.token);
    if (!payload || payload.claimed || !payload.filename) throw Object.assign(new Error("Staged payload is unavailable"), { code: "MFS_PAYLOAD_REF_INVALID" });
    payload.claimed = true;
    return path.join(payload.directory, payload.filename);
  }

  release(payload_ref) {
    if (!payload_ref || !payload_ref.token) return;
    const payload = this.payloads.get(payload_ref.token);
    if (!payload) return;
    this.payloads.delete(payload_ref.token);
    fs.rmSync(payload.directory, { recursive: true, force: true });
  }

  cleanup(max_age_ms) {
    const cutoff = this.now() - max_age_ms;
    for (const [token, payload] of this.payloads) {
      if (payload.created_at > cutoff) continue;
      this.release({ token });
    }
  }

  destroy() {
    fs.rmSync(this.root, { recursive: true, force: true });
    this.payloads.clear();
  }
}

module.exports = { TransferStaging };
