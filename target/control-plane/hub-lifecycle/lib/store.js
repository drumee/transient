"use strict";

const fs = require("fs");
const path = require("path");
const { HubLifecycleError } = require("./errors");

const SCHEMA = path.resolve(__dirname, "../schemas/001-hub-lifecycle.sql");
const ID = /^[a-f0-9]{16}$/i;
const SQL_ID = /^[a-z0-9_]+$/i;

function rows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap(rows);
  return typeof value === "object" ? [value] : [];
}

function quoteIdentifier(value) {
  if (!SQL_ID.test(value || "")) throw new HubLifecycleError("HUB_SHARD_IDENTIFIER_INVALID", "Invalid internal shard identifier");
  return `\`${value}\``;
}

class SqlHubStore {
  constructor({ database, acl } = {}) {
    const query = database && (database.await_query || database.query);
    if (typeof query !== "function") throw new HubLifecycleError("HUB_DATABASE_REQUIRED", "Hub lifecycle requires a parameterized Yellow Page adapter");
    if (!acl || typeof acl.permissionFor !== "function" || typeof acl.privilegeFor !== "function" || typeof acl.grants !== "function") {
      throw new HubLifecycleError("HUB_ACL_CONTRACT_REQUIRED", "Hub lifecycle requires the canonical server-essentials ACL contract");
    }
    this.database = database;
    this.acl = acl;
    this.query = query.bind(database);
    this.executeScript = typeof database.executeScript === "function" ? database.executeScript.bind(database) : null;
  }

  async install() {
    const sql = fs.readFileSync(SCHEMA, "utf8");
    if (this.executeScript) await this.executeScript(sql, { database: "yp" });
    else await this.query(sql);
    await this.migrateLegacyAcl();
  }

  async migrateLegacyAcl() {
    const columns = rows(await this.query(
      "SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='hub_acl'"
    ));
    const names = new Set(columns.map((row) => row.column_name || row.COLUMN_NAME));
    if (!names.has("permission")) return;
    if (!names.has("privilege")) {
      await this.query("ALTER TABLE hub_acl ADD COLUMN privilege tinyint(3) unsigned NULL AFTER uid");
    }
    await this.query(
      "UPDATE hub_acl SET privilege=CASE permission WHEN 1 THEN ? WHEN 2 THEN ? WHEN 3 THEN ? ELSE permission END WHERE privilege IS NULL",
      this.acl.privilege.read, this.acl.privilege.write, this.acl.privilege.write
    );
    await this.query("ALTER TABLE hub_acl MODIFY privilege tinyint(3) unsigned NOT NULL");
    await this.query("ALTER TABLE hub_acl MODIFY permission tinyint(3) unsigned NULL DEFAULT NULL");
  }

  async generateId() {
    const row = rows(await this.query("SELECT uniqueId() AS id"))[0];
    if (!row || !ID.test(row.id || "")) throw new HubLifecycleError("HUB_ID_ALLOCATION_FAILED", "uniqueId() did not return a Drumee identifier");
    return row.id.toLowerCase();
  }

  async reserveRequest({ organisation_id, creator_uid, creator_module, idempotency_key, fingerprint, public_name, inherit }) {
    const candidate = await this.generateId();
    await this.query(
      "INSERT IGNORE INTO hub_idempotency (organisation_id,creator_uid,creator_module,idempotency_key,request_fingerprint,hub_id,ctime) VALUES (?,?,?,?,?,?,UNIX_TIMESTAMP())",
      organisation_id, creator_uid, creator_module, idempotency_key, fingerprint, candidate
    );
    const request = rows(await this.query(
      "SELECT request_fingerprint,hub_id FROM hub_idempotency WHERE organisation_id=? AND creator_uid=? AND creator_module=? AND idempotency_key=? LIMIT 1",
      organisation_id, creator_uid, creator_module, idempotency_key
    ))[0];
    if (!request) throw new HubLifecycleError("HUB_REQUEST_RESERVATION_FAILED", "Hub request could not be reserved");
    if (request.request_fingerprint !== fingerprint) throw new HubLifecycleError("HUB_IDEMPOTENCY_CONFLICT", "Idempotency key was reused with an incompatible request");
    const hub_id = request.hub_id.toLowerCase();
    const database_name = `hub_${hub_id}`;
    await this.query(
      "INSERT IGNORE INTO hub_lifecycle (hub_id,organisation_id,creator_uid,creator_module,inherit_policy,public_name,database_name,state,ctime,mtime) VALUES (?,?,?,?,?,?,?,'allocating',UNIX_TIMESTAMP(),UNIX_TIMESTAMP())",
      hub_id, organisation_id, creator_uid, creator_module, inherit, public_name, database_name
    );
    await this.query(
      "INSERT IGNORE INTO entity (id,ident,db_name,home_dir,type,dom_id,area,status,ctime,mtime,settings) VALUES (?,?,?,?,'hub',?,'private','offline',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')",
      hub_id, public_name, database_name, `/hubs/${hub_id}`, organisation_id
    );
    await this.query(
      "INSERT IGNORE INTO hub (id,owner_id,domain_id,name,ctime,mtime) VALUES (?,?,?,?,UNIX_TIMESTAMP(),UNIX_TIMESTAMP())",
      hub_id, creator_uid, organisation_id, public_name
    );
    await this.setPrivilege(hub_id, creator_uid, this.acl.privilege.owner, creator_uid);
    return this.getHub(hub_id);
  }

