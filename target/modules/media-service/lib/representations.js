"use strict";

const fs = require("node:fs");

const DERIVED = new Set(["preview", "thumb", "document", "video"]);

class RepresentationManager {
  constructor({ host_filesystem, generators = {}, hls_generator, wait_timeout_ms = 5000 } = {}) {
    if (!host_filesystem) throw new Error("RepresentationManager requires HostFilesystem");
    this.host_filesystem = host_filesystem;
    this.generators = generators;
    this.hls_generator = hls_generator;
    this.wait_timeout_ms = wait_timeout_ms;
    this.workers = new Map();
  }

  async ensure(node, representation) {
    if (!DERIVED.has(representation)) throw Object.assign(new Error("Unknown derived representation"), { code: "MEDIA_REPRESENTATION_INVALID" });
    let artifact = this.host_filesystem.derived(node, representation);
    if (artifact.exists) return { ...artifact, reused: true };
    const generator = this.generators[representation];
    if (typeof generator !== "function") throw Object.assign(new Error("Representation generator is unavailable"), { code: "MEDIA_GENERATOR_UNAVAILABLE" });
    const source = this.host_filesystem.original(node);
    const destination = this.host_filesystem.ensureParent(artifact.path);
    await generator({ source, destination, node, representation });
    artifact = this.host_filesystem.artifact(destination, artifact.name, artifact.mimetype);
    return { ...artifact, reused: false };
  }

  async master(node) {
    let artifact = this.host_filesystem.derived(node, "master");
    if (artifact.exists) return { ...artifact, reused: true };
    if (typeof this.hls_generator !== "function") throw Object.assign(new Error("HLS generator is unavailable"), { code: "MEDIA_GENERATOR_UNAVAILABLE" });
    const key = `${node.hub_id}:${node.nid}`;
    if (!this.workers.has(key)) {
      const destination = this.host_filesystem.ensureParent(artifact.path);
      const source = this.host_filesystem.original(node);
      const worker = this.hls_generator({ source, destination, cwd: require("node:path").dirname(destination), node });
      if (!worker || typeof worker.once !== "function") throw new Error("HLS generator must return a finite worker handle");
      this.workers.set(key, worker);
      worker.once("exit", () => this.workers.delete(key));
      worker.once("error", () => this.workers.delete(key));
      if (typeof worker.unref === "function") worker.unref();
    }
    const deadline = Date.now() + this.wait_timeout_ms;
    while (Date.now() < deadline) {
      artifact = this.host_filesystem.derived(node, "master");
      if (artifact.exists) return { ...artifact, reused: false };
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    throw Object.assign(new Error("HLS master playlist is not ready"), { code: "MEDIA_REPRESENTATION_PENDING" });
  }

  playlist(node, representation, options = {}) {
    const artifact = this.host_filesystem.derived(node, representation, options);
    if (!artifact.exists) throw Object.assign(new Error("HLS playlist is not ready"), { code: "MEDIA_REPRESENTATION_PENDING" });
    let body = fs.readFileSync(artifact.path, "utf8");
    if (options.keysel) body = body.split("\n").map((line) => /^(stream|segment)/.test(line) ? `${line}${line.includes("?") ? "&" : "?"}keysel=${encodeURIComponent(options.keysel)}` : line).join("\n");
    return { body, mimetype: "application/x-mpegURL", name: artifact.name };
  }

  stop() {
    for (const worker of this.workers.values()) if (worker && typeof worker.kill === "function" && !worker.killed) worker.kill("SIGTERM");
    this.workers.clear();
  }
}

module.exports = { DERIVED, RepresentationManager };
