"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { connect, privateFile, manifestEntries, fail } = require("./database");
const { runtime, system_mfs, platform, components } = require("./components");
const state_file = "/acceptance/principals.json";
async function initialize(mode) {
  if (!["install", "validate"].includes(mode)) fail("INVALID_INITIALIZATION_OPERATION");
  const db = await connect();
  try {
    const runtime_root = path.dirname(require.resolve("@drumee/server-runtime/package.json"));
    if (mode === "install") {
      // Never replay DROP/CREATE routine scripts on a running ordinary startup.
      const existing = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='yp' AND table_name='cookie'");
      if (!existing.length) for (const entry of manifestEntries(runtime_root)) await db.executeScript(fs.readFileSync(entry.file, "utf8"));
      await platform.bootstrap({ database: db, domain: "drumee.lan" });
    }
    if (!(await platform.validate({ database: db, domain: "drumee.lan" })).valid) fail("PLATFORM_NOT_READY");
    const { acl, hub_store, mfs_store, lifecycle, sessions } = components(db);
    if (mode === "install") { await hub_store.install(); await system_mfs.install({ store: mfs_store }); }
    if (!(await system_mfs.validateInstallation({ store: mfs_store })).valid) fail("MFS_INSTALLATION_NOT_READY");
    let state;
    if (fs.existsSync(state_file)) state = JSON.parse(privateFile(state_file));
    else {
      if (mode !== "install") fail("ACCEPTANCE_STATE_MISSING");
      const unowned = await db.query("SELECT id FROM drumate WHERE username IN ('il3-owner','il3-reader','il3-outsider')");
      if (unowned.length) fail("ACCEPTANCE_IDENTITY_OWNERSHIP_CONFLICT");
      state = { contract_version: 1, domain: "drumee.lan", principals: {} };
      for (const name of ["owner", "reader", "outsider"]) {
        state.principals[name] = { id: (await db.query("SELECT uniqueId() AS id"))[0].id, email: `il3-${name}@drumee.lan`, password: crypto.randomBytes(32).toString("base64url") };
      }
      // Write pending intent first. Interrupted SQL resumes with identical IDs.
      const fd = fs.openSync(state_file, "wx", 0o600);
      try { fs.writeFileSync(fd, JSON.stringify(state)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    }
    if (state.contract_version !== 1 || state.domain !== "drumee.lan" || Object.keys(state.principals).sort().join() !== "outsider,owner,reader") fail("ACCEPTANCE_STATE_CORRUPTED");
    for (const [name, principal] of Object.entries(state.principals)) {
      if (!/^[a-f0-9]{16}$/.test(principal.id) || !/^[A-Za-z0-9_-]{43}$/.test(principal.password)) fail("ACCEPTANCE_STATE_CORRUPTED");
      const current = await db.query("SELECT e.id,d.fingerprint,d.email,e.dom_id FROM entity e JOIN drumate d ON e.id=d.id WHERE e.id=?", principal.id);
      const fingerprint = crypto.createHash("sha512").update(principal.password).digest("hex");
      if (!current.length && mode === "install") {
        await db.query("START TRANSACTION");
        try {
          await db.query("INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,?,?,?,'drumate','personal',1,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')", principal.id, "il3-" + name, "identity_" + principal.id, "/acceptance-identities/" + principal.id);
          await db.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,?,1,?,?)", principal.id, "il3-" + name, fingerprint, JSON.stringify({ email: principal.email, otp: 0 }));
          await db.query("INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,3,1)", principal.id);
          await db.query("COMMIT");
        } catch (error) { await db.query("ROLLBACK"); throw error; }
      } else if (!current.length || current[0].fingerprint !== fingerprint || current[0].email !== principal.email || Number(current[0].dom_id) !== 1) fail("ACCEPTANCE_IDENTITY_CONFLICT");
    }
    if (mode === "install") {
      const owner_session = await sessions.fromRequest({ headers: {} });
      await owner_session.signin({ uid: state.principals.owner.id, password: state.principals.owner.password });
      for (const name of ["a", "b"]) await lifecycle.createPrivateHub({ session: owner_session, creator_module: "system-mfs", specification: { idempotency_key: "il3-" + name, name: "IL3 " + name.toUpperCase() } });
    }
    const hubs = await db.query("SELECT hub_id FROM hub_lifecycle WHERE creator_uid=? ORDER BY hub_id", state.principals.owner.id);
    if (hubs.length !== 2) fail("ACCEPTANCE_HUB_STATE_INVALID");
    for (const { hub_id } of hubs) {
      if (!(await system_mfs.validateProvisioning({ store: mfs_store, context: { hub_id } })).valid) fail("MFS_SHARD_NOT_READY");
      // The approved fixture policy grants the reader Hub A, never Hub B.
      if (mode === "install" && hub_id === hubs[0].hub_id) {
        const actor_context = await hub_store.resolveAuthorized({ hub_id, uid: state.principals.owner.id, organisation_id: 1, asked_permission: acl.permission.admin });
        await lifecycle.grant({ actor_context, target_uid: state.principals.reader.id, privilege: "read" });
        const hub = await hub_store.getHub(hub_id);
        await db.queryIn(hub.database_name, "INSERT INTO permission (resource_id,entity_id,message,expiry_time,ctime,utime,permission,assign_via) VALUES ('*',?,'IL3 acceptance reader',0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),3,'root') ON DUPLICATE KEY UPDATE permission=VALUES(permission)", state.principals.reader.id);
      }
    }
    const tables = (await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema='yp'")).map(row => row.table_name);
    for (const name of ["domain", "cookie", "authn", "socket", "organisation", "hub_lifecycle", "hub_acl", "system_mfs_installation"]) if (!tables.includes(name)) fail("KERNEL_SCHEMA_OBJECT_MISSING");
    console.log("KERNEL_INITIALIZATION_VALID");
  } finally { await db.close(); }
}
if (require.main === module) initialize(process.argv[2]).catch(error => { console.error("KERNEL_INITIALIZATION_FAILED " + (/^[A-Z0-9_]+$/.test(error.code || "") ? error.code : "UNKNOWN")); process.exitCode = 1; });
module.exports = { initialize };