  async ensureShard(hub) {
    const db = quoteIdentifier(hub.database_name);
    await this.query(`CREATE DATABASE IF NOT EXISTS ${db} CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci`);
    const runtime_user = this.database.runtime_user;
    if (runtime_user !== undefined) {
      if (!SQL_ID.test(runtime_user || "")) throw new HubLifecycleError("HUB_RUNTIME_USER_INVALID", "Invalid internal MariaDB runtime user");
      await this.query(`GRANT ALL PRIVILEGES ON ${db}.* TO '${runtime_user}'@'%'`);
    }
    await this.query("UPDATE hub_lifecycle SET state=IF(state='allocating','provisioning',state),error_code=NULL,mtime=UNIX_TIMESTAMP() WHERE hub_id=?", hub.hub_id);
    await this.query("UPDATE entity SET status='active',mtime=UNIX_TIMESTAMP() WHERE id=?", hub.hub_id);
    return this.getHub(hub.hub_id);
  }

  async getHub(hub_id) {
    return rows(await this.query(
      "SELECT l.hub_id,l.organisation_id,l.creator_uid,l.creator_module,l.inherit_policy,l.public_name,l.database_name,l.state,l.error_code,h.owner_id,e.type,e.db_host,e.fs_host,e.home_dir,e.home_id FROM hub_lifecycle l INNER JOIN entity e ON e.id=l.hub_id INNER JOIN hub h ON h.id=l.hub_id WHERE l.hub_id=? LIMIT 1",
      hub_id
    ))[0] || null;
  }

  async setPrivilege(hub_id, uid, privilege, granted_by) {
    const normalized = this.acl.privilegeFor(privilege);
    await this.query(
      "INSERT INTO hub_acl (hub_id,uid,privilege,granted_by,ctime,mtime) VALUES (?,?,?,?,UNIX_TIMESTAMP(),UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE privilege=VALUES(privilege),granted_by=VALUES(granted_by),mtime=UNIX_TIMESTAMP()",
      hub_id, uid, normalized, granted_by
    );
  }

  async getPrivilege(hub_id, uid) {
    const acl = rows(await this.query("SELECT privilege FROM hub_acl WHERE hub_id=? AND uid=? LIMIT 1", hub_id, uid))[0];
    return Number(acl && acl.privilege || 0);
  }

  async revokePrivilege(hub_id, uid) {
    await this.query("DELETE FROM hub_acl WHERE hub_id=? AND uid=?", hub_id, uid);
  }

  async resolveAuthorized({ hub_id, uid, organisation_id, asked_permission, capabilities = [] }) {
    const hub = await this.getHub(hub_id);
    if (!hub || hub.type !== "hub") throw new HubLifecycleError("HUB_NOT_FOUND", "Hub does not exist");
    if (Number(hub.organisation_id) !== Number(organisation_id)) throw new HubLifecycleError("HUB_ORGANISATION_MISMATCH", "Hub does not belong to the authenticated organisation");
    const effective_privilege = await this.getPrivilege(hub_id, uid);
    const asked = this.acl.permissionFor(asked_permission);
    if (!this.acl.grants(effective_privilege, asked)) throw new HubLifecycleError("HUB_PERMISSION_DENIED", `Hub permission bit ${asked} denied`);
    const exists = rows(await this.query("SELECT schema_name FROM information_schema.schemata WHERE schema_name=?", hub.database_name)).length === 1;
    if (!exists) throw new HubLifecycleError("HUB_SHARD_UNAVAILABLE", "Assigned Hub shard does not exist");
    const creation_ready = rows(await this.query("SELECT id FROM hub_plan WHERE hub_id=? AND kind='create' AND status='ready' LIMIT 1", hub_id)).length === 1;
    if (!creation_ready) throw new HubLifecycleError("HUB_NOT_READY", "Hub creation plan is not ready");
    for (const module_id of capabilities) {
      const state = rows(await this.query("SELECT status FROM hub_capability WHERE hub_id=? AND module_id=? LIMIT 1", hub_id, module_id))[0];
      if (!state || state.status !== "ready") throw new HubLifecycleError("HUB_CAPABILITY_NOT_READY", `Hub capability '${module_id}' is not ready`, { hub_id, module_id, status: state && state.status || "missing" });
    }
    return Object.freeze({ hub_id, type: "hub", organisation_id: Number(hub.organisation_id), uid, asked_permission: asked, privilege: effective_privilege, database_name: hub.database_name, db_host: hub.db_host || "", fs_host: hub.fs_host || "", home_dir: hub.home_dir, home_id: hub.home_id || null, authorized: true });
  }

