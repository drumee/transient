"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const runtime = require("@drumee/server-runtime");
const target_runtime = require("../../../../foundation/server-runtime/lib");
const Constants = require("../../../../../sources/server-essentials/lib/lex/constants");
const { permissionValue } = require("../../../../../sources/server-essentials/lib/lex/permission");
const Remit = require("../../../../../sources/server-essentials/lib/lex/remit");
test("historical root remit, organisation owner and Hub owner are not interchangeable", () => {
  assert.equal(Remit.ROOT, 127); assert.equal(Remit.DOM_OWNER, 63);
  assert.equal(Constants.REMIT_ROOT, 8); assert.equal(Constants.permission.admin, 16);
  assert.equal(permissionValue("root"), 0);
  // These values are evidence, not a selected PLATFORM_ADMINISTRATOR policy.
  assert.notEqual(Remit.ROOT, Remit.DOM_OWNER);
});
for (const [label, api] of [["published alpha.3", runtime], ["transitional runtime", target_runtime]]) {
  test(`${label} rejects historical and correctly spelled platform scopes before worker loading`, async () => {
    for (const scope of ["plateform", "platform"]) {
      let workers_loaded = 0, domain_calls = 0;
      const registry = new api.DescriptorRegistry({ permissionValue });
      registry.registerDescriptor("contract", { modules: { private: "unused" }, services: { administer: { scope, permission: { src: "read" } } } }, { workdir: __dirname });
      const dispatcher = new api.ServiceDispatcher({ registry, authorize: api.createAuthorizer({ domainAuthorizer: { async authorize() { domain_calls++; return { granted: true }; } } }), requireWorker() { workers_loaded++; throw Error("MUST_NOT_LOAD"); } });
      // Unit seam only; integration uses an actual SQL-authenticated KernelSession.
      const session = { isAuthenticated: () => true, identity: () => ({ id: "a000000000000001", domainId: 1, kind: "drumate" }) };
      await assert.rejects(dispatcher.dispatch({ service: "contract.administer", session }), error => error.code === "PERMISSION_DENIED" && error.details?.reason === "UNSUPPORTED_PERMISSION_SCOPE");
      assert.equal(workers_loaded, 0); assert.equal(domain_calls, 0);
    }
  });
}
test("a cumulative domain word cannot establish platform authority through domain authorization", async () => {
  const authorizer = new runtime.DomainAuthorizer({ store: { async domainPermission(_uid, _domain_id, asked) { return Remit.DOM_OWNER & asked; } } });
  const session = { isAnonymous: () => false, isAuthenticated: () => true, identity: () => ({ id: "a000000000000001", domainId: 1 }) };
  assert.equal((await authorizer.authorize({ session, permission: { scope: "domain", src: Remit.ROOT } })).granted, true);
  assert.equal((await authorizer.authorize({ session, permission: { scope: "domain", src: Constants.REMIT_ROOT } })).granted, true);
});
