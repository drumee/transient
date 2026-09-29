"use strict";

module.exports = class MfsWorker {
  constructor({ session, mfs_service } = {}) {
    this.session = session;
    this.mfs_service = mfs_service;
  }

  context() {
    const identity = this.session && typeof this.session.identity === "function" ? this.session.identity() : null;
    return { principal_id: identity && identity.id };
  }

  call(method, input) {
    if (!this.mfs_service) throw new Error("mfs-service is not configured");
    return this.mfs_service[method](input || {}, this.context());
  }

  list(input) { return this.call("list", input); }
  get(input) { return this.call("get", input); }
  mkdir(input) { return this.call("mkdir", input); }
  rename(input) { return this.call("rename", input); }
  remove(input) { return this.call("remove", input); }
  move(input) { return this.call("move", input); }
  copy(input) { return this.call("copy", input); }
  commit_upload(input) { return this.call("commitUpload", input); }
};
