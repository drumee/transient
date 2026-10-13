"use strict";
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const root = path.resolve(__dirname, "..");
const packed = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json"], { cwd: root, encoding: "utf8" }))[0];
for (const entry of packed.files) {
  assert.match(entry.path, /^(?:lib\/[a-z-]+\.js|capabilities\/http\/nginx\/[a-z]+\.js|adapters\/docker\/nginx\.js|index\.d\.ts|README\.md|PROVENANCE\.md|LICENSE|package\.json)$/);
  const contents = fs.readFileSync(path.join(root, entry.path), "utf8");
  assert.doesNotMatch(contents, /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----|isolated-fixture-password|\/home\/[^\s"']+|"file:/);
  if (entry.path.endsWith(".js")) for (const match of contents.matchAll(/require\(["']([^"']+)["']\)/g)) assert.ok(match[1].startsWith(".") || match[1].startsWith("node:"), "Undeclared production import");
}
const manifest = JSON.parse(fs.readFileSync(path.join(root, "package.json")));
assert.equal(manifest.name, "@drumee/infra-layer"); assert.equal(manifest.license, "AGPL-3.0-only");
assert.equal(Object.keys(manifest.dependencies || {}).length, 0);
console.log(JSON.stringify({ files: packed.files.map((entry) => entry.path), production_dependencies: [], integrity: packed.integrity }));
