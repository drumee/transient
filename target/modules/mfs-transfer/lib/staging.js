"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

class TransferStaging {
  constructor({ root, now = () => Date.now() } = {}) {
    this.root = root || fs.mkdtempSync(path.join(os.tmpdir(), "drumee-mfs-transfer-"));
    this.now = now;
    this.payloads = new Map();
    fs.mkdirSync(this.root, { recursive: true });
  }

  create() {
    const token = crypto.randomUUID();
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
