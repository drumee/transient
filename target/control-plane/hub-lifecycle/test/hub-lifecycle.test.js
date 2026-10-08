"use strict";

const assert = require("node:assert/strict");
const test = require("node:test");
const { HubLifecycle, ModuleRegistry, createAclContract } = require("../lib");
const { normalizeManifest } = require("../lib/manifest");
const Constants = require("../../../../sources/server-essentials/lib/lex/constants");

const ACL = createAclContract(Constants);

function manifest(module_id, { inherit, requires = [], objects = [module_id.replaceAll("-", "_")] } = {}) {
  return normalizeManifest(module_id, {
    owner: `@fixture/${module_id}`,
    schemaVersion: "1",
    ...(inherit === undefined ? {} : { inherit }),
    requires,
    provision: objects.map((name, index) => ({ order: index + 1, target: "hub", objectType: "table", objectName: name, path: `server/schemas/${name}.sql` }))
  }, { package_metadata: { version: "1.0.0" }, manifest_path: `/trusted/${module_id}/server/schemas/SCHEMA_MANIFEST.json` });
}

function session(uid = "a000000000000001", domain_id = 1) {
  return {
    isAuthenticated: () => true,
    uid: () => uid,
    identity: () => ({ id: uid, domainId: domain_id, kind: "drumate" })
  };
}

