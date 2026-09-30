"use strict";

class FileIo {
  constructor({ host_filesystem } = {}) {
    if (!host_filesystem) throw new Error("FileIo requires HostFilesystem");
    this.host_filesystem = host_filesystem;
  }

  headers(artifact, { name, mimetype, disposition = "attachment", cache = false } = {}) {
    const current = this.host_filesystem.artifact(artifact.path, name || artifact.name, mimetype || artifact.mimetype);
    const filename = encodeURIComponent(name || current.name || "download");
    return {
      "X-Accel-Redirect": this.host_filesystem.internalUrl(current),
      "Content-Disposition": `${disposition}; filename*=UTF-8''${filename}`,
      "Content-Length": current.size,
      "Content-Type": mimetype || current.mimetype || "application/octet-stream",
      "Accept-Ranges": "bytes",
      "Cache-Control": cache ? "public, max-age=86400" : "no-store"
    };
  }

  send(output, artifact, options) {
    if (!output || typeof output.head !== "function") throw new Error("FileIo requires Output.head()");
    output.head(this.headers(artifact, options), 200);
    return null;
  }
}

module.exports = { FileIo };
