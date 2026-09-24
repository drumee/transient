"use strict";

class MfsProofWorker {
  constructor(options = {}) {
    this.store = options.resolveMfsStore();
  }

  async probe(input = {}) {
    const { MfsNamespace } = require("/opt/kernel/system-mfs/lib");
    const context = { organisation_id: Number(input.organisation_id || 1), principal_id: input.principal_id };
    const mfs = new MfsNamespace({ store: this.store, context });
    const created = await mfs.makeDirectory(input.parent_id, input.name || "Phase46B");
    return { created, resolved: await mfs.resolveNode(created.nid), children: await mfs.listChildren(input.parent_id) };
  }
}

module.exports = MfsProofWorker;
