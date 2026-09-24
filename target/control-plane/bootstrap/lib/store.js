"use strict";

const fs = require("fs");
const path = require("path");
const { PlatformBootstrapError } = require("./errors");

const ORGANISATION_SCHEMA = path.resolve(__dirname, "../schemas/001-organisation.sql");

function rows(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value.flatMap((entry) => rows(entry));
  return typeof value === "object" ? [value] : [];
}

class SqlPlatformStore {
  constructor({ database } = {}) {
    const query = database && (database.await_query || database.query);
    if (typeof query !== "function") {
      throw new PlatformBootstrapError("PLATFORM_DATABASE_REQUIRED", "Platform bootstrap requires a parameterized SQL query adapter");
    }
    this.database = database;
    this._query = query.bind(database);
  }

  async query(sql, ...parameters) {
    return this._query(sql, ...parameters);
  }

  async installSchema() {
    await this.query(fs.readFileSync(ORGANISATION_SCHEMA, "utf8"));
  }

  async transaction(operation) {
    await this.query("START TRANSACTION");
    try {
      const result = await operation();
      await this.query("COMMIT");
      return result;
    } catch (error) {
      await this.query("ROLLBACK");
      throw error;
    }
  }

  async inspect() {
    const organisation_table = rows(await this.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='organisation'"
    )).length === 1;
    const domains = rows(await this.query("SELECT id, name FROM domain ORDER BY id"));
    const organisations = organisation_table ? rows(await this.query(
      "SELECT sys_id, id, domain_id, name, link, ident, owner_id, metadata FROM organisation ORDER BY sys_id"
    )) : [];
    const configuration = rows(await this.query(
      "SELECT conf_key, conf_value FROM sys_conf WHERE conf_key IN ('nobody_id','guest_id','public_id','domain_name') ORDER BY conf_key"
    ));
    const configured = Object.fromEntries(configuration.map((row) => [row.conf_key, row.conf_value]));
    const ids = ["ffffffffffffffff", configured.guest_id].filter(Boolean);
    const placeholders = ids.map(() => "?").join(",") || "''";
    const principals = rows(await this.query(`
      SELECT e.id, e.ident, e.type, e.area, e.dom_id, e.status, e.db_name, e.home_dir,
        d.username, d.domain_id, d.email, d.profile,
        p.privilege, p.is_authoritative
      FROM drumate d
      INNER JOIN entity e ON e.id=d.id
      LEFT JOIN privilege p ON p.uid=d.id
      WHERE d.username IN ('nobody','guest','system') OR d.id IN (${placeholders})
      ORDER BY d.username, d.id
    `, ...ids));
    return { organisation_table, domains, organisations, configuration: configured, principals };
  }

  async generateId() {
    const result = rows(await this.query("SELECT uniqueId() AS id"))[0];
    if (!result || !/^[a-f0-9]{16}$/i.test(result.id || "")) {
      throw new PlatformBootstrapError("PLATFORM_ID_GENERATION_FAILED", "The intrinsic uniqueId() function did not return a Drumee identifier");
    }
    return result.id;
  }

  async createDomain(domain) {
    await this.query("INSERT INTO domain (id, name) VALUES (1, ?)", domain);
  }

  async createOrganisation({ id, domain, name }) {
    const metadata = JSON.stringify({ name, ident: "drumee", domain_id: 1, isOrganization: 1 });
    await this.query(
      "INSERT INTO organisation (sys_id,id,domain_id,name,link,ident,password_level,dir_visibility,dir_info,double_auth,usb_auth,owner_id,metadata) VALUES (1,?,1,?,?,'drumee',1,'all','all',0,0,NULL,?)",
      id, name, domain, metadata
    );
  }

  async createPrincipal({ id, username, domain, privilege }) {
    const profile = JSON.stringify({
      email: `${username}@${domain}`,
      firstname: username === "system" ? "System" : username === "guest" ? "Drumee" : "",
      lastname: username === "system" ? "User" : username === "guest" ? "Guest" : "",
      lang: "en",
      privilege,
      domain,
      username,
      otp: 0,
      category: "system"
    });
    const logical_root = `/platform-identities/${id}`;
    await this.query(
      "INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,?,?,?,'drumate','system',1,'system',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')",
      id, username, `identity_${id}`, logical_root
    );
    await this.query(
      "INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,?,1,'',?)",
      id, username, profile
    );
    await this.query(
      "INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,?,1)",
      id, privilege
    );
  }

  async setConfiguration(key, value) {
    await this.query("INSERT INTO sys_conf (conf_key,conf_value) VALUES (?,?)", key, value);
  }
}

module.exports = { ORGANISATION_SCHEMA, SqlPlatformStore, rows };
