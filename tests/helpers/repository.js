const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "../..");

function resolveRepo(relativePath) {
  return path.join(root, relativePath);
}

function read(relativePath) {
  return fs.readFileSync(resolveRepo(relativePath), "utf8");
}

function json(relativePath) {
  return JSON.parse(read(relativePath));
}

function files(relativePath, predicate = () => true) {
  const base = resolveRepo(relativePath);
  const out = [];
  for (const entry of fs.readdirSync(base, { withFileTypes: true })) {
    const child = path.join(base, entry.name);
    if (entry.isDirectory()) {
      out.push(...files(path.relative(root, child), predicate));
    } else if (predicate(child)) {
      out.push(child);
    }
  }
  return out.sort();
}

module.exports = { root, resolveRepo, read, json, files };
