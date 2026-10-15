"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path");
const runtime = require("@drumee/server-runtime");
test("corrected canonical archive exposes the named independent policy", () => {
  assert.deepEqual(runtime.PLATFORM_PERMISSION, { operator: 1, support: 2, manager: 4, root: 8 });
  assert.equal(runtime.PLATFORM_ADMINISTRATOR.remit, 15);
  assert.equal(require("@drumee/server-runtime/platform-authority").PlatformAuthorizer, runtime.PlatformAuthorizer);
});
test("lockfile pins corrected source rather than claiming registry alpha.3 has new APIs", () => {
  const lock = require("../../package-lock.json"), record = lock.packages["node_modules/@drumee/server-runtime"];
  assert.equal(record.resolved, "https://codeload.github.com/drumee/server-runtime/tar.gz/a6c4dbf24b036255ea0dbfe70dbe80a402c990b0");
  assert.match(record.integrity, /^sha512-/);
  const package_root = path.dirname(require.resolve("@drumee/server-runtime/package.json"));
  const manifest = JSON.parse(fs.readFileSync(path.join(package_root, "schemas/SCHEMA_MANIFEST.json")));
  assert.equal(manifest.schemaVersion, runtime.PLATFORM_AUTHORITY_SCHEMA_VERSION);
  assert.deepEqual(manifest.upgrade.entrypoints, ["schemas/yellow-page/platform-authority-v1.sql"]);
});
test("full administrator request rejects weak intersection and domain cumulative words", async () => {
  const session = { isAuthenticated: () => true, uid: () => "a000000000000001", identity: () => ({ id: "a000000000000001", kind: "drumate", ident: "human", domainId: 1 }) };
  for (const remit of [0, 1, 3, 7, 8, 15, 127]) {
    const authorizer = new runtime.PlatformAuthorizer({ store: { platformRemit: async () => remit } });
    assert.equal((await authorizer.authorize({ session, permission: { scope: "platform", src: "PLATFORM_ADMINISTRATOR" } })).granted, [15, 127].includes(remit));
    assert.equal((await authorizer.authorize({ session, permission: { scope: "platform", src: 63 } })).reason, "PLATFORM_PERMISSION_INVALID");
  }
});
test("provider absence fails closed for both spellings without calling domain authorizer", async () => {
  let fallback = 0;
  const authorize = runtime.createAuthorizer({ domainAuthorizer: { authorize: async () => { fallback++; return { granted: true }; } } });
  for (const scope of ["platform", "plateform"]) assert.equal((await authorize({ permission: { scope, src: 15, fast_check: "public-api" } })).reason, "PLATFORM_AUTHORIZER_REQUIRED");
  assert.equal(fallback, 0);
});
