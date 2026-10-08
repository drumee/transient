"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { DescriptorRegistry, HubAuthorizer, ServiceDispatcher, createAuthorizer } = require("../lib");

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
  const hubAuthorizer = new HubAuthorizer({ resolver });
  const decision = await hubAuthorizer.authorize({
    session: session(),
    input: { hub_id: "a000000000000001", database_name: "attacker_database" },
    permission: { scope: "hub", access: "write", capabilities: ["fixture"] }
  });
  assert.equal(decision.granted, true);
  assert.equal(decision.hub_context.database_name, "internal_hub_a");
  assert.deepEqual(calls[0], {
    hub_id: "a000000000000001",
    uid: "a000000000000001",
    organisation_id: 1,
    permission: "write",
    capabilities: ["fixture"]
  });
});

test("anonymous, nobody, OTP/intermediate and unauthorized Hub selections fail closed", async () => {
  const hubAuthorizer = new HubAuthorizer({ resolver: { async resolveAuthorized() { throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" }); } } });
  const input = { hub_id: "a000000000000001" };
  const permission = { scope: "hub", access: "read" };
  assert.equal((await hubAuthorizer.authorize({ session: session({ authenticated: false, status: "otp" }), input, permission })).reason, "HUB_AUTHENTICATION_REQUIRED");
  assert.equal((await hubAuthorizer.authorize({ session: session({ kind: "nobody" }), input, permission })).reason, "HUB_PRINCIPAL_INVALID");
  assert.equal((await hubAuthorizer.authorize({ session: session(), input: { hub_id: "bad" }, permission })).reason, "HUB_SELECTION_REQUIRED");
  assert.equal((await hubAuthorizer.authorize({ session: session(), input, permission })).reason, "HUB_PERMISSION_DENIED");
});

test("dispatcher injects authorized Hub context and never substitutes client physical parameters", async () => {
  const registry = new DescriptorRegistry();
  registry.registerDescriptor("fixture", {
    modules: { private: "service/fixture.js" },
    services: { probe: { scope: "hub", permission: { access: "read", selector: "hub_id", capabilities: ["fixture"] } } }
  }, { workdir: "/trusted" });
  const expected = Object.freeze({ hub_id: "a000000000000001", database_name: "trusted_shard", authorized: true });
  const authorizer = createAuthorizer({ hubAuthorizer: new HubAuthorizer({ resolver: { async resolveAuthorized() { return expected; } } }) });
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
