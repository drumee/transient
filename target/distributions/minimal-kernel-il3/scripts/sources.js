"use strict";
// Explicit pinned acquisition; never writes to transient/sources or sibling repos.
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const lock = require("../sources.lock.json");
function acquire() {
  const cache = path.join(root, ".cache"); fs.mkdirSync(cache, { recursive: true });
  const checkout = path.join(cache, lock.revision);
  if (!fs.existsSync(path.join(checkout, ".git/FETCH_HEAD"))) {
    fs.mkdirSync(checkout, { recursive: true }); execFileSync("git", ["init", "-q", checkout]);
    execFileSync("git", ["-C", checkout, "fetch", "--quiet", "--depth=1", lock.repository, lock.revision], { stdio: "pipe" });
  }
  if (execFileSync("git", ["-C", checkout, "rev-parse", "FETCH_HEAD"], { encoding: "utf8" }).trim() !== lock.revision) throw Error("SOURCE_REVISION_MISMATCH");
  const vendor = path.join(root, "vendor"); fs.mkdirSync(vendor, { recursive: true });
  const inventory = [];
  for (const [source, destination] of Object.entries(lock.paths)) {
    const records = execFileSync("git", ["-C", checkout, "ls-tree", "-r", lock.revision, "--", source], { encoding: "utf8" }).trim().split("\n");
    for (const record of records) {
      const match = /^(100644|100755) blob ([a-f0-9]+)\t(.+)$/.exec(record);
      if (!match) throw Error("UNSAFE_SOURCE_OBJECT");
      const relative = match[3] === source ? destination : path.join(destination, path.relative(source, match[3]));
      if (relative.split(path.sep).some(value => value === ".." || value === "node_modules")) throw Error("UNSAFE_SOURCE_PATH");
      const bytes = execFileSync("git", ["-C", checkout, "cat-file", "blob", match[2]], { maxBuffer: 8 * 1024 * 1024 });
      const file = path.join(vendor, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, bytes, { mode: 0o644 });
      inventory.push({ source: match[3], path: relative, sha256: crypto.createHash("sha256").update(bytes).digest("hex") });
    }
  }
  fs.writeFileSync(path.join(vendor, "inventory.json"), JSON.stringify({ ...lock, files: inventory }, null, 2) + "\n");
  console.log(`Pinned source files verified: ${inventory.length}`);
}
if (require.main === module) acquire();
module.exports = { acquire };
