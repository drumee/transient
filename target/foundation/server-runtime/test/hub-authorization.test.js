"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { DescriptorRegistry, HubAuthorizer, ServiceDispatcher, createAuthorizer } = require("../lib");
const { permissionValue } = require("../../../../sources/server-essentials/lib/lex/permission");

function session({ uid = "a000000000000001", domain_id = 1, authenticated = true, kind = "drumate", status = "ok" } = {}) {
  return {
    uid: () => uid,
    identity: () => ({ id: uid, domainId: domain_id, kind }),
    isAuthenticated: () => authenticated,
    status: () => status
  };
}

test("Hub scope resolves an opaque selection into one authoritative internal context", async () => {
  const calls = [];
  const resolver = {
    async resolveAuthorized(value) {
      calls.push(value);
      if (value.hub_id !== "a000000000000001") throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" });
      return Object.freeze({ ...value, type: "hub", database_name: "internal_hub_a", authorized: true });
    }
  };
  const hubAuthorizer = new HubAuthorizer({ resolver, permissionValue });
  const decision = await hubAuthorizer.authorize({
    session: session(),
    input: { hub_id: "a000000000000001", database_name: "attacker_database" },
    permission: { scope: "hub", src: permissionValue("write"), capabilities: ["fixture"] }
  });
  assert.equal(decision.granted, true);
  assert.equal(decision.hub_context.database_name, "internal_hub_a");
  assert.deepEqual(calls[0], {
    hub_id: "a000000000000001",
    uid: "a000000000000001",
    organisation_id: 1,
    asked_permission: permissionValue("write"),
    capabilities: ["fixture"]
  });
});