class MemoryStore {
  constructor() {
    this.acl = ACL;
    this.serial = 0;
    this.requests = new Map();
    this.hubs = new Map();
    this.plans = new Map();
    this.capabilities = new Map();
    this.acls = new Map();
    this.objects = new Map();
  }
  async reserveRequest(value) {
    const key = `${value.organisation_id}:${value.creator_uid}:${value.creator_module}:${value.idempotency_key}`;
    const prior = this.requests.get(key);
    if (prior && prior.fingerprint !== value.fingerprint) { const error = new Error("conflict"); error.code = "HUB_IDEMPOTENCY_CONFLICT"; throw error; }
    if (prior) return structuredClone(this.hubs.get(prior.hub_id));
    const hub_id = (++this.serial).toString(16).padStart(16, "0");
    this.requests.set(key, { fingerprint: value.fingerprint, hub_id });
    this.hubs.set(hub_id, { hub_id, organisation_id: value.organisation_id, creator_uid: value.creator_uid, owner_id: value.creator_uid, creator_module: value.creator_module, inherit_policy: value.inherit, public_name: value.public_name, database_name: `hub_${hub_id}`, state: "allocating", type: "hub" });
    await this.setPrivilege(hub_id, value.creator_uid, this.acl.privilege.owner, value.creator_uid);
    return structuredClone(this.hubs.get(hub_id));
  }
  async ensureShard(hub) { const value = this.hubs.get(hub.hub_id); value.state = value.state === "allocating" ? "provisioning" : value.state; value.shard_exists = true; return structuredClone(value); }
  async getHub(hub_id) { const value = this.hubs.get(hub_id); return value && structuredClone(value); }
  async setPrivilege(hub_id, uid, privilege) { this.acls.set(`${hub_id}:${uid}`, this.acl.privilegeFor(privilege)); }
  async getPrivilege(hub_id, uid) { return this.acls.get(`${hub_id}:${uid}`) || 0; }
  async revokePrivilege(hub_id, uid) { this.acls.delete(`${hub_id}:${uid}`); }
  async resolveAuthorized({ hub_id, uid, organisation_id, asked_permission, capabilities = [] }) {
    const hub = this.hubs.get(hub_id);
    if (!hub) throw Object.assign(new Error("missing"), { code: "HUB_NOT_FOUND" });
    if (Number(hub.organisation_id) !== Number(organisation_id)) throw Object.assign(new Error("org"), { code: "HUB_ORGANISATION_MISMATCH" });
    const effective = await this.getPrivilege(hub_id, uid);
    const asked = this.acl.permissionFor(asked_permission);
    if (!this.acl.grants(effective, asked)) throw Object.assign(new Error("denied"), { code: "HUB_PERMISSION_DENIED" });
    for (const module_id of capabilities) if (this.capabilities.get(`${hub_id}:${module_id}`)?.status !== "ready") throw Object.assign(new Error("not ready"), { code: "HUB_CAPABILITY_NOT_READY" });
    return Object.freeze({ hub_id, uid, organisation_id, asked_permission: asked, privilege: effective, type: "hub", database_name: hub.database_name, authorized: true });
  }
  planKey(hub_id, fingerprint) { return `${hub_id}:${fingerprint}`; }
  async findPlan(hub_id, fingerprint) { const value = this.plans.get(this.planKey(hub_id, fingerprint)); return value && structuredClone(value); }
  async createPlan(hub_id, kind, fingerprint, snapshot) {
    const key = this.planKey(hub_id, fingerprint);
    if (!this.plans.has(key)) this.plans.set(key, { id: this.plans.size + 1, hub_id, kind, plan_fingerprint: fingerprint, snapshot: structuredClone(snapshot), status: "pending", cursor: 0 });
    return structuredClone(this.plans.get(key));
  }
  async beginCapability(hub_id, plan_id, module) {
    const key = `${hub_id}:${module.module_id}`;
    const prior = this.capabilities.get(key);
    if (prior && prior.applied_version === module.schema_version) return structuredClone(prior);
    const value = { hub_id, plan_id, module_id: module.module_id, target_version: module.schema_version, applied_version: prior?.applied_version || null, status: "provisioning", attempt: (prior?.attempt || 0) + 1 };
    this.capabilities.set(key, value);
    return structuredClone(value);
  }
  async claimObjects(hub_id, module_id, keys) {
    for (const object_key of keys) {
      const key = `${hub_id}:${object_key}`;
      const owner = this.objects.get(key);
      if (owner && owner !== module_id) throw Object.assign(new Error("collision"), { code: "SCHEMA_OBJECT_COLLISION" });
      this.objects.set(key, module_id);
    }
  }
  async finishCapability(hub_id, plan_id, module, index) {
    const capability = this.capabilities.get(`${hub_id}:${module.module_id}`);
    Object.assign(capability, { status: "ready", applied_version: module.schema_version });
    const plan = [...this.plans.values()].find((value) => value.id === plan_id);
    Object.assign(plan, { status: "running", cursor: index + 1, error_code: null });
  }
  async failCapability(hub_id, plan_id, module_id, code) {
    Object.assign(this.capabilities.get(`${hub_id}:${module_id}`), { status: "failed", error_code: code });
    Object.assign([...this.plans.values()].find((value) => value.id === plan_id), { status: "failed", error_code: code });
    Object.assign(this.hubs.get(hub_id), { state: "failed", error_code: code });
  }
  async finishPlan(hub_id, plan_id) {
    Object.assign([...this.plans.values()].find((value) => value.id === plan_id), { status: "ready", error_code: null });
    Object.assign(this.hubs.get(hub_id), { state: "ready", error_code: null });
    return this.getHub(hub_id);
  }
  async listHubs({ inherit, after = "", limit = 100 }) { return [...this.hubs.values()].filter((hub) => hub.inherit_policy === inherit && hub.hub_id > after).sort((a, b) => a.hub_id.localeCompare(b.hub_id)).slice(0, limit).map(({ hub_id }) => ({ hub_id })); }
}

function registry(records) {
  const value = new ModuleRegistry();
  for (const record of records) value.register(record);
  return value;
}

test("ACL contract is derived from server-essentials without a parallel numeric hierarchy", () => {
  assert.deepEqual(ACL.permission, { read: 2, write: 4, delete: 8, admin: 16, owner: 32 });
  assert.deepEqual(ACL.privilege, { read: 3, write: 7, delete: 15, admin: 31, owner: 63 });
  assert.equal(ACL.grants(ACL.privilege.write, ACL.permission.write), true);
  assert.equal(ACL.grants(ACL.privilege.write, ACL.permission.delete), false);
  assert.equal(ACL.grants(ACL.privilege.admin, ACL.permission.owner), false);
  assert.equal(ACL.grants(ACL.privilege.owner, ACL.permission.owner), true);
});

