#!/usr/bin/env node
"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const fixture_root = path.join(root, "target/modules/system-mfs");
const standalone_root = process.env.KERNEL_SYSTEM_MFS_ROOT || path.resolve(root, "../system-mfs");
assert.equal(fs.existsSync(standalone_root), true, `Standalone system-mfs repository not found: ${standalone_root}`);
const retained_files = fs.existsSync(fixture_root)
  ? fs.readdirSync(fixture_root, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile())
  : [];
assert.equal(retained_files.length, 0, "transient must not retain a second system-mfs implementation");
const manifest = require(path.join(standalone_root, "package.json"));
const api = require(standalone_root);
assert.equal(manifest.name, "@drumee/system-mfs");
for (const name of ["MfsNamespace", "MfsFilesystem", "LocalContentStore"]) assert.equal(typeof api[name], "function", `Missing standalone system-mfs export: ${name}`);
const integration_test = fs.readFileSync(path.join(root, "tests/integration/kernel/phase4.8-transfer-boundary.test.js"), "utf8");
assert.match(integration_test, /\.\.\/system-mfs/);
assert.doesNotMatch(integration_test, /target\/modules\/system-mfs/);
process.stdout.write(`system-mfs authority verified: ${standalone_root}\n`);
