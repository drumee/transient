"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { authorizeMfs, createAuthorizer } = require("../lib");

const node = { hub_id: "hub-1", nid: "node-1" };

function backend(permission = 0) {
  return {
    async resources() { return { src: [node], dest: [node] }; },
    async effectivePermission() { return permission; }
  };
}

test("MFS decisions are made by the runtime from trusted Session.uid()", async () => {
  const resolved = { permission: { scope: "mfs", src: 1 }, session: { uid: () => "trusted" }, input: { uid: "attacker" } };
  assert.equal((await authorizeMfs(resolved, backend(1))).granted, true);
  assert.equal((await authorizeMfs(resolved, backend(0))).granted, false);
  assert.equal((await authorizeMfs({ ...resolved, session: {} }, backend(1))).granted, false);
});

test("missing backends and unsupported scopes fail closed", async () => {
  assert.equal((await createAuthorizer()({ permission: { scope: "mfs", src: 1 }, session: { uid: () => "trusted" } })).granted, false);
  assert.equal((await createAuthorizer()({ permission: { scope: "unknown" } })).granted, false);
});
