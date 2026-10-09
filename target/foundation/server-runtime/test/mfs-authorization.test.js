"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { authorizeMfs, createAuthorizer } = require("../lib");

const node = { hub_id: "a000000000000001", nid: "b000000000000002" };

function backend(permission = 0) {
  return {
    async resources() { return { src: [node], dest: [node] }; },
    async effectivePermission() { return permission; }
  };
}

function hubs({ denied = [] } = {}) {
  return {
    async authorizeResource({ hub_id, asked_permission, capabilities }) {
      if (denied.includes(hub_id)) return { granted: false, mode: "hub", reason: "HUB_PERMISSION_DENIED" };
      return { granted: true, mode: "hub", hub_context: Object.freeze({ hub_id, asked_permission, capabilities, database_name: `trusted_${hub_id}` }) };
    }
  };
}

test("MFS decisions are made by the runtime from trusted Session.uid()", async () => {
  const resolved = { permission: { scope: "mfs", src: 1 }, session: { uid: () => "trusted" }, input: { uid: "attacker" } };
  assert.equal((await authorizeMfs(resolved, backend(1), hubs())).granted, true);
  assert.equal((await authorizeMfs(resolved, backend(0), hubs())).granted, false);
  assert.equal((await authorizeMfs({ ...resolved, session: {} }, backend(1), hubs())).granted, false);
});

test("MFS authorizes every source and destination Hub independently and requires system-mfs readiness", async () => {
  const source = { hub_id: "a000000000000001", nid: "b000000000000002" };
  const destination = { hub_id: "c000000000000003", nid: "d000000000000004" };
  const calls = [];
  const hub_authorizer = {
    async authorizeResource(request) {
      calls.push(request);
      return { granted: true, hub_context: { hub_id: request.hub_id, database_name: `trusted_${request.hub_id}` } };
    }
  };
  const permission_backend = {
    async resources() { return { src: [source], dest: [destination] }; },
    async effectivePermission() { return 63; }
  };
  const resolved = {
    permission: { scope: "mfs", src: 2, dest: 4 },
    requires: ["system-mfs"],
    session: { uid: () => "trusted" }
  };
  const decision = await authorizeMfs(resolved, permission_backend, hub_authorizer);
  assert.equal(decision.granted, true);
  assert.deepEqual(calls.map(({ hub_id, asked_permission, capabilities }) => ({ hub_id, asked_permission, capabilities })), [
    { hub_id: source.hub_id, asked_permission: 2, capabilities: ["system-mfs"] },
    { hub_id: destination.hub_id, asked_permission: 4, capabilities: ["system-mfs"] }
  ]);
  assert.deepEqual(Object.keys(decision.hub_contexts).sort(), [source.hub_id, destination.hub_id].sort());

  const denied = await authorizeMfs(resolved, permission_backend, hubs({ denied: [destination.hub_id] }));
  assert.equal(denied.granted, false);
  assert.equal(denied.side, "dest");
  assert.equal(denied.hub_id, destination.hub_id);
});

test("missing backends and unsupported scopes fail closed", async () => {
  assert.equal((await createAuthorizer()({ permission: { scope: "mfs", src: 1 }, session: { uid: () => "trusted" } })).granted, false);
  assert.equal((await authorizeMfs({ permission: { scope: "mfs", src: 1 }, session: { uid: () => "trusted" } }, backend(1))).reason, "HUB_AUTHORIZER_REQUIRED");
  assert.equal((await createAuthorizer()({ permission: { scope: "unknown" } })).granted, false);
});
