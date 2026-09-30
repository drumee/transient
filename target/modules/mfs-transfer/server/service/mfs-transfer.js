"use strict";

module.exports = class MfsTransferWorker {
  constructor({ session, mfs_transfer } = {}) { this.session = session; this.mfs_transfer = mfs_transfer; }
  context() {
    const session = this.session;
    const identity = session && typeof session.identity === "function" ? session.identity() : null;
    const uid = session && typeof session.uid === "function" ? session.uid() : identity && identity.id;
    const hub = session && session.hub;
    const current_hub_id = session && typeof session.currentHub === "function" ? session.currentHub() : hub && typeof hub.get === "function" ? hub.get("id") : hub && (hub.id || hub.hub_id);
    const input = session && session.input;
    const host = input && typeof input.host === "function" ? input.host() : session && session.host;
    return { uid, current_hub_id, host };
  }
  async call(method, input) {
    if (!this.mfs_transfer) throw new Error("mfs-transfer is not configured");
    const result = await this.mfs_transfer[method](input || {}, this.context());
    const output = this.session && this.session.output;
    if (output && typeof output.data === "function" && method !== "downloadRetrieve") return output.data(result);
    if (output && typeof output.write === "function" && method === "downloadRetrieve") return output.write(result.data, result.content_type);
    return result;
  }
  upload_start(input) { return this.call("uploadStart", input); }
  upload_chunk(input) { return this.call("uploadChunk", input); }
  upload_status(input) { return this.call("uploadStatus", input); }
  upload_complete(input) { return this.call("uploadComplete", input); }
  upload_abort(input) { return this.call("uploadAbort", input); }
  download_prepare(input) { return this.call("downloadPrepare", input); }
  download_status(input) { return this.call("downloadStatus", input); }
  download_cancel(input) { return this.call("downloadCancel", input); }
  download_retrieve(input) { return this.call("downloadRetrieve", input); }
  download_release(input) { return this.call("downloadRelease", input); }
};
