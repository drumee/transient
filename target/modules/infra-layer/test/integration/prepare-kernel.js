"use strict";
// Explicit pinned test dependency acquisition. Never imported by production code.
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const dependency = require("./kernel-dependencies.json");
function command(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout: 300000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`TEST_DEPENDENCY_COMMAND_FAILED: ${args[0]} ${args[1]}`);
  return result.stdout;
}
function prepareKernel(directory, module_directory) {
  const root = path.join(directory, "kernel-source"); fs.mkdirSync(root);
  command(["git", "init", "-q", root]);
  command(["git", "-C", root, "remote", "add", "origin", dependency.repository]);
  command(["git", "-C", root, "fetch", "--quiet", "--depth=1", "--filter=blob:none", "origin", dependency.revision]);
  if (command(["git", "-C", root, "rev-parse", "FETCH_HEAD"]).trim() !== dependency.revision) throw new Error("TEST_DEPENDENCY_REVISION_MISMATCH");
  const archive = path.join(directory, "kernel-source.tar");
  command(["git", "-C", root, "archive", "--format=tar", `--output=${archive}`, dependency.revision, "--", ...dependency.paths]);
  command(["tar", "-xf", archive, "-C", root]); fs.unlinkSync(archive);
  // Only explicit temporary fixtures contain kernel code. The standalone tree
  // and npm artifact never contain these components or historical source trees.
  fs.cpSync(module_directory, path.join(root, "target/modules/infra-layer"), { recursive: true, filter: (file) => !file.split(path.sep).some((part) => ["node_modules", ".git"].includes(part)) });
  for (const component of ["target/foundation/ui-runtime", "target/tooling/ui-build"]) command(["npm", "ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: path.join(root, component) });
  return root;
}
module.exports = { prepareKernel };
