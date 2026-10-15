"use strict";
// Disposable contract probe, NOT enrollment or a production provisioning job.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const mariadb = require("mariadb"), runtime = require("@drumee/server-runtime");
const platform = require("../../../bootstrap/lib");
const Constants = require("../../../../../sources/server-essentials/lib/lex/constants");
const { permissionValue } = require("../../../../../sources/server-essentials/lib/lex/permission");
const image = "mariadb@sha256:611a2fcc5fa7c6ceb8644c6f74b25ede004ff6c3a6b38c8f8c23d3bbf6c26430";
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
function docker(args, input) {
  try { return execFileSync("docker", args, { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 120000 }); }
  catch (_) { throw Object.assign(Error("KB01_DOCKER_PROBE_FAILED"), { code: "KB01_DOCKER_PROBE_FAILED" }); }
}
test("real minimal runtime authenticates humans but has no platform authority contract", { timeout: 180000 }, async t => {
  const owner = "drumee-kb01-contract-" + crypto.randomBytes(6).toString("hex");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), owner + "-")); fs.chmodSync(directory, 0o700);
  const password = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(path.join(directory, "admin"), password, { mode: 0o600 });
  let created = false, connection;
  try {
    assert.equal(docker(["ps", "-aq", "--filter", "name=^/" + owner + "$"]).trim(), "");
    docker(["run", "-d", "--name", owner, "--label", "org.drumee.infra.owner=" + owner, "--mount", "type=tmpfs,destination=/var/lib/mysql", "--mount", `type=bind,source=${directory}/admin,target=/run/probe-admin,readonly`, "--publish", "127.0.0.1::3306", "--env", "MARIADB_ROOT_PASSWORD_FILE=/run/probe-admin", "--env", "MARIADB_ROOT_HOST=%", image]); created = true;
    const inspected = JSON.parse(docker(["inspect", owner]))[0], binding = inspected.NetworkSettings.Ports["3306/tcp"][0]; assert.equal(binding.HostIp, "127.0.0.1");
    for (let attempt = 0; attempt < 120; attempt++) { try { connection = await mariadb.createConnection({ host: "127.0.0.1", port: Number(binding.HostPort), user: "root", password, bigIntAsNumber: true }); break; } catch (_) { await pause(500); } }
    assert.ok(connection, "KB01_DATABASE_START_TIMEOUT");
    // Dedicated connection; parameters, driver SQL text and secrets are never logged.
    const database = {
      async query(sql, ...parameters) { try { return await connection.query(sql, parameters.map(value => value && typeof value === "object" ? JSON.stringify(value) : value)); } catch (error) { throw Object.assign(Error("KB01_SQL_PROBE_FAILED"), { code: "KB01_SQL_PROBE_FAILED", errno: error.errno }); } },
      async await_query(sql, ...parameters) { return this.query(sql, ...parameters); },
      async await_proc(name, ...parameters) { assert.match(name, /^[a-z_]+$/); return this.query(`CALL \`${name}\`(${parameters.map(() => "?").join(",")})`, ...parameters); },
      async await_func(name, ...parameters) { assert.match(name, /^[a-z_]+$/); return (await this.query(`SELECT \`${name}\`(${parameters.map(() => "?").join(",")}) AS value`, ...parameters))[0]; }
    };
    await database.query("CREATE DATABASE yp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    const package_root = path.dirname(require.resolve("@drumee/server-runtime/package.json"));
    const manifest = JSON.parse(fs.readFileSync(path.join(package_root, "schemas/SCHEMA_MANIFEST.json")));
    assert.equal(manifest.schemaVersion, "phase4.5-runtime-schema-1");
    for (const entry of [...manifest.install].sort((a, b) => a.order - b.order)) {
      const file = fs.realpathSync(path.resolve(package_root, entry.path)); assert.ok(file.startsWith(fs.realpathSync(package_root) + path.sep));
      // Native client interprets the actual owner manifest's DELIMITER directives.
      docker(["exec", "-i", owner, "/bin/sh", "-c", 'MYSQL_PWD="$(cat /run/probe-admin)" exec mariadb --protocol=socket -uroot --database=yp --batch'], fs.readFileSync(file));
    }
    await database.query("USE yp");
    assert.equal((await platform.bootstrap({ database, domain: "drumee.lan" })).valid, true);
    const reserved = await database.query("SELECT e.id,e.ident,e.area,e.status,d.fingerprint,p.privilege FROM entity e JOIN drumate d ON d.id=e.id JOIN privilege p ON p.uid=e.id ORDER BY e.id");
    await t.test("intrinsic schema lacks the canonical platform remit column and lookup", async () => {
      assert.equal((await database.query("SELECT column_name FROM information_schema.columns WHERE table_schema='yp' AND table_name='drumate' AND column_name='remit'")).length, 0);
      assert.equal((await database.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema='yp' AND routine_name='get_remit'")).length, 0);
      await assert.rejects(database.query("SELECT remit FROM drumate"), error => error.errno === 1054);
      await assert.rejects(database.query("SELECT get_remit('ffffffffffffffff')"), error => error.errno === 1305);
    });
    const store = new runtime.YellowPageStore({ database }), sessions = new runtime.SessionManager({ store });
    const humans = [];
    // Test-only SQL counterexamples; never installed as KB-01 or production users.
    for (const privilege of [63, 127]) {
      const uid = (await database.query("SELECT uniqueId() AS id"))[0].id;
      const credential = crypto.randomBytes(32), username = "kb01-domain-" + privilege;
      await database.query("START TRANSACTION");
      try {
        await database.query("INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,?,?,?,'drumate','personal',1,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')", uid, username, "identity_" + uid, "/probe/" + uid);
        await database.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,?,1,SHA2(?,512),?)", uid, username, credential.toString("base64url"), { email: username + "@drumee.lan", otp: 0 });
        await database.query("INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,?,1)", uid, privilege);
        await database.query("COMMIT");
      } catch (error) { await database.query("ROLLBACK"); throw error; }
      const session = await sessions.fromRequest({ headers: {} });
      await session.signin({ uid, password: credential.toString("base64url") });
      credential.fill(0); humans.push({ uid, privilege, session });
    }
    await t.test("both numeric counterexamples authenticate as humans and issue normal resumable sessions", async () => {
      for (const { session } of humans) { assert.equal(session.isAuthenticated(), true); assert.equal(session.identity().kind, "drumate"); assert.equal((await sessions.fromSessionId(session.sid)).isAuthenticated(), true); assert.ok(session.responseHeaders()[runtime.SESSION_COOKIE]); }
    });
    await t.test("wrong credentials and reserved identities remain rejected", async () => {
      for (const uid of [...humans.map(value => value.uid), ...reserved.map(value => value.id)]) {
        const session = await sessions.fromRequest({ headers: {} }); await assert.rejects(session.signin({ uid, password: "nonsecret-invalid-probe" }), { code: "AUTHENTICATION_FAILED" });
      }
    });
    const domain = new runtime.DomainAuthorizer({ store });
    await t.test("63 and 127 in privilege remain domain-scoped and cannot imply global authority", async () => {
      await database.query("INSERT INTO domain (id,name) VALUES (2,'other.example')");
      for (const { uid, session } of humans) {
        assert.equal((await domain.authorize({ session, permission: { scope: "domain", src: Constants.permission.admin } })).granted, true);
        assert.equal(await store.domainPermission(uid, 2, Constants.permission.admin), 0);
        // Existing domain evaluation checks nonzero intersection, not equality
        // to a root cumulative word: using 127 as a requested mask is unsafe.
        assert.equal((await domain.authorize({ session, permission: { scope: "domain", src: 127 } })).granted, true);
      }
    });
    await t.test("real dispatcher denies platform operations for both authenticated counterexamples", async () => {
      let loaded = 0;
      const registry = new runtime.DescriptorRegistry({ permissionValue });
      registry.registerDescriptor("probe", { modules: { private: "must-not-load" }, services: { historic: { scope: "plateform", permission: { src: "read" } }, canonical: { scope: "platform", permission: { src: "admin" } } } }, { workdir: __dirname });
      const dispatcher = new runtime.ServiceDispatcher({ registry, authorize: runtime.createAuthorizer({ domainAuthorizer: domain }), requireWorker() { loaded++; throw Error("MUST_NOT_LOAD"); } });
      for (const { session } of humans) for (const service of ["probe.historic", "probe.canonical"]) await assert.rejects(dispatcher.dispatch({ service, session }), error => error.code === "PERMISSION_DENIED" && error.details?.reason === "UNSUPPORTED_PERMISSION_SCOPE");
      assert.equal(loaded, 0);
    });
    await t.test("reserved identity credentials and privilege rows are unchanged", async () => {
      const after = await database.query("SELECT e.id,e.ident,e.area,e.status,d.fingerprint,p.privilege FROM entity e JOIN drumate d ON d.id=e.id JOIN privilege p ON p.uid=e.id WHERE d.username IN ('nobody','guest','system') ORDER BY e.id"); assert.deepEqual(after, reserved);
      assert.equal((await platform.validate({ database, domain: "drumee.lan" })).valid, true);
    });
  } finally {
    if (connection) await connection.end().catch(() => {});
    if (created) { assert.equal(JSON.parse(docker(["inspect", owner]))[0].Config.Labels["org.drumee.infra.owner"], owner); docker(["rm", "-f", owner]); }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
