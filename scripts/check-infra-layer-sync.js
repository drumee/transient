"use strict";
// Explicit standalone checkout only; no hidden sibling-repository dependency.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const standalone = process.argv[2];
if (!standalone || !path.isAbsolute(standalone)) throw new Error("EXPLICIT_STANDALONE_CHECKOUT_REQUIRED");
const revision = "b1b8e8666e92ec604d933b9c99145c90b966362b";
assert.equal(execFileSync("git", ["-C", standalone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim(), revision);
const snapshot = path.resolve(__dirname, "../target/modules/infra-layer");
const files = execFileSync("git", ["-C", standalone, "ls-tree", "-r", "--name-only", "HEAD"], { encoding: "utf8" }).trim().split("\n");
const snapshot_files = [];
function walk(directory) { for (const name of fs.readdirSync(directory)) { if (["node_modules", ".git"].includes(name) || name.endsWith(".tgz")) continue; const file = path.join(directory, name); const stat = fs.lstatSync(file); assert.equal(stat.isSymbolicLink(), false); if (stat.isDirectory()) walk(file); else snapshot_files.push(path.relative(snapshot, file)); } }
walk(snapshot); assert.deepEqual(snapshot_files.sort(), files.sort());
for (const name of files) {
  const committed = execFileSync("git", ["-C", standalone, "show", `HEAD:${name}`]);
  assert.deepEqual(fs.readFileSync(path.join(standalone, name)), committed, `Standalone drift: ${name}`);
  assert.deepEqual(fs.readFileSync(path.join(snapshot, name)), committed, `Snapshot drift: ${name}`);
}
console.log(`${files.length} Infra Layer files match canonical release candidate ${revision}`);