test("canonical manifest defaults inherit/requires and rejects unknown policy", () => {
  const value = manifest("fixture-default");
  assert.equal(value.inherit, "installed");
  assert.deepEqual(value.requires, []);
  assert.throws(() => manifest("fixture-invalid", { inherit: "everything" }), (error) => error.code === "SCHEMA_INHERIT_INVALID");
});

test("own follows transitive requires without letting dependency inherit restart global propagation", () => {
  const calls = [];
  const modules = registry([
    { module_id: "system-mfs", manifest: manifest("system-mfs", { inherit: "installed" }), handler: async () => calls.push("system-mfs") },
    { module_id: "own-app", manifest: manifest("own-app", { inherit: "own", requires: ["system-mfs"] }), handler: async () => calls.push("own-app") },
    { module_id: "unrelated", manifest: manifest("unrelated"), handler: async () => calls.push("unrelated") }
  ]);
  assert.deepEqual(modules.resolvePlan("own-app").modules.map((entry) => entry.module_id), ["system-mfs", "own-app"]);
});

test("dependencies are ordered and missing, inactive, version mismatch and cycles fail before execution", () => {
  const missing = registry([{ module_id: "app", manifest: manifest("app", { requires: ["absent"] }), handler: async () => {} }]);
  assert.throws(() => missing.resolvePlan("app"), (error) => error.code === "SCHEMA_DEPENDENCY_MISSING");
  const inactive = registry([
    { module_id: "base", manifest: manifest("base"), handler: async () => {}, active: false },
    { module_id: "app", manifest: manifest("app", { inherit: "own", requires: ["base"] }), handler: async () => {} }
  ]);
  assert.throws(() => inactive.resolvePlan("app"), (error) => error.code === "SCHEMA_DEPENDENCY_INACTIVE");
  const cycle = registry([
    { module_id: "a", manifest: manifest("a", { inherit: "own", requires: ["b"] }), handler: async () => {} },
    { module_id: "b", manifest: manifest("b", { requires: ["a"] }), handler: async () => {} }
  ]);
  assert.throws(() => cycle.resolvePlan("a"), (error) => error.code === "SCHEMA_DEPENDENCY_CYCLE");
});

test("installed and own creation are idempotent, isolated, ordered and public results hide shard locators", async () => {
  const store = new MemoryStore();
  const calls = [];
  const modules = registry([
    { module_id: "system-mfs", manifest: manifest("system-mfs"), handler: async ({ hub }) => calls.push(`${hub.hub_id}:system-mfs`) },
    { module_id: "installed-app", manifest: manifest("installed-app", { requires: ["system-mfs"] }), handler: async ({ hub }) => calls.push(`${hub.hub_id}:installed-app`) },
    { module_id: "own-app", manifest: manifest("own-app", { inherit: "own", requires: ["system-mfs"] }), handler: async ({ hub }) => calls.push(`${hub.hub_id}:own-app`) },
    { module_id: "unrelated", manifest: manifest("unrelated"), handler: async ({ hub }) => calls.push(`${hub.hub_id}:unrelated`) }
  ]);
  const lifecycle = new HubLifecycle({ store, registry: modules, can_create: async () => true });
  const [first, duplicate] = await Promise.all([
    lifecycle.createPrivateHub({ session: session(), creator_module: "installed-app", specification: { idempotency_key: "same-request", name: "A" } }),
    lifecycle.createPrivateHub({ session: session(), creator_module: "installed-app", specification: { idempotency_key: "same-request", name: "A" } })
  ]);
  assert.deepEqual(duplicate, first);
  assert.deepEqual(Object.keys(first).sort(), ["hub_id", "status"]);
  assert.equal(store.hubs.size, 1);
  const own = await lifecycle.createPrivateHub({ session: session(), creator_module: "own-app", specification: { idempotency_key: "own-request", name: "B" } });
  assert.notEqual(first.hub_id, own.hub_id);
  assert.deepEqual([...store.capabilities.values()].filter((entry) => entry.hub_id === own.hub_id).map((entry) => entry.module_id), ["system-mfs", "own-app"]);
  await assert.rejects(() => lifecycle.createPrivateHub({ session: session(), creator_module: "installed-app", specification: { idempotency_key: "same-request", name: "changed" } }), (error) => error.code === "HUB_IDEMPOTENCY_CONFLICT");
});

