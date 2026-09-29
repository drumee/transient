"use strict";

module.exports = class MfsTransferWorker {
  constructor({ session, mfs_transfer } = {}) { this.session = session; this.mfs_transfer = mfs_transfer; }
  context() { const identity = this.session && typeof this.session.identity === "function" ? this.session.identity() : null; return { principal_id: identity && identity.id }; }
  call(method, input) { if (!this.mfs_transfer) throw new Error("mfs-transfer is not configured"); return this.mfs_transfer[method](input || {}, this.context()); }
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
