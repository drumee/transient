"use strict";
const fs = require("node:fs");
const path = require("node:path");
async function buildBrowser(root, directory) {
  const tooling = path.join(root, "target/tooling/ui-build");
  const webpack = require(path.join(tooling, "node_modules/webpack"));
  const { createConfig } = require(path.join(tooling, "lib"));
  const modules = [path.join(root, "target/foundation/ui-runtime/node_modules"), path.join(tooling, "node_modules")];
  const compile = (config) => new Promise((resolve, reject) => webpack(config, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(new Error(stats.toString({ all: false, errors: true }))) : resolve()));
  await compile(createConfig({ root, name: "core", entry: "./target/modules/infra-layer/test/integration/browser-entry.js", outputPath: path.join(directory, "public/app"), noHash: true, version: "il1-fixture", rev: "il1-fixture", loaderRoots: [path.join(tooling, "node_modules")], moduleRoots: modules }));
  const hello = createConfig({ root, name: "hello", entry: "./target/modules/hello/ui/index.js", outputPath: path.join(directory, "public/plugins/hello"), noHash: true, version: "il1-fixture", rev: "il1-fixture", publicPath: "/-/plugins/hello/", loaderRoots: [path.join(tooling, "node_modules")], moduleRoots: modules });
  await compile(hello);
  fs.mkdirSync(path.join(directory, "public/static"), { recursive: true });
  fs.writeFileSync(path.join(directory, "public/static/smoke.css"), "body { background: rgb(250, 250, 250); }\n");
}
module.exports = { buildBrowser };
