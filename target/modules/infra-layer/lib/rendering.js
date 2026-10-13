"use strict";

const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const S = require("./spec");
const { planInfrastructure } = require("./plan");

function fail(code) { throw Object.assign(new Error(code), { code }); }
function regular(file, directory = false) {
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  if (stat && (stat.isSymbolicLink() || (directory ? !stat.isDirectory() : !stat.isFile() || stat.nlink !== 1))) fail("UNSAFE_RESOURCE_PATH");
  return stat;
}
function safeParents(directory, create = false) {
  const absolute = path.resolve(directory);
  const parts = absolute.split(path.sep).filter(Boolean);
  let current = path.parse(absolute).root;
  for (const part of parts) {
    current = path.join(current, part);
    if (!regular(current, true)) {
      if (!create) return;
      fs.mkdirSync(current, { mode: 0o755 });
      regular(current, true);
    }
    const stat = fs.lstatSync(current);
    const uid = typeof process.getuid === "function" ? process.getuid() : stat.uid;
    // Root-owned system parents and sticky /tmp are trusted. Other parents must
    // be caller-owned and cannot allow another user to swap child directories.
    if (stat.uid !== 0 && stat.uid !== uid) fail("UNSAFE_RESOURCE_PATH");
    if ((stat.mode & 0o022) && !(stat.uid === 0 && (stat.mode & 0o1000))) fail("UNSAFE_RESOURCE_PATH");
  }
}
function read(file) {
  regular(file);
  const fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
  try { return fs.readFileSync(fd); } finally { fs.closeSync(fd); }
}

function renderPlan(plan, output_directory) {
  if (!S.plainTree(plan) || !plan.applicable || !plan.inputs) fail("PLAN_NOT_APPLICABLE");
  const expected = planInfrastructure(plan.inputs.spec, plan.inputs.requirements, plan.inputs.adapter_input);
  if (!expected.applicable || expected.revision !== plan.revision || S.serialize(expected.artifacts) !== S.serialize(plan.artifacts)) fail("ARTIFACT_CONTENT_INVALID");
  if (typeof output_directory !== "string" || !path.isAbsolute(output_directory) || output_directory.split(path.sep).includes("..") || path.resolve(output_directory) === path.parse(output_directory).root) fail("UNSAFE_RESOURCE_PATH");
  safeParents(output_directory);
  for (const artifact of plan.artifacts) {
    if (path.isAbsolute(artifact.path) || artifact.path.includes("/") || artifact.path.includes("\\") || [".", ".."].includes(artifact.path)) fail("UNSAFE_RESOURCE_PATH");
  }
  const manifest_file = path.join(output_directory, ".infra-layer-render.json");
  let previous = null;
  if (regular(manifest_file)) {
    try { previous = JSON.parse(read(manifest_file)); } catch (_) { fail("RENDER_OWNERSHIP_INVALID"); }
    if (!S.plainTree(previous) || previous.owner !== "drumee-infra-layer" || previous.instance !== plan.inputs.spec.instance.id || previous.project !== plan.inputs.adapter_input.project || !S.record(previous.artifacts)) fail("RENDER_OWNERSHIP_INVALID");
  }
  const old_files = new Map();
  for (const artifact of plan.artifacts) {
    const file = path.join(output_directory, artifact.path);
    if (regular(file)) {
      const content = read(file);
      if (!previous || previous.artifacts[artifact.path] !== S.digest(content.toString("utf8"))) fail("RENDER_DESTINATION_UNOWNED");
      old_files.set(artifact.path, content);
    }
  }
  safeParents(output_directory, true);
  const staging = fs.mkdtempSync(path.join(output_directory, ".infra-render-"));
  const new_manifest = { owner: "drumee-infra-layer", instance: plan.inputs.spec.instance.id, project: plan.inputs.adapter_input.project, revision: plan.revision, artifacts: Object.fromEntries(plan.artifacts.map((artifact) => [artifact.path, artifact.digest])) };
  const contents = [...plan.artifacts, { path: ".infra-layer-render.json", content: `${JSON.stringify(new_manifest, null, 2)}\n`, mode: 0o644 }];
  if (previous) old_files.set(".infra-layer-render.json", read(manifest_file));
  const renamed = [];
  try {
    for (const artifact of contents) {
      const fd = fs.openSync(path.join(staging, artifact.path), "wx", artifact.mode);
      try { fs.writeFileSync(fd, artifact.content); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    for (const artifact of contents) {
      safeParents(output_directory);
      regular(path.join(output_directory, artifact.path));
      fs.renameSync(path.join(staging, artifact.path), path.join(output_directory, artifact.path));
      renamed.push(artifact.path);
    }
  } catch (error) {
    for (const name of renamed.reverse()) {
      if (old_files.has(name)) {
        const rollback = path.join(staging, crypto.randomUUID()); fs.writeFileSync(rollback, old_files.get(name));
        fs.renameSync(rollback, path.join(output_directory, name));
      } else fs.unlinkSync(path.join(output_directory, name));
    }
    throw error;
  } finally { fs.rmSync(staging, { recursive: true, force: true }); }
  return { revision: plan.revision, files: plan.artifacts.map((artifact) => path.join(output_directory, artifact.path)), activated: false };
}
module.exports = { renderPlan };
