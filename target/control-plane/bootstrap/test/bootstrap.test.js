"use strict";

const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const { bootstrap, validate, NOBODY_UID } = require("../lib");

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

class MemoryStore {
  constructor(state = {}) {
    this.state = {
      organisation_table: false,
      domains: [],
      organisations: [],
      configuration: {},
      principals: [],
      ...clone(state)
    };
    this.ids = ["a000000000000001", "b000000000000002", "c000000000000003"];
    this.creations = 0;
  }

  async inspect() { return clone(this.state); }
  async installSchema() { this.state.organisation_table = true; }
  async transaction(operation) {
    const before = clone(this.state);
    try { return await operation(); } catch (error) { this.state = before; throw error; }
  }
  async generateId() { return this.ids.shift(); }
  async createDomain(name) { this.creations++; this.state.domains.push({ id: 1, name }); }
  async createOrganisation({ id, domain, name }) {
    this.creations++;
    this.state.organisations.push({ sys_id: 1, id, domain_id: 1, name, link: domain, ident: "drumee" });
  }
  async createPrincipal({ id, username, domain, privilege }) {
    this.creations++;
    this.state.principals.push({
      id, ident: username, username, type: "drumate", area: "system", status: "system",
      dom_id: 1, domain_id: 1, privilege, is_authoritative: 1,
      email: `${username}@${domain}`
    });
  }
  async setConfiguration(key, value) { this.creations++; this.state.configuration[key] = value; }
}

test("fresh bootstrap creates the minimal generated identity set", async () => {
  const store = new MemoryStore();
  const report = await bootstrap({ store, domain: "kernel.test" });
  assert.equal(report.valid, true);
  assert.equal(store.state.domains[0].id, 1);
  assert.equal(store.state.principals.find((row) => row.username === "nobody").id, NOBODY_UID);
  assert.equal(store.state.configuration.guest_id, "b000000000000002");
  assert.equal(store.state.principals.find((row) => row.username === "system").id, "c000000000000003");
  assert.notEqual(report.identities.guest, NOBODY_UID);
  assert.notEqual(report.identities.system, report.identities.guest);
  assert.equal(Object.hasOwn(store.state.configuration, "public_id"), false);
  assert.equal(Object.hasOwn(store.state.configuration, "system_id"), false);
});

test("bootstrap is idempotent and preserves generated identifiers", async () => {
  const store = new MemoryStore();
  const first = await bootstrap({ store, domain: "kernel.test" });
  const creations = store.creations;
  const second = await bootstrap({ store, domain: "kernel.test" });
  const third = await bootstrap({ store, domain: "kernel.test" });
  assert.equal(first.changed, true);
  assert.equal(second.changed, false);
  assert.equal(third.changed, false);
  assert.equal(store.creations, creations);
  assert.deepEqual(second.identities, first.identities);
});

test("partial bootstrap links an unambiguous existing guest and creates only missing objects", async () => {
  const store = new MemoryStore({
    domains: [{ id: 1, name: "kernel.test" }],
    principals: [{
      id: NOBODY_UID, ident: "nobody", username: "nobody", type: "drumate", area: "system",
      status: "system", dom_id: 1, domain_id: 1, privilege: 1, is_authoritative: 1
    }, {
      id: "e000000000000004", ident: "guest", username: "guest", type: "drumate", area: "system",
      status: "system", dom_id: 1, domain_id: 1, privilege: 1, is_authoritative: 1
    }]
  });
  const report = await bootstrap({ store, domain: "kernel.test" });
  assert.equal(report.valid, true);
  assert.equal(store.state.configuration.guest_id, "e000000000000004");
  assert.equal(store.state.principals.filter((row) => row.username === "guest").length, 1);
});

test("validation is read-only and reports missing invariants", async () => {
  const store = new MemoryStore();
  const before = clone(store.state);
  const report = await validate({ store, domain: "kernel.test" });
  assert.equal(report.status, "partial");
  assert.match(report.missing.join(" "), /organisation:1|organisation-table/);
  assert.match(report.missing.join(" "), /principal:nobody/);
  assert.deepEqual(store.state, before);
});

test("conflicting canonical and aliased identities fail deterministically", async () => {
  const store = new MemoryStore({
    organisation_table: true,
    domains: [{ id: 1, name: "kernel.test" }],
    organisations: [{ sys_id: 1, id: "a000000000000001", domain_id: 1, link: "kernel.test" }],
    configuration: { nobody_id: NOBODY_UID, guest_id: NOBODY_UID },
    principals: [{
      id: NOBODY_UID, ident: "nobody", username: "nobody", type: "drumate", area: "system",
      status: "system", dom_id: 1, domain_id: 1, privilege: 1, is_authoritative: 1
    }]
  });
  const report = await validate({ store, domain: "kernel.test" });
  assert.equal(report.status, "conflicting");
  assert.match(report.conflicts.join(" "), /guest resolves to nobody/);
  await assert.rejects(() => bootstrap({ store, domain: "kernel.test" }), (error) => error.code === "PLATFORM_BOOTSTRAP_CONFLICT");
});

test("a default domain claimed by another numeric id is a non-mutating conflict", async () => {
  const store = new MemoryStore({ domains: [{ id: 9, name: "kernel.test" }] });
  const before = clone(store.state);
  const report = await validate({ store, domain: "kernel.test" });
  assert.equal(report.status, "conflicting");
  assert.match(report.conflicts.join(" "), /belongs to another domain id/);
  await assert.rejects(() => bootstrap({ store, domain: "kernel.test" }), (error) => error.code === "PLATFORM_BOOTSTRAP_CONFLICT");
  assert.deepEqual(store.state, before);
});

test("implementation has no MFS, Hub, Team or filesystem provisioning calls", () => {
  const root = path.resolve(__dirname, "..");
  const implementation = ["lib/index.js", "lib/store.js", "schemas/001-organisation.sql"]
    .map((filename) => fs.readFileSync(path.join(root, filename), "utf8"))
    .join("\n");
  assert.doesNotMatch(implementation, /mfs_init_folders|desk_create_hub|createSystemHub|createMediaHub|server-team|ui-team|mkdirSync|writeFileSync/i);
});