  async findPlan(hub_id, fingerprint) {
    const row = rows(await this.query("SELECT id,hub_id,kind,plan_fingerprint,snapshot,status,plan_cursor,error_code FROM hub_plan WHERE hub_id=? AND plan_fingerprint=? LIMIT 1", hub_id, fingerprint))[0];
    if (row) row.cursor = Number(row.plan_cursor || 0);
    if (row && typeof row.snapshot === "string") row.snapshot = JSON.parse(row.snapshot);
    return row || null;
  }

  async createPlan(hub_id, kind, fingerprint, snapshot) {
    await this.query("INSERT IGNORE INTO hub_plan (hub_id,kind,plan_fingerprint,snapshot,status,ctime,mtime) VALUES (?,?,?,?, 'pending',UNIX_TIMESTAMP(),UNIX_TIMESTAMP())", hub_id, kind, fingerprint, JSON.stringify(snapshot));
    return this.findPlan(hub_id, fingerprint);
  }

  async beginCapability(hub_id, plan_id, module) {
    await this.query(
      "INSERT INTO hub_capability (hub_id,module_id,plan_id,target_version,artifact_ref,status,attempt,mtime) VALUES (?,?,?,?,?,'provisioning',1,UNIX_TIMESTAMP()) ON DUPLICATE KEY UPDATE plan_id=VALUES(plan_id),target_version=VALUES(target_version),artifact_ref=VALUES(artifact_ref),status=IF(applied_version=VALUES(target_version),'ready','provisioning'),attempt=IF(applied_version=VALUES(target_version),attempt,attempt+1),error_code=NULL,mtime=UNIX_TIMESTAMP()",
      hub_id, module.module_id, plan_id, module.schema_version, module.artifact_ref
    );
    return rows(await this.query("SELECT status,applied_version,attempt FROM hub_capability WHERE hub_id=? AND module_id=?", hub_id, module.module_id))[0];
  }

  async claimObjects(hub_id, module_id, object_keys) {
    for (const key of object_keys) {
      const found = rows(await this.query("SELECT module_id FROM hub_schema_object WHERE hub_id=? AND object_key=?", hub_id, key))[0];
      if (found && found.module_id !== module_id) throw new HubLifecycleError("SCHEMA_OBJECT_COLLISION", `${key} is already owned by '${found.module_id}'`);
      await this.query("INSERT IGNORE INTO hub_schema_object (hub_id,object_key,module_id,ctime) VALUES (?,?,?,UNIX_TIMESTAMP())", hub_id, key, module_id);
    }
  }

  async finishCapability(hub_id, plan_id, module, index) {
    await this.query("UPDATE hub_capability SET applied_version=target_version,status='ready',error_code=NULL,mtime=UNIX_TIMESTAMP() WHERE hub_id=? AND module_id=? AND plan_id=?", hub_id, module.module_id, plan_id);
    await this.query("UPDATE hub_plan SET status='running',plan_cursor=?,error_code=NULL,mtime=UNIX_TIMESTAMP() WHERE id=?", index + 1, plan_id);
  }

  async failCapability(hub_id, plan_id, module_id, code) {
    await this.query("UPDATE hub_capability SET status='failed',error_code=?,mtime=UNIX_TIMESTAMP() WHERE hub_id=? AND module_id=?", String(code || "HUB_PROVISIONING_FAILED").slice(0, 64), hub_id, module_id);
    await this.query("UPDATE hub_plan SET status='failed',error_code=?,mtime=UNIX_TIMESTAMP() WHERE id=?", String(code || "HUB_PROVISIONING_FAILED").slice(0, 64), plan_id);
    await this.query("UPDATE hub_lifecycle SET state='failed',error_code=?,mtime=UNIX_TIMESTAMP() WHERE hub_id=?", String(code || "HUB_PROVISIONING_FAILED").slice(0, 64), hub_id);
  }

  async finishPlan(hub_id, plan_id) {
    await this.query("UPDATE hub_plan SET status='ready',error_code=NULL,mtime=UNIX_TIMESTAMP() WHERE id=?", plan_id);
    await this.query("UPDATE hub_lifecycle SET state='ready',error_code=NULL,mtime=UNIX_TIMESTAMP() WHERE hub_id=?", hub_id);
    return this.getHub(hub_id);
  }

  async listHubs({ inherit, after = "", limit = 100 } = {}) {
    const size = Math.max(1, Math.min(500, Number(limit) || 100));
    return rows(await this.query("SELECT hub_id FROM hub_lifecycle WHERE inherit_policy=? AND hub_id>? ORDER BY hub_id LIMIT ?", inherit, after, size));
  }
}

module.exports = { ID, SCHEMA, SqlHubStore, quoteIdentifier, rows };
