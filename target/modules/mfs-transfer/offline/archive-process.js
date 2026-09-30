#!/usr/bin/env node
"use strict";

const child_process = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

async function main() {
  const descriptor = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const tree = path.join(descriptor.job_dir, "tree");
  fs.mkdirSync(tree, { recursive: true });
  let completed = 0;
  for (const entry of descriptor.entries) {
    const target = path.resolve(tree, entry.name);
    if (target !== tree && !target.startsWith(`${tree}${path.sep}`)) throw new Error("Unsafe archive entry");
    if (entry.directory) fs.mkdirSync(target, { recursive: true });
    else { fs.mkdirSync(path.dirname(target), { recursive: true }); fs.symlinkSync(entry.source, target); }
    completed++;
    if (process.send) process.send({ type: "progress", completed, total: descriptor.entries.length });
  }
  await new Promise((resolve, reject) => {
    const zip = child_process.spawn("zip", ["-rq", descriptor.archive_path, "."], { cwd: tree, stdio: "ignore" });
    zip.once("error", reject);
    zip.once("exit", (code, signal) => code === 0 ? resolve() : reject(new Error(`zip failed (${code || signal})`)));
  });
}

main().then(() => process.exit(0), (error) => { process.stderr.write(`${error.stack || error.message}\n`); process.exit(1); });
