"use strict";

const child_process = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

class ArchiveWorker {
  constructor({ host_filesystem, fork = child_process.fork } = {}) {
    if (!host_filesystem) throw new Error("ArchiveWorker requires HostFilesystem");
    this.host_filesystem = host_filesystem;
    this.fork = fork;
  }

  start({ job_dir, manifest, on_progress } = {}) {
    const descriptor_path = path.join(job_dir, "archive-job.json");
    const archive_path = path.join(job_dir, "download.zip");
    const entries = manifest.entries.map((entry) => ({
      directory: ["folder", "root"].includes(entry.filetype),
      name: this.entryName(entry, manifest),
      source: ["folder", "root"].includes(entry.filetype) ? null : this.host_filesystem.original(entry).path
    }));
    fs.writeFileSync(descriptor_path, JSON.stringify({ job_dir, archive_path, entries }));
    const child = this.fork(path.resolve(__dirname, "../offline/archive-process.js"), [descriptor_path], { stdio: ["ignore", "ignore", "ignore", "ipc"] });
    const promise = new Promise((resolve, reject) => {
      let settled = false;
      child.on("message", (message) => { if (message && message.type === "progress" && on_progress) on_progress(message); });
      child.once("error", (error) => { if (!settled) { settled = true; reject(error); } });
      child.once("exit", (code, signal) => {
        if (settled) return;
        settled = true;
        if (code === 0 && fs.statSync(archive_path, { throwIfNoEntry: false })) resolve(this.host_filesystem.artifact(archive_path, "download.zip", "application/zip"));
        else reject(Object.assign(new Error(`Archive worker failed (${code || signal})`), { code: "MFS_ARCHIVE_FAILED" }));
      });
    });
    return { child, promise, archive_path };
  }

  entryName(entry, manifest) {
    const root = manifest.entries.find((value) => value.hub_id === entry.hub_id && value.nid === (entry.root_nid || entry.nid));
    const root_name = root && (root.filename || `root-${root.nid}`) || "download";
    if (!root || entry.nid === root.nid) return root_name;
    const relative = String(entry.filepath || "").slice(String(entry.root_path || root.filepath || "").length).replace(/^\/+/, "");
    return `${root_name}/${relative}`;
  }
}

module.exports = { ArchiveWorker };
