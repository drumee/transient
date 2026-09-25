#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fixture_root = path.join(root, "target/modules/system-mfs");
const standalone_root = process.env.KERNEL_SYSTEM_MFS_ROOT || path.resolve(root, "../system-mfs");
const ignored_names = new Set([".git", "node_modules"]);

function collectFiles(directory, base = directory) {
  const files = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (ignored_names.has(entry.name) || entry.name.endsWith(".tgz")) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...collectFiles(filename, base));
    else files.push(path.relative(base, filename));
  }
  return files.sort();
}

assert.equal(fs.existsSync(standalone_root), true, `Standalone system-mfs repository not found: ${standalone_root}`);
const fixture_files = collectFiles(fixture_root);
const standalone_files = collectFiles(standalone_root);
assert.deepEqual(standalone_files, fixture_files, "Standalone and transitional system-mfs file inventories differ");

for (const relative_path of standalone_files) {
  const fixture_content = fs.readFileSync(path.join(fixture_root, relative_path));
  const standalone_content = fs.readFileSync(path.join(standalone_root, relative_path));
  assert.deepEqual(standalone_content, fixture_content, `system-mfs content differs: ${relative_path}`);
}

process.stdout.write(`system-mfs synchronized: ${standalone_files.length} files\n`);