test("failed handler resumes the frozen plan on the same Hub and shard without replaying successful modules", async () => {
  const store = new MemoryStore();
  let base_calls = 0;
  let app_calls = 0;
  let fail = true;
  const modules = registry([
    { module_id: "base", manifest: manifest("base"), handler: async () => { base_calls++; } },
    { module_id: "app", manifest: manifest("app", { inherit: "own", requires: ["base"] }), handler: async () => { app_calls++; if (fail) { fail = false; throw Object.assign(new Error("fixture failure"), { code: "FIXTURE_INTERRUPTED" }); } } }
  ]);
  const lifecycle = new HubLifecycle({ store, registry: modules });
  const request = { session: session(), creator_module: "app", specification: { idempotency_key: "resume", name: "Resume" } };
  await assert.rejects(() => lifecycle.createPrivateHub(request), (error) => error.code === "FIXTURE_INTERRUPTED");
  const hub = [...store.hubs.values()][0];
  const database_name = hub.database_name;
  assert.equal(hub.state, "failed");
  const result = await lifecycle.createPrivateHub(request);
  assert.equal(result.hub_id, hub.hub_id);
  assert.equal(store.hubs.get(hub.hub_id).database_name, database_name);
  assert.equal(base_calls, 1);
  assert.equal(app_calls, 2);
  assert.equal(store.capabilities.get(`${hub.hub_id}:app`).attempt, 2);
});

test("a registry addition cannot mutate an existing plan and propagates only through later upgrade plans", async () => {
  const store = new MemoryStore();
  const modules = registry([{ module_id: "creator", manifest: manifest("creator"), handler: async () => {} }]);
  const lifecycle = new HubLifecycle({ store, registry: modules });
  const installed = await lifecycle.createPrivateHub({ session: session(), creator_module: "creator", specification: { idempotency_key: "installed", name: "Installed" } });
  const plan_before = [...store.plans.values()][0];
  modules.register({ module_id: "later", manifest: manifest("later"), handler: async () => {} });
  assert.deepEqual(plan_before.snapshot.modules.map((entry) => entry.module_id), ["creator"]);
  await lifecycle.upgradeExistingHubs({ inherit: "installed", limit: 10 });
  assert.equal(store.capabilities.get(`${installed.hub_id}:later`).status, "ready");
  assert.equal([...store.plans.values()].length, 2);
});

test("ownership collisions are rejected before a plan can execute", () => {
  const duplicate = "same_object";
  const modules = registry([
    { module_id: "a", manifest: manifest("a", { objects: [duplicate] }), handler: async () => {} },
    { module_id: "b", manifest: manifest("b", { objects: [duplicate] }), handler: async () => {} }
  ]);
  assert.throws(() => modules.resolvePlan("a"), (error) => error.code === "SCHEMA_OBJECT_COLLISION");
});