test("anonymous, nobody, OTP/intermediate and unauthorized Hub selections fail closed", async () => {
  const hubAuthorizer = new HubAuthorizer({ resolver: { async resolveAuthorized() { throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" }); } }, permissionValue });
  const input = { hub_id: "a000000000000001" };
  const permission = { scope: "hub", src: permissionValue("read") };
  assert.equal((await hubAuthorizer.authorize({ session: session({ authenticated: false, status: "otp" }), input, permission })).reason, "HUB_AUTHENTICATION_REQUIRED");
  assert.equal((await hubAuthorizer.authorize({ session: session({ kind: "nobody" }), input, permission })).reason, "HUB_PRINCIPAL_INVALID");
  assert.equal((await hubAuthorizer.authorize({ session: session(), input: { hub_id: "bad" }, permission })).reason, "HUB_SELECTION_REQUIRED");
  assert.equal((await hubAuthorizer.authorize({ session: session(), input, permission })).reason, "HUB_PERMISSION_DENIED");
});

test("dispatcher injects authorized Hub context and never substitutes client physical parameters", async () => {
  const registry = new DescriptorRegistry({ permissionValue });
  registry.registerDescriptor("fixture", {
    modules: { private: "service/fixture.js" },
    services: { probe: { scope: "hub", permission: { src: "read", selector: "hub_id", capabilities: ["fixture"] } } }
  }, { workdir: "/trusted" });
  const expected = Object.freeze({ hub_id: "a000000000000001", database_name: "trusted_shard", authorized: true });
  const authorizer = createAuthorizer({ hubAuthorizer: new HubAuthorizer({ resolver: { async resolveAuthorized() { return expected; } }, permissionValue }) });
  class Worker {
    constructor(options) { this.context = options.hub_context; }
    probe(input) { return { context: this.context, client_database: input.database_name }; }
  }
  const dispatcher = new ServiceDispatcher({ registry, authorize: authorizer, requireWorker: () => Worker });
  const result = await dispatcher.dispatch({ service: "fixture.probe", session: session(), input: { hub_id: expected.hub_id, database_name: "attacker_shard" } });
  assert.equal(result.context, expected);
  assert.equal(result.context.database_name, "trusted_shard");
  assert.equal(result.client_database, "attacker_shard");
});

test("Hub ACL keeps canonical permission bits distinct and denies before worker construction", async () => {
  const seen = [];
  const registry = new DescriptorRegistry({ permissionValue });
  registry.registerDescriptor("fixture", {
    modules: { private: "service/fixture.js" },
    services: {
      read: { scope: "hub", permission: { src: "read" } },
      write: { scope: "hub", permission: { src: "write" } },
      delete: { scope: "hub", permission: { src: "delete" } },
      admin: { scope: "hub", permission: { src: "admin" } },
      owner: { scope: "hub", permission: { src: "owner" } }
    }
  }, { workdir: "/trusted" });
  const resolver = {
    async resolveAuthorized({ asked_permission }) {
      seen.push(asked_permission);
      if (asked_permission !== permissionValue("read")) throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" });
      return Object.freeze({ hub_id: "a000000000000001", asked_permission, privilege: 3, authorized: true });
    }
  };
  let constructions = 0;
  class Worker {
    constructor() { constructions++; }
    read() { return "ok"; }
  }
  const dispatcher = new ServiceDispatcher({
    registry,
    authorize: createAuthorizer({ hubAuthorizer: new HubAuthorizer({ resolver, permissionValue }) }),
    requireWorker: () => Worker
  });
  const input = { hub_id: "a000000000000001" };
  assert.equal(await dispatcher.dispatch({ service: "fixture.read", session: session(), input }), "ok");
  for (const name of ["write", "delete", "admin", "owner"]) {
    await assert.rejects(() => dispatcher.dispatch({ service: `fixture.${name}`, session: session(), input }), (error) => error.code === "PERMISSION_DENIED");
  }
  assert.deepEqual(seen, ["read", "write", "delete", "admin", "owner"].map(permissionValue));
  assert.equal(constructions, 1);
});

test("dispatcher injects independent authorized Hub contexts for cross-Hub MFS work", async () => {
  const registry = new DescriptorRegistry({ permissionValue });
  registry.registerDescriptor("mfs-fixture", {
    modules: { private: "service/mfs-fixture.js" },
    requires: ["system-mfs"],
    services: { copy: { scope: "mfs", permission: { src: "read", dest: "write" } } }
  }, { workdir: "/trusted" });
  const source = { hub_id: "a000000000000001", nid: "b000000000000002" };
  const destination = { hub_id: "c000000000000003", nid: "d000000000000004" };
  const resolver_calls = [];
  const hubAuthorizer = new HubAuthorizer({
    permissionValue,
    resolver: {
      async resolveAuthorized(request) {
        resolver_calls.push(request);
        return Object.freeze({ hub_id: request.hub_id, database_name: `trusted_${request.hub_id}`, authorized: true });
      }
    }
  });
  const mfsPermissionBackend = {
    async resources() { return { src: [source], dest: [destination] }; },
    async effectivePermission() { return 63; }
  };
  class Worker {
    constructor(options) { this.contexts = options.hub_contexts; }
    copy(input) { return { contexts: this.contexts, attacker_database: input.database_name }; }
  }
  const dispatcher = new ServiceDispatcher({
    registry,
    authorize: createAuthorizer({ hubAuthorizer, mfsPermissionBackend }),
    capability_resolver: { async requireAll() {} },
    requireWorker: () => Worker
  });
  const result = await dispatcher.dispatch({ service: "mfs-fixture.copy", session: session(), input: { sources: [source], destination, database_name: "attacker" } });
  assert.deepEqual(Object.keys(result.contexts).sort(), [source.hub_id, destination.hub_id].sort());
  assert.equal(result.contexts[source.hub_id].database_name, `trusted_${source.hub_id}`);
  assert.equal(result.contexts[destination.hub_id].database_name, `trusted_${destination.hub_id}`);
  assert.equal(result.attacker_database, "attacker");
  assert.deepEqual(resolver_calls.map(({ hub_id, asked_permission, capabilities }) => ({ hub_id, asked_permission, capabilities })), [
    { hub_id: source.hub_id, asked_permission: permissionValue("read"), capabilities: ["system-mfs"] },
    { hub_id: destination.hub_id, asked_permission: permissionValue("write"), capabilities: ["system-mfs"] }
  ]);
});
