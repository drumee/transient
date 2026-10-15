"use strict";
const fs = require("node:fs"), path = require("node:path");
const { fail } = require("./errors");
function store(database) {
  const connection = database && database.connection;
  // Native dedicated MariaDB connection; a pool/query facade is insufficient.
  if (!connection || !Number.isInteger(connection.threadId) || typeof connection.beginTransaction !== "function" || typeof connection.commit !== "function" || typeof connection.rollback !== "function" || typeof connection.getConnection === "function") fail("OPERATOR_DEDICATED_CONNECTION_REQUIRED");
  const query = async (sql, ...parameters) => {
    try { return await connection.query(sql, parameters); }
    catch (_) { fail("OPERATOR_DATABASE_FAILURE"); }
  };
  return { connection, query, await_query: query };
}
async function validateSchema(db) {
  const columns = await db.query("SELECT column_name,column_type,is_nullable,column_key FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='initial_operator_enrollment' ORDER BY ordinal_position");
  const names = ["singleton", "contract_version", "operation_id", "organisation_id", "domain", "uid", "username", "email", "identity_commitment", "credential_commitment"];
  const types = [/^tinyint(?:\(\d+\))? unsigned$/, /^tinyint(?:\(\d+\))? unsigned$/, /^varchar\(128\)$/, /^int(?:\(\d+\))? unsigned$/, /^varchar\(253\)$/, /^varchar\(16\)$/, /^varchar\(80\)$/, /^varchar\(128\)$/, /^char\(64\)$/, /^char\(128\)$/];
  const table = await db.query("SELECT engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='initial_operator_enrollment'");
  if (columns.length !== names.length || table[0]?.engine !== "InnoDB" || columns.some((column, index) => column.column_name !== names[index] || !types[index].test(column.column_type) || column.is_nullable !== (index < 2 ? "NO" : "YES") || (index === 0 ? column.column_key !== "PRI" : [2,5].includes(index) && column.column_key !== "UNI"))) fail("OPERATOR_SCHEMA_INVALID");
  const rows = await db.query("SELECT * FROM initial_operator_enrollment");
  if (rows.length !== 1 || rows[0].singleton !== 1 || rows[0].contract_version !== 1) fail("OPERATOR_STATE_CORRUPT");
  return rows[0];
}
async function installSchema(db) {
  const existing = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name='initial_operator_enrollment'");
  if (!existing.length) {
    // DDL is intentionally separate. An interruption before seed requires explicit
    // operator investigation, never an automatic takeover of an empty table.
    await db.query(fs.readFileSync(path.join(__dirname, "../schemas/001-initial-operator.sql"), "utf8"));
    await db.query("INSERT INTO initial_operator_enrollment (singleton,contract_version) VALUES (1,1)");
  }
  return validateSchema(db);
}
module.exports = { store, validateSchema, installSchema };