test("ACL uses canonical requested bits and cumulative read/write/delete/admin/owner privileges", async () => {
  const store = new MemoryStore();
  const modules = registry([{ module_id: "app", manifest: manifest("app", { inherit: "own" }), handler: async () => {} }]);
  const lifecycle = new HubLifecycle({ store, registry: modules });
  const created = await lifecycle.createPrivateHub({ session: session(), creator_module: "app", specification: { idempotency_key: "acl", name: "ACL" } });
  const owner = await store.resolveAuthorized({ hub_id: created.hub_id, uid: "a000000000000001", organisation_id: 1, asked_permission: ACL.permission.admin, capabilities: ["app"] });
  assert.equal(owner.privilege, ACL.privilege.owner);
  assert.equal(store.hubs.get(created.hub_id).creator_uid, owner.uid);

  const reader_uid = "b000000000000002";
  const writer_uid = "c000000000000003";
  const deleter_uid = "d000000000000004";
  const admin_uid = "e000000000000005";
  await lifecycle.grant({ actor_context: owner, target_uid: reader_uid, privilege: "read" });
  await lifecycle.grant({ actor_context: owner, target_uid: writer_uid, privilege: "write" });
  await lifecycle.grant({ actor_context: owner, target_uid: deleter_uid, privilege: "delete" });
  await lifecycle.grant({ actor_context: owner, target_uid: admin_uid, privilege: "admin" });
  assert.deepEqual([reader_uid, writer_uid, deleter_uid, admin_uid].map((uid) => store.acls.get(`${created.hub_id}:${uid}`)), [3, 7, 15, 31]);

  assert.equal((await store.resolveAuthorized({ hub_id: created.hub_id, uid: reader_uid, organisation_id: 1, asked_permission: ACL.permission.read })).authorized, true);
  await assert.rejects(() => store.resolveAuthorized({ hub_id: created.hub_id, uid: reader_uid, organisation_id: 1, asked_permission: ACL.permission.write }), (error) => error.code === "HUB_PERMISSION_DENIED");
  const writer = await store.resolveAuthorized({ hub_id: created.hub_id, uid: writer_uid, organisation_id: 1, asked_permission: ACL.permission.write });
  await assert.rejects(() => store.resolveAuthorized({ hub_id: created.hub_id, uid: writer_uid, organisation_id: 1, asked_permission: ACL.permission.delete }), (error) => error.code === "HUB_PERMISSION_DENIED");
  await assert.rejects(() => lifecycle.grant({ actor_context: writer, target_uid: reader_uid, privilege: "write" }), (error) => error.code === "HUB_PERMISSION_DENIED");
  assert.equal((await store.resolveAuthorized({ hub_id: created.hub_id, uid: deleter_uid, organisation_id: 1, asked_permission: ACL.permission.delete })).authorized, true);

  const admin = await store.resolveAuthorized({ hub_id: created.hub_id, uid: admin_uid, organisation_id: 1, asked_permission: ACL.permission.admin });
  await lifecycle.revoke({ actor_context: admin, target_uid: reader_uid });
  await assert.rejects(() => store.resolveAuthorized({ hub_id: created.hub_id, uid: reader_uid, organisation_id: 1, asked_permission: ACL.permission.read }), (error) => error.code === "HUB_PERMISSION_DENIED");
  await assert.rejects(() => lifecycle.grant({ actor_context: admin, target_uid: reader_uid, privilege: "owner" }), (error) => error.code === "HUB_OWNER_TRANSFER_REQUIRED");
  await assert.rejects(() => lifecycle.revoke({ actor_context: admin, target_uid: owner.uid }), (error) => error.code === "HUB_OWNER_REVOKE_DENIED");
  await assert.rejects(() => store.resolveAuthorized({ hub_id: created.hub_id, uid: admin_uid, organisation_id: 2, asked_permission: ACL.permission.read }), (error) => error.code === "HUB_ORGANISATION_MISMATCH");
});

test("physical locator and policy fields are rejected from public creation input", async () => {
  const lifecycle = new HubLifecycle({ store: new MemoryStore(), registry: registry([{ module_id: "app", manifest: manifest("app"), handler: async () => {} }]) });
  for (const field of ["database_name", "db_host", "creator_module", "inherit"]) {
    await assert.rejects(() => lifecycle.createPrivateHub({ session: session(), creator_module: "app", specification: { idempotency_key: `bad-${field}`, name: "Bad", [field]: "attacker" } }), (error) => error.code === "HUB_PUBLIC_INPUT_FORBIDDEN");
  }
});
