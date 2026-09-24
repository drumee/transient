"use strict";

class MfsProofWorker {
  constructor(options = {}) {
    this.store = options.resolveMfsStore();
  }

  async probe(input = {}) {
    const { MfsNamespace } = require("/opt/kernel/system-mfs/lib");
    const context = { organisationId: Number(input.organisationId || 1), principalId: input.principalId };
    const mfs = new MfsNamespace({ store: this.store, context });
    const created = await mfs.makeDirectory(input.parentId, input.name || "Phase46B");
    return { created, resolved: await mfs.resolveNode(created.nid), children: await mfs.listChildren(input.parentId) };
  }
}

module.exports = MfsProofWorker;
