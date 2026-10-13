"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { fork } = require("node:child_process");
const { once } = require("node:events");
const api = require("../../lib");
const { inputs } = require("../support/inputs");
function plan(changed = false) { const value = inputs(); if (changed) value.requirements.http.service_endpoint.port++; return api.planInfrastructure(value.spec, value.requirements, value.adapter_input); }
function temp(t) { const directory = fs.mkdtempSync(path.join(os.tmpdir(), "infra-lock-")); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; }
async function writer(t, directory, after_replace = false) {
  const script = path.join(directory, "writer.cjs"); const release = path.join(directory, "release"); const plan_file = path.join(directory, "plan.json"); fs.writeFileSync(plan_file, JSON.stringify(plan(after_replace)));
  fs.writeFileSync(script, `const fs=require('node:fs'); const original=fs.renameSync; let paused=false;
fs.renameSync=(...args)=>{if(!paused){paused=true; ${after_replace ? "original(...args);" : ""} process.send('paused'); const a=new Int32Array(new SharedArrayBuffer(4)); while(!fs.existsSync(${JSON.stringify(release)}))Atomics.wait(a,0,0,25); ${after_replace ? "return;" : ""}}return original(...args);};
require(${JSON.stringify(path.resolve(__dirname, "../../lib"))}).renderPlan(JSON.parse(fs.readFileSync(${JSON.stringify(plan_file)})),${JSON.stringify(directory)});`);
  const child = fork(script, [], { stdio: ["ignore", "ignore", "ignore", "ipc"] }); t.after(() => { if (child.exitCode === null) child.kill("SIGKILL"); });
  const ready = await Promise.race([once(child, "message"), once(child, "exit").then(() => { throw new Error("WRITER_EXITED_EARLY"); })]); assert.equal(ready[0], "paused");
  return { child, release };
}
test("two competing processes: the second render is explicitly rejected while the first owns the lock", async (t) => {
  const directory = temp(t); const { child, release } = await writer(t, directory);
  assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_LOCKED" });
  const exited = once(child, "exit"); fs.writeFileSync(release, "release"); assert.equal((await exited)[0], 0);
  assert.equal(fs.existsSync(path.join(directory, ".infra-layer-render.lock")), false); api.renderPlan(plan(), directory);
});
test("interrupted writer leaves a stale lock; no PID/time-based takeover occurs", async (t) => {
  const directory = temp(t); const { child } = await writer(t, directory); const exited = once(child, "exit"); child.kill("SIGKILL"); await exited;
  assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_LOCKED" });
  // Explicit test-owner recovery after the known child exited, before any rename.
  fs.rmSync(path.join(directory, ".infra-layer-render.lock"), { recursive: true });
  for (const name of fs.readdirSync(directory)) if (name.startsWith(".infra-render-")) fs.rmSync(path.join(directory, name), { recursive: true });
  api.renderPlan(plan(), directory);
});
test("crash after individual replacement is not crash-atomic and cannot silently overwrite the mixed revision", async (t) => {
  const directory = temp(t); api.renderPlan(plan(), directory); const manifest = fs.readFileSync(path.join(directory, ".infra-layer-render.json"));
  const { child } = await writer(t, directory, true); const exited = once(child, "exit"); child.kill("SIGKILL"); await exited;
  assert.deepEqual(fs.readFileSync(path.join(directory, ".infra-layer-render.json")), manifest);
  assert.throws(() => api.renderPlan(plan(true), directory), { code: "RENDER_LOCKED" });
  fs.rmSync(path.join(directory, ".infra-layer-render.lock"), { recursive: true });
  assert.throws(() => api.renderPlan(plan(true), directory), { code: "RENDER_DESTINATION_UNOWNED" });
});
test("corrupt manifest refuses recovery, preserves artifacts and unrelated files, and releases its own lock", (t) => {
  const directory = temp(t); api.renderPlan(plan(), directory); const nginx = fs.readFileSync(path.join(directory, "nginx.conf"));
  fs.writeFileSync(path.join(directory, "unrelated"), "preserve"); fs.writeFileSync(path.join(directory, ".infra-layer-render.json"), "{corrupted");
  assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_OWNERSHIP_INVALID" });
  assert.deepEqual(fs.readFileSync(path.join(directory, "nginx.conf")), nginx); assert.equal(fs.readFileSync(path.join(directory, "unrelated"), "utf8"), "preserve"); assert.equal(fs.existsSync(path.join(directory, ".infra-layer-render.lock")), false);
});
for (const replacement of ["symlink", "hardlink", "edited"]) test(`destination ${replacement} replacement during staging fails before a commit`, (t) => {
  const directory = temp(t); api.renderPlan(plan(), directory); const destination = path.join(directory, "nginx.conf");
  const other = path.join(directory, "unrelated"); fs.writeFileSync(other, "preserve"); const original = fs.fsyncSync; let replaced = false;
  fs.fsyncSync = (...args) => { original(...args); if (!replaced) { replaced = true; if (replacement === "edited") fs.writeFileSync(destination, "edited"); else { fs.unlinkSync(destination); if (replacement === "symlink") fs.symlinkSync(other, destination); else fs.linkSync(other, destination); } } };
  try { assert.throws(() => api.renderPlan(plan(true), directory), { code: replacement === "edited" ? "RENDER_DESTINATION_CHANGED" : "UNSAFE_RESOURCE_PATH" }); } finally { fs.fsyncSync = original; }
  assert.equal(fs.readFileSync(other, "utf8"), "preserve"); assert.equal(fs.existsSync(path.join(directory, ".infra-layer-render.lock")), false);
});
test("a symlink or pre-existing stale lock is never followed or removed", (t) => {
  const directory = temp(t); const other = fs.mkdtempSync(path.join(os.tmpdir(), "infra-other-")); t.after(() => fs.rmSync(other, { recursive: true, force: true }));
  fs.symlinkSync(other, path.join(directory, ".infra-layer-render.lock")); assert.throws(() => api.renderPlan(plan(), directory), { code: "RENDER_LOCKED" }); assert.ok(fs.lstatSync(path.join(directory, ".infra-layer-render.lock")).isSymbolicLink()); assert.deepEqual(fs.readdirSync(other), []);
});
