"use strict";

class MfsProofWorker {
  constructor(options = {}) {
    this.store = options.resolveMfsStore();
    this.session = options.session;
  }

  async probe(input = {}) {
    const { MfsNamespace } = require("/opt/kernel/system-mfs/lib");
    const identity = this.session && typeof this.session.identity === "function" ? this.session.identity() : null;
    const context = { hub_id: input.hub_id };
    const mfs = new MfsNamespace({ store: this.store, context, principal: identity && identity.id });
    const created = await mfs.makeDirectory(input.parent_id, input.name || "Phase46B");
    return { created, resolved: await mfs.resolveNode(created.nid), children: await mfs.listChildren(input.parent_id) };
  }
}

module.exports = MfsProofWorker;
