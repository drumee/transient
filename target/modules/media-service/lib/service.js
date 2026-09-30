"use strict";

const KNOWN = new Set(["orig", "preview", "thumb", "document", "video", "master", "stream", "segment"]);

class MediaService {
  constructor({ node_resolver, host_filesystem, representations } = {}) {
    if (typeof node_resolver !== "function" || !host_filesystem || !representations) throw new Error("MediaService requires node resolver, HostFilesystem and representations");
    this.node_resolver = node_resolver;
    this.host_filesystem = host_filesystem;
    this.representations = representations;
  }

  async resolve(service, input = {}, context = {}) {
    if (!KNOWN.has(service)) throw Object.assign(new Error("Unknown public media representation"), { code: "MEDIA_REPRESENTATION_INVALID" });
    const node = await this.node_resolver({ hub_id: input.hub_id || context.current_hub_id, nid: input.nid });
    if (!node) throw Object.assign(new Error("Media node was not found"), { code: "MFS_NODE_NOT_FOUND" });
    if (service === "orig") return { kind: "file", artifact: this.host_filesystem.original(node), name: node.filename, mimetype: node.mimetype };
    if (["preview", "thumb", "document", "video"].includes(service)) return { kind: "file", artifact: await this.representations.ensure(node, service), name: node.filename, mimetype: undefined };
    if (service === "master") { await this.representations.master(node); return { kind: "playlist", ...this.representations.playlist(node, "master", { keysel: context.keysel }) }; }
    if (service === "stream") return { kind: "playlist", ...this.representations.playlist(node, "stream", { serial: input.serial, keysel: context.keysel }) };
    return { kind: "file", artifact: this.host_filesystem.derived(node, "segment", { serial: input.serial, segment: input.segment }) };
  }
}

module.exports = { KNOWN, MediaService };
