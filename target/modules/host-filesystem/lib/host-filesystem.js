"use strict";

const fs = require("node:fs");
const path = require("node:path");

const ID_PATTERN = /^[a-f0-9]{16}$/i;
const CONTENT_REF_PATTERN = /^mfs-content:([a-f0-9]{16}):([a-f0-9]{16})$/i;
const REPRESENTATIONS = new Set(["preview", "thumb", "document", "video", "master", "stream", "segment"]);

function within(root, candidate) {
  const base = path.resolve(root);
  const target = path.resolve(candidate);
  if (target !== base && !target.startsWith(`${base}${path.sep}`)) throw Object.assign(new Error("Physical path escapes the host-filesystem root"), { code: "HOST_PATH_UNSAFE" });
  return target;
}

class HostFilesystem {
  constructor({ root, internal_prefix = "/__drumee_artifacts", rename = fs.renameSync, content_resolver } = {}) {
    if (!root) throw new Error("HostFilesystem requires an internal root");
    this.root = path.resolve(root);
    this.internal_prefix = `/${String(internal_prefix).replace(/^\/+|\/+$/g, "")}`;
    this.rename = rename;
    this.content_resolver = content_resolver;
    fs.mkdirSync(this.root, { recursive: true });
  }

  checkSafety(target) {
    const value = within(this.root, target);
    for (let current = value; current.startsWith(this.root); current = path.dirname(current)) {
      if (fs.existsSync(path.join(current, ".drumee-safety-lock"))) throw Object.assign(new Error("Host filesystem location is locked"), { code: "HOST_PATH_LOCKED" });
      if (current === this.root) break;
    }
    return value;
  }

  original(node) {
    const reference = node && node.storage_ref;
    const opaque = typeof this.content_resolver === "function" ? this.content_resolver(reference, node) : null;
    const matched = CONTENT_REF_PATTERN.exec(typeof reference === "string" ? reference : "");
    const relative = opaque || (reference && typeof reference === "object" && reference.type === "local-content" ? reference.relative : null) || (matched ? path.join(matched[1].toLowerCase(), matched[2].toLowerCase()) : null);
    if (!relative || path.isAbsolute(relative) || relative.split(/[\\/]+/).includes("..")) throw Object.assign(new Error("Node has no safe canonical content reference"), { code: "HOST_ORIGINAL_INVALID" });
    return this.artifact(within(this.root, path.join(this.root, relative)), node.filename || `${node.nid}.${node.ext || "bin"}`, node.mimetype);
  }

  representationPath(node, representation, options = {}) {
    if (!node || !ID_PATTERN.test(node.hub_id || "") || !ID_PATTERN.test(node.nid || "")) throw Object.assign(new Error("Representation requires {hub_id,nid}"), { code: "HOST_IDENTITY_INVALID" });
    if (!REPRESENTATIONS.has(representation)) throw Object.assign(new Error("Unknown media representation"), { code: "MEDIA_REPRESENTATION_INVALID" });
    const base = within(this.root, path.join(this.root, "representations", node.hub_id, node.nid));
    if (representation === "master") return within(base, path.join(base, "hls", "master.m3u8"));
    if (representation === "stream") return within(base, path.join(base, "hls", `stream-${Number(options.serial)}`, "playlist.m3u8"));
    if (representation === "segment") return within(base, path.join(base, "hls", `stream-${Number(options.serial)}`, `segment-${Number(options.segment)}.ts`));
    const extension = { preview: "jpg", thumb: "jpg", document: "pdf", video: "mp4" }[representation];
    return within(base, path.join(base, `${representation}.${extension}`));
  }

  derived(node, representation, options = {}) {
    const filename = this.representationPath(node, representation, options);
    const mimetype = { preview: "image/jpeg", thumb: "image/jpeg", document: "application/pdf", video: "video/mp4", master: "application/x-mpegURL", stream: "application/x-mpegURL", segment: "video/MP2T" }[representation];
    return this.artifact(filename, path.basename(filename), mimetype, false);
  }

  artifact(filename, name, mimetype = "application/octet-stream", required = true) {
    const safe = within(this.root, filename);
    const stat = fs.statSync(safe, { throwIfNoEntry: false });
    if (required && (!stat || !stat.isFile())) throw Object.assign(new Error("Host filesystem artifact was not found"), { code: "HOST_ARTIFACT_NOT_FOUND" });
    return { path: safe, name, mimetype, size: stat && stat.size || 0, exists: Boolean(stat && stat.isFile()) };
  }

  ensureParent(filename) { const safe = this.checkSafety(filename); fs.mkdirSync(path.dirname(safe), { recursive: true }); return safe; }

  link(artifact, destination) {
    const source = this.checkSafety(artifact.path);
    const target = this.ensureParent(destination);
    fs.rmSync(target, { force: true });
    fs.symlinkSync(source, target);
    return target;
  }

  move(source, destination) {
    const src = this.checkSafety(source);
    const dest = this.ensureParent(destination);
    try { this.rename(src, dest); }
    catch (error) {
      if (error.code !== "EXDEV") throw error;
      fs.copyFileSync(src, dest);
      fs.rmSync(src, { force: true });
    }
    return dest;
  }

  remove(target) { const safe = this.checkSafety(target); fs.rmSync(safe, { recursive: true, force: true }); }

  internalUrl(artifact) {
    const relative = path.relative(this.root, within(this.root, artifact.path)).split(path.sep).map(encodeURIComponent).join("/");
    return `${this.internal_prefix}/${relative}`;
  }
}

module.exports = { HostFilesystem, REPRESENTATIONS, within };
