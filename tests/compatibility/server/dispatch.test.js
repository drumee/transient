const test = require("node:test");
const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const fs = require("node:fs");
const { resolveRepo } = require("../../helpers/repository");

const originalLoad = Module._load;
Module._load = function baselineMocks(request, parent, isMain) {
  if (request === "@drumee/server-essentials") {
    return { permissionValue: (v) => ({ anyone: 0, anonymous: 1, read: 3, write: 15, admin: 31, owner: 63 }[v] ?? v), sysEnv: () => ({}), Events: { DENIED: "denied", ERROR: "error", GRANTED: "granted" } };
  }
  if (request === "lodash") return { isFunction: (v) => typeof v === "function", isString: (v) => typeof v === "string", isArray: Array.isArray };
  if (request === "jsonfile") return { readFileSync: (file) => JSON.parse(fs.readFileSync(file, "utf8")) };
  return originalLoad(request, parent, isMain);
};
const Acl = require("../../../sources/server-team/router/rest");
Module._load = originalLoad;

test("built-in ACL discovery resolves valid module.method requests", async () => {
  await Acl.loadModules(resolveRepo("sources/server-team"));
  const resolved = Acl.getModule("yp.get_env?ignored=1", true);
  assert.equal(resolved.service, "yp.get_env");
  assert.equal(resolved.method, "get_env");
  assert.equal(resolved.permission.scope, "hub");
  assert.match(resolved.path, /server-team\/service\/yp\.js$/);
});

test("dispatch reports malformed, unknown-module, and unknown-method distinctly", () => {
  assert.equal(Acl.getModule("malformed", false).error, "WRONG_SERVICE_FORMAT");
  assert.equal(Acl.getModule("missing.method", false).error, "MODULE_NOT_FOUND");
  assert.equal(Acl.getModule("yp.missing", false).error, "SERVICE_NOT_FOUND");
});

test("plugin ACL discovery resolves loby and sandbox service implementations", async () => {
  await Acl.loadModules(resolveRepo("sources/loby"));
  await Acl.loadModules(resolveRepo("sources/sandbox-server"));
  assert.match(Acl.getModule("signup.get_info", true).path, /loby\/service\/signup\.js$/);
  assert.match(Acl.getModule("sandbox.load", true).path, /sandbox-server\/service\/index\.js$/);
  assert.equal(Acl.getModule("sandbox.nope", true).error, "SERVICE_NOT_FOUND");
});
