"use strict";
// KB-01A integration only: disposable SQL test principals, never enrollment.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const mariadb = require("mariadb"), runtime = require("@drumee/server-runtime"), system_mfs = require("@drumee/system-mfs");
const operator = require("../../lib");
const platform = require("../../../bootstrap/lib"), hub_api = require("../../../hub-lifecycle/lib");
const { MfsPermissionBackend, MfsService } = require("../../../../modules/mfs-service/lib");
const Constants = require("../../../../../sources/server-essentials/lib/lex/constants");
const { permissionValue } = require("../../../../../sources/server-essentials/lib/lex/permission");
const image = "mariadb@sha256:611a2fcc5fa7c6ceb8644c6f74b25ede004ff6c3a6b38c8f8c23d3bbf6c26430";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function docker(args, input) {
  try { return execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 }); }
  catch (_) { throw Object.assign(Error("KB01A_DOCKER_PROBE_FAILED"), { code: "KB01A_DOCKER_PROBE_FAILED" }); }
}
test("corrected canonical runtime with real bootstrap, sessions, Hub lifecycle and cross-Hub MFS ACL", { timeout: 180000 }, async t => {
  const owner = "drumee-kb01a-integration-" + crypto.randomBytes(6).toString("hex");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), owner + "-")); fs.chmodSync(directory, 0o700);
  const password = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(path.join(directory, "admin"), password, { mode: 0o600 });
  let created = false, port; const connections = [];
  const sql_id = value => { assert.match(value, /^[a-z0-9_]+$/i); return "`" + value + "`"; };
  async function connect(selected) {
    const connection = await mariadb.createConnection({ host: "127.0.0.1", port, user: "root", password, ...(selected ? { database: selected } : {}), bigIntAsNumber: true }); connections.push(connection);
    return {
      connection,
      async query(sql, ...parameters) { try { return await connection.query(sql, parameters.map(value => value && typeof value === "object" ? JSON.stringify(value) : value)); } catch (error) { throw Object.assign(Error("KB01A_SQL_PROBE_FAILED"), { code: "KB01A_SQL_PROBE_FAILED", errno: error.errno }); } },
      async await_query(sql, ...parameters) { return this.query(sql, ...parameters); },
      async await_proc(name, ...parameters) { return this.query(`CALL ${sql_id(name)}(${parameters.map(() => "?").join(",")})`, ...parameters); },
      async await_func(name, ...parameters) { return (await this.query(`SELECT ${sql_id(name)}(${parameters.map(() => "?").join(",")}) AS value`, ...parameters))[0]; },
      async executeScript(sql, { database = selected } = {}) {
        sql_id(database);
        docker(["exec", "-i", owner, "/bin/sh", "-c", 'MYSQL_PWD="$(cat /run/probe-admin)" exec mariadb --protocol=socket -uroot --batch --database=' + database], sql);
      },
      async queryIn(database, sql, ...parameters) {
        sql_id(database); const shard = await connect(database);
        try { return await shard.query(sql, ...parameters); } finally { await shard.close(); }
      },
      async close() { const index = connections.indexOf(connection); if (index !== -1) connections.splice(index, 1); await connection.end(); }
    };
  }
  try {
    assert.equal(docker(["ps", "-aq", "--filter", "name=^/" + owner + "$"]).trim(), "");
    docker(["run", "-d", "--name", owner, "--label", "org.drumee.infra.owner=" + owner, "--mount", "type=tmpfs,destination=/var/lib/mysql", "--mount", `type=bind,source=${directory}/admin,target=/run/probe-admin,readonly`, "--publish", "127.0.0.1::3306", "--env", "MARIADB_ROOT_PASSWORD_FILE=/run/probe-admin", "--env", "MARIADB_ROOT_HOST=%", image]); created = true;
    const binding = JSON.parse(docker(["inspect", owner]))[0].NetworkSettings.Ports["3306/tcp"][0]; assert.equal(binding.HostIp, "127.0.0.1"); port = Number(binding.HostPort);
    let admin; for (let attempt = 0; attempt < 120; attempt++) { try { admin = await connect(); break; } catch (_) { await pause(500); } }
    assert.ok(admin, "KB01A_DATABASE_START_TIMEOUT");
    await admin.query("CREATE DATABASE yp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    const database = await connect("yp"), package_root = path.dirname(require.resolve("@drumee/server-runtime/package.json"));
    const manifest = JSON.parse(fs.readFileSync(path.join(package_root, "schemas/SCHEMA_MANIFEST.json")));
    for (const entry of [...manifest.install].sort((a, b) => a.order - b.order)) {
      const file = fs.realpathSync(path.resolve(package_root, entry.path)); assert.ok(file.startsWith(fs.realpathSync(package_root) + path.sep)); await database.executeScript(fs.readFileSync(file, "utf8"));
    }
    await t.test("canonical bootstrap validates without human enrollment and additive migration is idempotent", async () => {
      assert.equal((await platform.bootstrap({ database, domain: "drumee.lan" })).valid, true);
      assert.equal((await runtime.installPlatformAuthority({ database })).valid, true);
      assert.equal((await runtime.validatePlatformAuthority({ database })).valid, true);
    });
    const reserved_snapshot = () => database.query("SELECT e.id,e.ident,e.area,e.status,d.fingerprint,d.remit,p.privilege FROM entity e JOIN drumate d ON d.id=e.id JOIN privilege p ON p.uid=e.id WHERE d.username IN ('nobody','guest','system') ORDER BY e.id");
    const reserved = await reserved_snapshot();
    const store = new runtime.YellowPageStore({ database }), sessions = new runtime.SessionManager({ store }), humans = [];
    // Test-only SQL setup, expressly not a KB-01B enrollment implementation.
    for (const [name, privilege] of [["platform-human", 1], ["domain-human", 63]]) {
      if (name === "platform-human") {
        const operation_id = "kb01b-hub-owner-1", file = path.join(directory, "operator-credential");
        const enrollment = { contract_version: 1, database, domain: "drumee.lan", organisation_id: 1, operation_id, identity: { username: name, email: name + "@drumee.lan" }, authorization: { authorized: true, scope: "initial-operator", operation_id, domain: "drumee.lan", organisation_id: 1 } };
        await operator.installOperatorSchema(enrollment);
        const enrolled = await operator.enrollInitialOperator({ ...enrollment, credential_provider: operator.createFileCredentialProvider({ mode: "test", file }) });
        const credential = operator.retrieveInitialCredential({ file, authorization: { authorized: true, scope: "retrieve-initial-credential", operation_id } });
        const session = await sessions.fromRequest({ headers: {} });
        try { await session.signin({ uid: enrolled.uid, password: credential.password.toString() }); } finally { credential.password.fill(0); }
        humans.push({ uid: enrolled.uid, session }); continue;
      }
      const uid = (await database.query("SELECT uniqueId() AS id"))[0].id, credential = crypto.randomBytes(32).toString("base64url");
      await database.query("START TRANSACTION");
      try {
        await database.query("INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,?,?,?,'drumate','personal',1,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')", uid, name, "identity_" + uid, "/probe/" + uid);
        await database.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,?,1,SHA2(?,512),?)", uid, name, credential, { email: name + "@drumee.lan", otp: 0 });
        await database.query("INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,?,1)", uid, privilege); await database.query("COMMIT");
      } catch (error) { await database.query("ROLLBACK"); throw error; }
      const session = await sessions.fromRequest({ headers: {} }); await session.signin({ uid, password: credential }); humans.push({ uid, session });
    }
    const [human, other] = humans, platform_authorizer = new runtime.PlatformAuthorizer({ store });
    await database.query("UPDATE drumate SET remit=? WHERE id=?", runtime.PLATFORM_ADMINISTRATOR.remit, human.uid);
    const request = session => ({ session, permission: { scope: "platform", src: "PLATFORM_ADMINISTRATOR" } });
    await t.test("SQL-authenticated platform administrator and domain administrator retain independent privileges", async () => {
      for (const { session } of humans) assert.equal((await sessions.fromSessionId(session.sid)).isAuthenticated(), true);
      assert.equal((await platform_authorizer.authorize(request(human.session))).granted, true);
      assert.equal((await platform_authorizer.authorize(request(other.session))).granted, false);
      const domain = new runtime.DomainAuthorizer({ store });
      assert.equal((await domain.authorize({ session: human.session, permission: { scope: "domain", src: Constants.permission.admin } })).granted, false);
      assert.equal((await domain.authorize({ session: other.session, permission: { scope: "domain", src: Constants.permission.admin } })).granted, true);
    });
    const acl = hub_api.createAclContract(Constants), hub_store = new hub_api.SqlHubStore({ database, acl }), mfs_store = new system_mfs.SqlMfsStore({ database });
    await hub_store.install(); await system_mfs.install({ store: mfs_store });
    const modules = new hub_api.ModuleRegistry();
    modules.register({ module_id: "system-mfs", module_root: path.dirname(require.resolve("@drumee/system-mfs/package.json")), artifact_ref: "git:53101c4a995ffca9118f795ab5d4c7c731200a2f", handler: ({ hub }) => system_mfs.provision({ store: mfs_store, context: { hub_id: hub.hub_id } }) });
    const lifecycle = new hub_api.HubLifecycle({ store: hub_store, registry: modules, can_create: async ({ session }) => (await platform_authorizer.authorize(request(session))).granted });
    const specification = name => ({ creator_module: "system-mfs", specification: { idempotency_key: "kb01a-" + name, name: "KB01A " + name } });
    let first, second;
    await t.test("platform-authorized real Hub and module provisioning succeeds; domain-only creation is denied", async () => {
      first = await lifecycle.createPrivateHub({ session: human.session, ...specification("owned") }); assert.equal(first.status, "ready");
      assert.deepEqual(await lifecycle.createPrivateHub({ session: human.session, ...specification("owned") }), first);
      await assert.rejects(lifecycle.createPrivateHub({ session: other.session, ...specification("denied") }), { code: "HUB_CREATE_PERMISSION_DENIED" });
    });
    await t.test("independent second Hub is created under temporary explicit test grant then revoked", async () => {
      await database.query("UPDATE drumate SET remit=15 WHERE id=?", other.uid);
      second = await lifecycle.createPrivateHub({ session: other.session, ...specification("other") }); assert.equal(second.status, "ready");
      await database.query("UPDATE drumate SET remit=0 WHERE id=?", other.uid);
      assert.equal((await platform_authorizer.authorize(request(other.session))).granted, false);
    });
    const registry = new runtime.DescriptorRegistry({ permissionValue }); registry.registerDirectory(path.resolve(__dirname, "../../../../modules/mfs-service/server/acl"));
    const dispatcher = new runtime.ServiceDispatcher({ registry, authorize: runtime.createAuthorizer({ platformAuthorizer: platform_authorizer, hubAuthorizer: new runtime.HubAuthorizer({ resolver: hub_store, permissionValue }), mfsPermissionBackend: new MfsPermissionBackend({ permission_store: mfs_store }) }), capability_resolver: new runtime.CapabilityResolver({ providers: { "system-mfs": async () => true } }), workerOptions: { mfs_service: new MfsService({ filesystem_factory(principal) { return new system_mfs.MfsFilesystem({ store: mfs_store, principal: principal.uid }); } }) } });
    const ready_first = await system_mfs.validateProvisioning({ store: mfs_store, context: { hub_id: first.hub_id } }), ready_second = await system_mfs.validateProvisioning({ store: mfs_store, context: { hub_id: second.hub_id } });
    const root_a = { hub_id: first.hub_id, nid: ready_first.root_id }, root_b = { hub_id: second.hub_id, nid: ready_second.root_id };
    await t.test("real SQL-backed MFS operations succeed in the administrator's own Hub", async () => {
      assert.equal(ready_first.valid, true); assert.equal(ready_second.valid, true);
      await dispatcher.dispatch({ service: "mfs.mkdir", session: human.session, input: { destination: root_a, name: "Canonical-ACL" } });
      assert.ok((await dispatcher.dispatch({ service: "mfs.list", session: human.session, input: { location: root_a } })).items.some(item => item.filename === "Canonical-ACL"));
    });
    await t.test("platform authority does not bypass cross-Hub or per-resource MFS permissions", async () => {
      await assert.rejects(dispatcher.dispatch({ service: "mfs.list", session: human.session, input: { location: root_b } }), { code: "PERMISSION_DENIED" });
      await assert.rejects(dispatcher.dispatch({ service: "mfs.copy", session: human.session, input: { sources: [root_a], destination: root_b } }), { code: "PERMISSION_DENIED" });
      const actor_context = await hub_store.resolveAuthorized({ hub_id: second.hub_id, uid: other.uid, organisation_id: 1, asked_permission: acl.permission.admin });
      await lifecycle.grant({ actor_context, target_uid: human.uid, privilege: "admin" });
      assert.equal((await hub_store.resolveAuthorized({ hub_id: second.hub_id, uid: human.uid, organisation_id: 1, asked_permission: acl.permission.read })).authorized, true);
      // Hub admin membership alone still supplies no MFS node grant.
      await assert.rejects(dispatcher.dispatch({ service: "mfs.list", session: human.session, input: { location: root_b } }), { code: "PERMISSION_DENIED" });
    });
    await t.test("revocation immediately prevents another Hub without resetting the authenticated session", async () => {
      await database.query("UPDATE drumate SET remit=0 WHERE id=?", human.uid);
      assert.equal(human.session.isAuthenticated(), true);
      await assert.rejects(lifecycle.createPrivateHub({ session: human.session, ...specification("revoked") }), { code: "HUB_CREATE_PERMISSION_DENIED" });
      assert.ok((await dispatcher.dispatch({ service: "mfs.list", session: human.session, input: { location: root_a } })).items.some(item => item.filename === "Canonical-ACL"));
    });
    await t.test("reserved bootstrap identities and credentials remain unchanged", async () => {
      assert.deepEqual(await reserved_snapshot(), reserved);
      assert.equal((await platform.validate({ database, domain: "drumee.lan" })).valid, true);
    });
  } finally {
    for (const connection of connections) await connection.end().catch(() => {});
    if (created) { assert.equal(JSON.parse(docker(["inspect", owner]))[0].Config.Labels["org.drumee.infra.owner"], owner); docker(["rm", "-f", owner]); }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
