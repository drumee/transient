"use strict";

module.exports = class MfsWorker {
  constructor({ session, mfs_service, hub_context, hub_contexts } = {}) {
    this.session = session;
    this.mfs_service = mfs_service;
    this.hub_context = hub_context;
    this.hub_contexts = hub_contexts;
  }

  context() {
    const session = this.session;
    const identity = session && typeof session.identity === "function" ? session.identity() : null;
    const uid = session && typeof session.uid === "function" ? session.uid() : identity && identity.id;
    const hub = session && session.hub;
    const current_hub_id = session && typeof session.currentHub === "function" ? session.currentHub() : hub && typeof hub.get === "function" ? hub.get("id") : hub && (hub.id || hub.hub_id);
    const input = session && session.input;
    const host = input && typeof input.host === "function" ? input.host() : session && session.host;
    return { uid, current_hub_id, host, hub_context: this.hub_context, hub_contexts: this.hub_contexts };
  }

  async call(method, input) {
    if (!this.mfs_service) throw new Error("mfs-service is not configured");
    const result = await this.mfs_service[method](input || {}, this.context());
    const output = this.session && this.session.output;
    if (output && typeof output.data === "function") return output.data(result);
    return result;
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
