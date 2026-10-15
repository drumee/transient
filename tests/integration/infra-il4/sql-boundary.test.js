"use strict";
// Qualification probe, NOT an installer or a human identity provisioning API.
// Uses the approved IL-3 fixture's declared, pinned dependencies and real owners.
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto");
const { execFileSync } = require("node:child_process");
const fixture = path.resolve(__dirname, "../../../target/distributions/minimal-kernel-il3");
const load = name => require(require.resolve(name, { paths: [fixture] }));
const { manifestEntries, statements, identifier } = require(path.join(fixture, "lib/database"));
const { platform, runtime, components, system_mfs } = require(path.join(fixture, "lib/components"));
const mariadb = load("mariadb");
const image = require(path.join(fixture, "lib/distribution")).images.database;
const docker = args => execFileSync("docker", args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], timeout: 120000 });
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
test("IL-4 real SQL privilege boundary and missing first-operator contract", { timeout: 180000 }, async t => {
  const owner = "drumee-il4-sql-" + crypto.randomBytes(6).toString("hex");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), owner + "-")); fs.chmodSync(directory, 0o700);
  const admin_password = crypto.randomBytes(32).toString("base64url");
  fs.writeFileSync(path.join(directory, "admin"), admin_password, { mode: 0o600 });
  let created = false; const connections = [];
  async function connect(user, password, database) {
    const connection = await mariadb.createConnection({ host: "127.0.0.1", port, user, password, database, bigIntAsNumber: true });
    connections.push(connection);
    return {
      async query(sql, ...parameters) { return connection.query(sql, parameters); },
      async await_query(sql, ...parameters) { return this.query(sql, ...parameters); },
      async await_proc(name, ...parameters) { return this.query(`CALL ${identifier(name)}(${parameters.map(() => "?").join(",")})`, ...parameters); },
      async await_func(name, ...parameters) { return (await this.query(`SELECT ${identifier(name)}(${parameters.map(() => "?").join(",")}) AS value`, ...parameters))[0]; },
      async executeScript(script, { database = "yp" } = {}) { await this.query("USE " + identifier(database)); try { for (const sql of statements(script)) await this.query(sql); } finally { await this.query("USE yp"); } }
    };
  }
  let port;
  try {
    assert.equal(docker(["ps", "-aq", "--filter", "name=^/" + owner + "$"]).trim(), "");
    docker(["run", "-d", "--name", owner, "--label", "org.drumee.infra.owner=" + owner, "--mount", "type=tmpfs,destination=/var/lib/mysql", "--mount", `type=bind,source=${directory}/admin,target=/run/test-admin,readonly`, "--publish", "127.0.0.1::3306", "--env", "MARIADB_ROOT_PASSWORD_FILE=/run/test-admin", "--env", "MARIADB_ROOT_HOST=%", image]); created = true;
    const inspected = JSON.parse(docker(["inspect", owner]))[0];
    const binding = inspected.NetworkSettings.Ports["3306/tcp"][0]; assert.equal(binding.HostIp, "127.0.0.1"); port = Number(binding.HostPort);
    let admin;
    for (let attempt = 0; attempt < 120; attempt++) { try { admin = await connect("root", admin_password); break; } catch (_) { await pause(500); } }
    assert.ok(admin, "OWNED_DATABASE_START_TIMEOUT");
    await admin.query("CREATE DATABASE yp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    await admin.query("CREATE DATABASE unrelated");
    await admin.query("CREATE TABLE unrelated.protected (id INT)");
    const provision_password = crypto.randomBytes(32).toString("base64url"), runtime_password = crypto.randomBytes(32).toString("base64url");
    for (const [user, password] of [["kernel_provisioner", provision_password], ["kernel_runtime", runtime_password]]) await admin.query("CREATE USER ?@'%' IDENTIFIED BY ?", user, password);
    // Explicitly disposable scoped installer; no global grants, no GRANT OPTION.
    await admin.query("GRANT ALL PRIVILEGES ON yp.* TO 'kernel_provisioner'@'%'");
    await admin.query("GRANT ALL PRIVILEGES ON `hub\\_%`.* TO 'kernel_provisioner'@'%'");
    const provision = await connect("kernel_provisioner", provision_password, "yp");
    const package_root = path.dirname(require.resolve("@drumee/server-runtime/package.json", { paths: [fixture] }));
    for (const entry of manifestEntries(package_root)) await provision.executeScript(fs.readFileSync(entry.file, "utf8"));
    await platform.bootstrap({ database: provision, domain: "drumee.lan" });
    const cp = components(provision); await cp.hub_store.install(); await system_mfs.install({ store: cp.mfs_store });
    await t.test("canonical bootstrap creates only three non-login platform identities, idempotently", async () => {
      assert.deepEqual((await provision.query("SELECT username,fingerprint FROM drumate ORDER BY username")).map(row => [row.username, row.fingerprint]), [["guest", ""], ["nobody", ""], ["system", ""]]);
      assert.equal((await platform.bootstrap({ database: provision, domain: "drumee.lan" })).changed, false);
      for (const row of await provision.query("SELECT id FROM drumate")) {
        const session = await cp.sessions.fromRequest({ headers: {} });
        await assert.rejects(session.signin({ uid: row.id, password: "deliberately-invalid-probe" }), { code: "AUTHENTICATION_FAILED" });
      }
      assert.equal(Object.hasOwn(platform, "createOperator"), false);
    });
    // This is precisely the acceptance-only bypass that must NOT become a normal
    // installation default. No claim of canonical first-user provisioning.
    const uid = (await provision.query("SELECT uniqueId() AS id"))[0].id;
    const password = crypto.randomBytes(32).toString("base64url");
    await provision.query("INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,'il4-probe',?,?,'drumate','personal',1,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')", uid, "identity_" + uid, "/test-only/" + uid);
    await provision.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,'il4-probe',1,?,?)", uid, crypto.createHash("sha512").update(password).digest("hex"), JSON.stringify({ email: "probe@drumee.lan", otp: 0 }));
    await provision.query("INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,3,1)", uid);
    const owner_session = await cp.sessions.fromRequest({ headers: {} }); await owner_session.signin({ uid, password });
    let hub;
    await t.test("separate scoped provisioner creates a Hub through real authenticated control plane", async () => {
      hub = await cp.lifecycle.createPrivateHub({ session: owner_session, creator_module: "system-mfs", specification: { name: "SQL qualification", idempotency_key: "il4-sql-probe" } });
      assert.equal(hub.status, "ready");
      await assert.rejects(cp.lifecycle.createPrivateHub({ session: await cp.sessions.fromRequest({ headers: {} }), creator_module: "system-mfs", specification: { name: "Denied", idempotency_key: "il4-denied" } }), { code: "HUB_AUTHENTICATION_REQUIRED" });
    });
    const shard = (await cp.hub_store.getHub(hub.hub_id)).database_name;
    for (const table of ["domain", "sys_conf", "organisation", "entity", "drumate", "privilege", "cookie", "authn", "socket", "hub", "hub_lifecycle", "hub_acl", "hub_plan", "hub_capability", "system_mfs_installation", "system_mfs_provisioning"]) await admin.query(`GRANT SELECT ON yp.${identifier(table)} TO 'kernel_runtime'@'%'`);
    for (const table of ["cookie", "authn", "socket"]) await admin.query(`GRANT INSERT, UPDATE, DELETE ON yp.${identifier(table)} TO 'kernel_runtime'@'%'`);
    await admin.query("GRANT EXECUTE ON yp.* TO 'kernel_runtime'@'%'");
    await admin.query(`GRANT SELECT, EXECUTE ON ${identifier(shard)}.* TO 'kernel_runtime'@'%'`);
    const db = await connect("kernel_runtime", runtime_password, "yp"), live = components(db);
    await t.test("restricted runtime authenticates, resumes sessions and writes transport state", async () => {
      const session = await live.sessions.fromRequest({ headers: {} }); await session.signin({ uid, password }); assert.equal(session.isAuthenticated(), true);
      assert.equal((await live.sessions.fromSessionId(session.sid)).isAuthenticated(), true);
      await live.yellow_page.resolveOtak("invalid-expired-probe");
    });
    await t.test("restricted runtime resolves actual ACL and performs MFS routines", async () => {
      const context = await live.hub_store.resolveAuthorized({ hub_id: hub.hub_id, uid, organisation_id: 1, asked_permission: live.acl.permission.write, capabilities: ["system-mfs"] });
      const report = await system_mfs.validateProvisioning({ store: live.mfs_store, context: { hub_id: hub.hub_id } }); assert.equal(report.valid, true);
      const node = await live.mfs_store.makeDirectoryAt({ principal_id: uid }, { hub_id: context.hub_id, nid: report.root_id }, "restricted-directory"); assert.ok(node.nid);
      assert.equal((await live.mfs_store.getNode(null, { hub_id: hub.hub_id, nid: node.nid })).filename, "restricted-directory");
    });
    await t.test("runtime cannot create databases, mutate unrelated schemas or infrastructure users", async () => {
      for (const sql of ["CREATE DATABASE unrelated_new", "CREATE DATABASE hub_fffffffffffffffe", "ALTER TABLE unrelated.protected ADD COLUMN forbidden INT", "SELECT * FROM unrelated.protected", "CREATE USER forbidden IDENTIFIED BY 'invalid-test-only'", "UPDATE mysql.global_priv SET User='forbidden' WHERE User='root'"]) await assert.rejects(db.query(sql), error => [1044, 1045, 1142, 1227].includes(error.errno));
    });
    await t.test("runtime cannot install schemas or change canonical identity/ACL rows", async () => {
      for (const sql of ["CREATE TABLE yp.forbidden (id INT)", "UPDATE yp.privilege SET privilege=63", "UPDATE yp.drumate SET fingerprint=''", "DELETE FROM yp.hub_acl"]) await assert.rejects(db.query(sql), error => [1044, 1142, 1227].includes(error.errno));
    });
  } finally {
    for (const connection of connections) await connection.end().catch(() => {});
    if (created) {
      const value = JSON.parse(docker(["inspect", owner]))[0];
      assert.equal(value.Config.Labels["org.drumee.infra.owner"], owner);
      docker(["rm", "-f", owner]);
    }
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
