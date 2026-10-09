"use strict";

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const enabled = process.env.KERNEL_PHASE48B_LIVE === "1";
const root = path.resolve(__dirname, "../../..");
const lifecycle_root = path.join(root, "target/control-plane/hub-lifecycle");
const system_mfs_root = process.env.KERNEL_SYSTEM_MFS_ROOT || path.resolve(root, "../system-mfs");
const fixtures = path.join(root, "tests/fixtures/phase4.8b");
const { HubLifecycle, ModuleRegistry, SqlHubStore, createAclContract } = require(path.join(lifecycle_root, "lib"));
const { checksum, normalizeManifest, readModuleManifest } = require(path.join(lifecycle_root, "lib/manifest"));
const runtime = require(path.join(root, "target/foundation/server-runtime/lib"));
const { MfsPermissionBackend, MfsService } = require(path.join(root, "target/modules/mfs-service/lib"));
const Constants = require(path.join(root, "sources/server-essentials/lib/lex/constants"));
const { permissionValue } = require(path.join(root, "sources/server-essentials/lib/lex/permission"));
const systemMfs = require(path.join(system_mfs_root, "lib"));
const ACL = createAclContract(Constants);

const container = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";
const yp = process.env.KERNEL_DB_NAME || "yp";
const password = process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root";
const creator = "a000000000000001";

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}
function bind(sql, parameters) {
  let index = 0;
  const output = sql.replace(/\?/g, () => literal(parameters[index++]));
  if (index !== parameters.length) throw new Error("SQL parameter count mismatch");
  return output;
}
function parse(output) {
  const lines = output.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).filter((line) => line.split("\t").length === headers.length).map((line) => Object.fromEntries(line.split("\t").map((value, index) => [headers[index], value === "NULL" ? null : value])));
}
function mariadb(database_name, sql, { input } = {}) {
  const args = ["exec"];
  if (input !== undefined) args.push("-i");
  args.push("-e", `MYSQL_PWD=${password}`, container, "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "--batch", "--raw", database_name);
  if (input === undefined) args.push("--execute", sql);
  const result = child_process.spawnSync("docker", args, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  return parse(result.stdout);
}
function restartMariaDb() {
  const restarted = child_process.spawnSync("docker", ["restart", container], { encoding: "utf8" });
  if (restarted.status !== 0) throw new Error(`${restarted.stdout}\n${restarted.stderr}`.trim());
  let last_error = "MariaDB did not become ready";
  for (let attempt = 0; attempt < 60; attempt++) {
    const probe = child_process.spawnSync("docker", ["exec", "-e", `MYSQL_PWD=${password}`, container, "mariadb-admin", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "ping"], { encoding: "utf8" });
    if (probe.status === 0) return;
    last_error = `${probe.stdout}\n${probe.stderr}`.trim();
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error(last_error);
}
const database = {
  runtime_user: process.env.KERNEL_DB_USER || "kernel_phase4",
  async query(sql, ...parameters) { return mariadb(yp, bind(sql, parameters)); },
  async executeScript(script, { database: selected = yp } = {}) { mariadb(selected, "", { input: script }); },
  async queryIn(selected, sql, ...parameters) { return mariadb(selected, bind(sql, parameters)); }
};

function trustedSession(uid = creator, domain_id = 41) {
  return new runtime.KernelSession({
    store: { async signin() {}, async resolveSession() {} },
    identity: { id: uid, domainId: domain_id, kind: "drumate" },
    signedIn: true,
    status: "ok",
    contextSource: "phase4.9-live"
  });
}

function fixtureHandler(module_root, { fail_once = false } = {}) {
  let should_fail = fail_once;
  return async ({ hub }) => {
    const manifest = JSON.parse(fs.readFileSync(path.join(module_root, "server/schemas/SCHEMA_MANIFEST.json"), "utf8"));
    for (const entry of manifest.provision) await database.executeScript(fs.readFileSync(path.join(module_root, entry.path), "utf8"), { database: hub.database_name });
    if (should_fail) { should_fail = false; throw Object.assign(new Error("injected after SQL success"), { code: "FIXTURE_POST_SQL_INTERRUPTION" }); }
  };
}

function register(registry, module_id, module_root, handler, options = {}) {
  return registry.register({ module_id, module_root, manifest: readModuleManifest(module_id, module_root), handler, artifact_ref: `fixture:${module_id}:1`, ...options });
}

test("Phase 4.8B real MariaDB Hub lifecycle, ACL, propagation and recovery", { skip: !enabled, timeout: 240000 }, async (t) => {
  await database.executeScript("CREATE TABLE IF NOT EXISTS hub_acl (hub_id varchar(16) NOT NULL, uid varchar(16) NOT NULL, permission tinyint(3) unsigned NOT NULL, granted_by varchar(16) NOT NULL, ctime int unsigned NOT NULL, mtime int unsigned NOT NULL, PRIMARY KEY (hub_id,uid)) ENGINE=InnoDB", { database: yp });
  const store = new SqlHubStore({ database, acl: ACL });
  await store.install();
  const acl_columns = mariadb(yp, "SELECT column_name,is_nullable FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='hub_acl' ORDER BY ordinal_position");
  assert.equal(acl_columns.some((column) => column.column_name === "privilege" && column.is_nullable === "NO"), true);
  assert.equal(acl_columns.some((column) => column.column_name === "permission" && column.is_nullable === "YES"), true);
  const mfs_store = new systemMfs.SqlMfsStore({ database });
  await systemMfs.install({ store: mfs_store });
  const registry = new ModuleRegistry();
  register(registry, "system-mfs", system_mfs_root, async ({ hub }) => systemMfs.provision({ store: mfs_store, context: { hub_id: hub.hub_id } }), { artifact_ref: "system-mfs:a7f7395b" });
  const installed_root = path.join(fixtures, "installed-module");
  const own_root = path.join(fixtures, "own-module");
  register(registry, "installed-module", installed_root, fixtureHandler(installed_root));
  register(registry, "own-module", own_root, fixtureHandler(own_root));
  const lifecycle = new HubLifecycle({ store, registry, can_create: async ({ organisation_id }) => organisation_id === 41 });

  const installed_request = { session: trustedSession(), creator_module: "installed-module", specification: { idempotency_key: "phase48b-installed", name: "Phase 48B installed" } };
  const installed = await lifecycle.createPrivateHub(installed_request);
  const duplicate = await lifecycle.createPrivateHub(installed_request);
  assert.deepEqual(duplicate, installed);
  assert.deepEqual(Object.keys(installed).sort(), ["hub_id", "status"]);
  const own = await lifecycle.createPrivateHub({ session: trustedSession(), creator_module: "own-module", specification: { idempotency_key: "phase48b-own", name: "Phase 48B own" } });
  assert.notEqual(own.hub_id, installed.hub_id);
  const installed_internal = await store.getHub(installed.hub_id);
  const own_internal = await store.getHub(own.hub_id);
  assert.notEqual(installed_internal.database_name, own_internal.database_name);
  assert.equal(mariadb(installed_internal.database_name, "SHOW TABLES LIKE 'media'").length, 1);
  assert.equal(mariadb(installed_internal.database_name, "SHOW TABLES LIKE 'phase48b_installed_marker'").length, 1);
  assert.equal(mariadb(installed_internal.database_name, "SHOW TABLES LIKE 'phase48b_own_marker'").length, 1);
  assert.equal(mariadb(own_internal.database_name, "SHOW TABLES LIKE 'media'").length, 1);
  assert.equal(mariadb(own_internal.database_name, "SHOW TABLES LIKE 'phase48b_own_marker'").length, 1);
  assert.equal(mariadb(own_internal.database_name, "SHOW TABLES LIKE 'phase48b_installed_marker'").length, 0);

  const mfs = new systemMfs.MfsNamespace({ store: mfs_store, context: { hub_id: installed.hub_id }, principal: creator });
  const ready = await systemMfs.validateProvisioning({ store: mfs_store, context: { hub_id: installed.hub_id } });
  const folder = await mfs.makeDirectory(ready.root_id, "Phase48B");
  assert.equal((await mfs.resolveNode(folder.nid)).filename, "Phase48B");

  const reader = "b000000000000002";
  const writer = "c000000000000003";
  const admin = "d000000000000004";
  const owner_context = await store.resolveAuthorized({ hub_id: installed.hub_id, uid: creator, organisation_id: 41, asked_permission: ACL.permission.admin, capabilities: ["installed-module"] });
  assert.equal(owner_context.privilege, ACL.privilege.owner);
  assert.equal(installed_internal.owner_id, creator);
  await lifecycle.grant({ actor_context: owner_context, target_uid: reader, privilege: "read" });
  await lifecycle.grant({ actor_context: owner_context, target_uid: writer, privilege: "write" });
  await lifecycle.grant({ actor_context: owner_context, target_uid: admin, privilege: "admin" });
  assert.equal(await store.getPrivilege(installed.hub_id, reader), ACL.privilege.read);
  assert.equal(await store.getPrivilege(installed.hub_id, writer), ACL.privilege.write);
  assert.equal(await store.getPrivilege(installed.hub_id, admin), ACL.privilege.admin);
  assert.equal((await store.resolveAuthorized({ hub_id: installed.hub_id, uid: reader, organisation_id: 41, asked_permission: ACL.permission.read })).authorized, true);
  await assert.rejects(() => store.resolveAuthorized({ hub_id: installed.hub_id, uid: reader, organisation_id: 41, asked_permission: ACL.permission.write }), (error) => error.code === "HUB_PERMISSION_DENIED");
  const writer_context = await store.resolveAuthorized({ hub_id: installed.hub_id, uid: writer, organisation_id: 41, asked_permission: ACL.permission.write });
  await assert.rejects(() => store.resolveAuthorized({ hub_id: installed.hub_id, uid: writer, organisation_id: 41, asked_permission: ACL.permission.delete }), (error) => error.code === "HUB_PERMISSION_DENIED");
  await assert.rejects(() => lifecycle.grant({ actor_context: writer_context, target_uid: reader, privilege: "write" }), (error) => error.code === "HUB_PERMISSION_DENIED");
  const admin_context = await store.resolveAuthorized({ hub_id: installed.hub_id, uid: admin, organisation_id: 41, asked_permission: ACL.permission.admin });
  await lifecycle.grant({ actor_context: admin_context, target_uid: reader, privilege: "read" });
  await assert.rejects(() => store.resolveAuthorized({ hub_id: own.hub_id, uid: reader, organisation_id: 41, asked_permission: ACL.permission.read }), (error) => error.code === "HUB_PERMISSION_DENIED");

  await database.executeScript("INSERT INTO phase48b_installed_marker(marker_key,marker_value) VALUES ('authorized','ok') ON DUPLICATE KEY UPDATE marker_value=VALUES(marker_value)", { database: installed_internal.database_name });
  const descriptors = new runtime.DescriptorRegistry({ permissionValue });
  descriptors.registerDescriptor("fixture", { modules: { private: "fixture.js" }, services: { read: { scope: "hub", permission: { src: "read", selector: "hub_id", capabilities: ["installed-module"] } } } }, { workdir: "/trusted" });
  class FixtureWorker {
    constructor({ hub_context }) { this.hub_context = hub_context; }
    async read() { return database.queryIn(this.hub_context.database_name, "CALL phase48b_installed_marker_read(?)", "authorized"); }
  }
  const dispatcher = new runtime.ServiceDispatcher({
    registry: descriptors,
    authorize: runtime.createAuthorizer({ hubAuthorizer: new runtime.HubAuthorizer({ resolver: store, permissionValue }) }),
    requireWorker: () => FixtureWorker
  });
  const procedure = await dispatcher.dispatch({ service: "fixture.read", session: trustedSession(), input: { hub_id: installed.hub_id, database_name: own_internal.database_name } });
  assert.equal(procedure[0].marker_value, "ok");

  const mfs_descriptors = new runtime.DescriptorRegistry({ permissionValue });
  mfs_descriptors.registerDirectory(path.join(root, "target/modules/mfs-service/server/acl"));
  const mfs_service = new MfsService({
    filesystem_factory(principal) {
      assert.ok(principal.hub_contexts && Object.keys(principal.hub_contexts).length >= 1, "authorized Hub contexts must reach the MFS service");
      return new systemMfs.MfsFilesystem({ store: mfs_store, principal: principal.uid });
    }
  });
  const mfs_dispatcher = new runtime.ServiceDispatcher({
    registry: mfs_descriptors,
    authorize: runtime.createAuthorizer({
      hubAuthorizer: new runtime.HubAuthorizer({ resolver: store, permissionValue }),
      mfsPermissionBackend: new MfsPermissionBackend({ permission_store: mfs_store })
    }),
    capability_resolver: new runtime.CapabilityResolver({ providers: { "system-mfs": async () => true } }),
    workerOptions: { mfs_service }
  });
  const own_ready = await systemMfs.validateProvisioning({ store: mfs_store, context: { hub_id: own.hub_id } });
  const root_a = { hub_id: installed.hub_id, nid: ready.root_id };
  const root_b = { hub_id: own.hub_id, nid: own_ready.root_id };
  const created_a = await mfs_dispatcher.dispatch({ service: "mfs.mkdir", session: trustedSession(), input: { destination: root_a, name: "Official-A", database_name: own_internal.database_name } });
  const nested_a = await mfs_dispatcher.dispatch({ service: "mfs.mkdir", session: trustedSession(), input: { destination: root_a, name: "Move-Me" } });
  await mfs_dispatcher.dispatch({ service: "mfs.move", session: trustedSession(), input: { nodes: [{ hub_id: installed.hub_id, nid: nested_a.result.nid }], destination: { hub_id: installed.hub_id, nid: created_a.result.nid } } });
  const copied_b = await mfs_dispatcher.dispatch({ service: "mfs.copy", session: trustedSession(), input: { sources: [{ hub_id: installed.hub_id, nid: created_a.result.nid }], destination: root_b, database_name: installed_internal.database_name } });
  assert.equal(copied_b.result.destination.hub_id, own.hub_id);
  assert.ok(copied_b.result.nodes.every((entry) => entry.node.hub_id === own.hub_id));
  assert.equal((await mfs_dispatcher.dispatch({ service: "mfs.list", session: trustedSession(), input: { location: root_a } })).items.some((item) => item.filename === "Official-A"), true);
  assert.equal((await mfs_dispatcher.dispatch({ service: "mfs.list", session: trustedSession(), input: { location: root_b } })).items.some((item) => item.filename === "Official-A"), true);
  await assert.rejects(() => mfs_dispatcher.dispatch({ service: "mfs.list", session: trustedSession(admin), input: { location: root_a } }), (error) => error.code === "PERMISSION_DENIED", "Hub admin does not bypass MFS node permissions");
  await assert.rejects(() => mfs_dispatcher.dispatch({ service: "mfs.copy", session: trustedSession(reader), input: { sources: [root_a], destination: root_b } }), (error) => error.code === "PERMISSION_DENIED", "source Hub read does not authorize the destination Hub");

  const later_root = path.join(fixtures, "later-module");
  register(registry, "later-module", later_root, fixtureHandler(later_root, { fail_once: true }));
  await database.executeScript("CREATE TABLE IF NOT EXISTS phase48b_sentinel (id INT PRIMARY KEY); INSERT IGNORE INTO phase48b_sentinel(id) VALUES (1)", { database: installed_internal.database_name });
  await assert.rejects(() => lifecycle.upgradeExistingHubs({ inherit: "installed", limit: 1 }), (error) => error.code === "FIXTURE_POST_SQL_INTERRUPTION");
  const failed = mariadb(yp, `SELECT status,attempt FROM hub_capability WHERE hub_id='${installed.hub_id}' AND module_id='later-module'`)[0];
  assert.equal(failed.status, "failed");
  assert.equal(mariadb(installed_internal.database_name, "SHOW TABLES LIKE 'phase48b_later_marker'").length, 1);
  assert.equal((await store.resolveAuthorized({ hub_id: installed.hub_id, uid: creator, organisation_id: 41, asked_permission: ACL.permission.read, capabilities: ["installed-module"] })).authorized, true);
  await assert.rejects(() => store.resolveAuthorized({ hub_id: installed.hub_id, uid: creator, organisation_id: 41, asked_permission: ACL.permission.read, capabilities: ["later-module"] }), (error) => error.code === "HUB_CAPABILITY_NOT_READY");
  const upgrade_page = await lifecycle.upgradeExistingHubs({ inherit: "installed", limit: 1 });
  assert.equal(upgrade_page.next, installed.hub_id);
  assert.deepEqual((await lifecycle.upgradeExistingHubs({ inherit: "installed", after: upgrade_page.next, limit: 1 })).results, []);
  const resumed = mariadb(yp, `SELECT status,attempt FROM hub_capability WHERE hub_id='${installed.hub_id}' AND module_id='later-module'`)[0];
  assert.equal(resumed.status, "ready");
  assert.equal(Number(resumed.attempt), 2);
  assert.equal(mariadb(own_internal.database_name, "SHOW TABLES LIKE 'phase48b_later_marker'").length, 0);
  assert.equal(Number(mariadb(installed_internal.database_name, "SELECT COUNT(*) AS count FROM phase48b_sentinel WHERE id=1")[0].count), 1);

  registry.get("later-module").active = false;
  assert.equal(mariadb(installed_internal.database_name, "SHOW TABLES LIKE 'phase48b_later_marker'").length, 1);

  registry.register({
    module_id: "concurrent-creator",
    manifest: normalizeManifest("concurrent-creator", { schemaVersion: "1", inherit: "own", requires: [] }, { package_metadata: { version: "1.0.0" } }),
    handler: async () => {},
    artifact_ref: "fixture:concurrent-creator:1"
  });
  const interrupted_specification = { idempotency_key: "phase48b-allocation-resume", name: "Allocation resume" };
  const interrupted_fingerprint = checksum({ creator_module: "concurrent-creator", organisation_id: 41, uid: creator, name: interrupted_specification.name });
  const allocating = await store.reserveRequest({ organisation_id: 41, creator_uid: creator, creator_module: "concurrent-creator", idempotency_key: interrupted_specification.idempotency_key, fingerprint: interrupted_fingerprint, public_name: interrupted_specification.name, inherit: "own" });
  assert.equal(allocating.state, "allocating");
  assert.equal(mariadb(yp, `SELECT schema_name FROM information_schema.schemata WHERE schema_name='${allocating.database_name}'`).length, 0);
  const allocation_resumed = await lifecycle.createPrivateHub({ session: trustedSession(), creator_module: "concurrent-creator", specification: interrupted_specification });
  assert.equal(allocation_resumed.hub_id, allocating.hub_id);
  assert.equal((await store.getHub(allocating.hub_id)).state, "ready");
  const concurrent_request = { session: trustedSession(), creator_module: "concurrent-creator", specification: { idempotency_key: "phase48b-concurrent", name: "Concurrent" } };
  const concurrent = await Promise.all([
    lifecycle.createPrivateHub(concurrent_request),
    lifecycle.createPrivateHub(concurrent_request)
  ]);
  assert.equal(concurrent[0].hub_id, concurrent[1].hub_id);
  assert.equal(Number(mariadb(yp, `SELECT COUNT(*) AS count FROM hub_lifecycle WHERE hub_id='${concurrent[0].hub_id}'`)[0].count), 1);
  assert.equal(Number(mariadb(yp, `SELECT COUNT(*) AS count FROM entity WHERE id='${concurrent[0].hub_id}'`)[0].count), 1);

  const copy = fs.mkdtempSync(path.join(os.tmpdir(), "phase48b-control-plane-copy-"));
  t.after(() => fs.rmSync(copy, { recursive: true, force: true }));
  fs.cpSync(lifecycle_root, copy, { recursive: true });
  const copied = require(path.join(copy, "lib"));
  const second_store = new copied.SqlHubStore({ database, acl: copied.createAclContract(Constants) });
  assert.equal((await second_store.getHub(installed.hub_id)).database_name, installed_internal.database_name);
  assert.equal(mariadb(installed_internal.database_name, "SELECT marker_value FROM phase48b_installed_marker WHERE marker_key='authorized'")[0].marker_value, "ok");

  const durable_snapshot = {
    hubs: mariadb(yp, `SELECT h.id,h.owner_id,h.domain_id,l.creator_module,l.inherit_policy,l.database_name,l.state FROM hub h INNER JOIN hub_lifecycle l ON l.hub_id=h.id WHERE h.id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY h.id`),
    acl: mariadb(yp, `SELECT hub_id,uid,privilege,granted_by FROM hub_acl WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY hub_id,uid`),
    plans: mariadb(yp, `SELECT id,hub_id,kind,plan_fingerprint,status,plan_cursor,error_code FROM hub_plan WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY id`),
    capabilities: mariadb(yp, `SELECT hub_id,module_id,plan_id,target_version,applied_version,artifact_ref,status,attempt,error_code FROM hub_capability WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY hub_id,module_id`)
  };
  restartMariaDb();
  await second_store.install();
  assert.deepEqual(mariadb(yp, `SELECT h.id,h.owner_id,h.domain_id,l.creator_module,l.inherit_policy,l.database_name,l.state FROM hub h INNER JOIN hub_lifecycle l ON l.hub_id=h.id WHERE h.id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY h.id`), durable_snapshot.hubs);
  assert.deepEqual(mariadb(yp, `SELECT hub_id,uid,privilege,granted_by FROM hub_acl WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY hub_id,uid`), durable_snapshot.acl);
  assert.deepEqual(mariadb(yp, `SELECT id,hub_id,kind,plan_fingerprint,status,plan_cursor,error_code FROM hub_plan WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY id`), durable_snapshot.plans);
  assert.deepEqual(mariadb(yp, `SELECT hub_id,module_id,plan_id,target_version,applied_version,artifact_ref,status,attempt,error_code FROM hub_capability WHERE hub_id IN ('${installed.hub_id}','${own.hub_id}') ORDER BY hub_id,module_id`), durable_snapshot.capabilities);
  assert.equal((await second_store.getHub(installed.hub_id)).database_name, installed_internal.database_name);
  assert.equal(mariadb(installed_internal.database_name, "SELECT marker_value FROM phase48b_installed_marker WHERE marker_key='authorized'")[0].marker_value, "ok");
  assert.equal((await new systemMfs.MfsNamespace({ store: mfs_store, context: { hub_id: installed.hub_id }, principal: creator }).resolveNode(folder.nid)).filename, "Phase48B");

  const exposed = JSON.stringify({ installed, own, procedure });
  assert.doesNotMatch(exposed, /hub_[a-f0-9]{16}|phase4-disposable-root|db_host|database_name/i);
});
