"use strict";
const runtime = require("@drumee/server-runtime");
const { fail, OperatorBootstrapError } = require("./errors");
const { context, commitment, fingerprint, MODES } = require("./validation");
const { store, validateSchema, installSchema } = require("./store");
async function prerequisites(db, options) {
  const platform = options.platform || require("../../bootstrap/lib");
  try {
    if (!(await platform.validate({ database: db, domain: options.domain })).valid) fail("OPERATOR_PLATFORM_INVALID");
    if (!(await runtime.validatePlatformAuthority({ database: db })).valid) fail("OPERATOR_AUTHORITY_UNAVAILABLE");
    const auth = await db.query("SELECT routine_name FROM information_schema.routines WHERE routine_schema=DATABASE() AND routine_name IN ('session_signin','session_ensure') AND routine_type='PROCEDURE'");
    if (auth.length !== 2) fail("OPERATOR_AUTHENTICATION_UNAVAILABLE");
    const tables = await db.query("SELECT table_name,engine FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('entity','drumate','privilege')");
    if (tables.length !== 3 || tables.some(table => table.engine !== "InnoDB")) fail("OPERATOR_IDENTITY_SCHEMA_INVALID");
  } catch (error) { if (error instanceof OperatorBootstrapError) throw error; fail("OPERATOR_PREREQUISITE_FAILED"); }
}
async function requireIdle(db) {
  const state = (await db.query("SELECT @@in_transaction AS active,@@autocommit AS auto_commit"))[0];
  if (Number(state.active) !== 0 || Number(state.auto_commit) !== 1) fail("OPERATOR_CONNECTION_NOT_IDLE");
}
function empty(record) { return Object.entries(record).every(([key,value]) => ["singleton", "contract_version"].includes(key) || value === null); }
async function inspectRecord(db, record) {
  if (!record.operation_id) { if (!empty(record)) fail("OPERATOR_STATE_CORRUPT"); return null; }
  if (record.organisation_id !== 1 || !/^[a-f0-9]{16}$/.test(record.uid || "") || !/^[a-f0-9]{64}$/.test(record.identity_commitment || "") || !/^[a-f0-9]{128}$/.test(record.credential_commitment || "")) fail("OPERATOR_STATE_CORRUPT");
  const identity = { username: record.username, email: record.email };
  const expected = { contract_version: 1, domain: record.domain, organisation_id: 1, operation_id: record.operation_id, identity };
  if (commitment(expected) !== record.identity_commitment) fail("OPERATOR_STATE_CORRUPT");
  const rows = await db.query("SELECT e.id,e.ident,e.type,e.area,e.status,e.dom_id,d.username,d.domain_id,d.fingerprint,d.remit,d.email,JSON_VALUE(d.profile,'$.otp') AS otp,p.privilege,p.is_authoritative FROM entity e JOIN drumate d ON d.id=e.id LEFT JOIN privilege p ON p.uid=e.id WHERE e.id=?", record.uid);
  const human = rows[0];
  if (rows.length !== 1 || human.username !== record.username || human.ident !== record.username || human.email !== record.email || human.type !== "drumate" || human.area !== "personal" || human.status !== "active" || human.dom_id !== 1 || human.domain_id !== 1 || human.fingerprint !== record.credential_commitment || human.remit !== runtime.PLATFORM_ADMINISTRATOR.remit || Number(human.otp) !== 0 || human.privilege !== 1 || human.is_authoritative !== 1) fail("OPERATOR_STATE_CORRUPT");
  return { contract_version: 1, valid: true, uid: record.uid, operation_id: record.operation_id, policy: runtime.PLATFORM_ADMINISTRATOR.name };
}
async function installOperatorSchema(options) {
  context(options); const db = store(options.database); await requireIdle(db); await prerequisites(db, options);
  await installSchema(db); return { contract_version: 1, valid: true, schema_version: "kb01b-initial-operator-1" };
}
async function validateInitialOperator(options = {}) {
  try {
    if (options.organisation_id !== 1) fail("OPERATOR_ORGANISATION_INVALID");
    // Validation is read-only and does not require an enrollment authorization.
    context({ ...options, operation_id: "read-only-validation", identity: { username: "validator", email: "validator@localhost" }, authorization: { authorized: true, scope: "initial-operator", operation_id: "read-only-validation", domain: options.domain, organisation_id: options.organisation_id } });
    const db = store(options.database); await prerequisites(db, options);
    const record = await validateSchema(db);
    if (record.domain && record.domain !== options.domain) fail("OPERATOR_STATE_CORRUPT");
    const result = await inspectRecord(db, record);
    return result || { contract_version: 1, valid: false, diagnostic_codes: ["OPERATOR_NOT_ENROLLED"] };
  } catch (error) { return { contract_version: 1, valid: false, diagnostic_codes: [error instanceof OperatorBootstrapError ? error.code : "OPERATOR_VALIDATION_FAILED"] }; }
}
async function enrollInitialOperator(options = {}) {
  const intent = context(options), db = store(options.database);
  await requireIdle(db);
  await prerequisites(db, options); await validateSchema(db);
  const provider = options.credential_provider;
  if (!provider || !MODES.includes(provider.mode) || typeof provider.prepare !== "function") fail("OPERATOR_CREDENTIAL_PROVIDER_INVALID");
  let password, begun = false;
  // Trusted distribution/test hook permits controlled interruption testing, never
  // supplied by a network request. It receives phase names only, no secrets.
  const checkpoint = async phase => { if (options.checkpoint) await options.checkpoint(phase); };
  try {
    await checkpoint("before-credential");
    const material = await provider.prepare(intent); password = material?.password;
    const credential_commitment = fingerprint(password), identity_commitment = commitment(intent);
    await checkpoint("credential-prepared"); await checkpoint("before-transaction");
    await db.connection.beginTransaction(); begun = true;
    const record = (await db.query("SELECT * FROM initial_operator_enrollment WHERE singleton=1 FOR UPDATE"))[0];
    if (!record || record.contract_version !== 1) fail("OPERATOR_STATE_CORRUPT");
    // Revalidate platform invariants on the SAME connection while holding lock.
    await prerequisites(db, options);
    const previous = await inspectRecord(db, record);
    if (previous) {
      if (record.operation_id !== intent.operation_id || record.identity_commitment !== identity_commitment || record.credential_commitment !== credential_commitment) fail("OPERATOR_ENROLLMENT_CONFLICT");
      await db.connection.commit(); begun = false; return { ...previous, changed: false };
    }
    const existing = await db.query("SELECT id FROM drumate WHERE (remit & ?)=?", runtime.PLATFORM_ADMINISTRATOR.remit, runtime.PLATFORM_ADMINISTRATOR.remit);
    if (existing.length) fail("OPERATOR_ADMINISTRATOR_EXISTS");
    const collision = await db.query("SELECT id FROM drumate WHERE (username=? AND domain_id=?) OR email=?", intent.identity.username, 1, intent.identity.email);
    if (collision.length) fail("OPERATOR_IDENTITY_CONFLICT");
    const uid = (await db.query("SELECT uniqueId() AS id"))[0]?.id;
    if (!/^[a-f0-9]{16}$/.test(uid || "") || uid === "ffffffffffffffff") fail("OPERATOR_UID_INVALID");
    await db.query("INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES (?,?,?,?,'drumate','personal',1,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')", uid, intent.identity.username, "identity_" + uid, "/platform-identities/" + uid);
    await checkpoint("principal-inserted");
    await db.query("INSERT INTO drumate (id,username,domain_id,fingerprint,profile) VALUES (?,?,1,?,?)", uid, intent.identity.username, credential_commitment, JSON.stringify({ email: intent.identity.email, username: intent.identity.username, domain: intent.domain, otp: 0 }));
    await checkpoint("credential-inserted");
    await db.query("UPDATE drumate SET remit=? WHERE id=?", runtime.PLATFORM_ADMINISTRATOR.remit, uid);
    await db.query("INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES (?,1,1,1)", uid);
    await checkpoint("remit-assigned");
    await db.query("UPDATE initial_operator_enrollment SET operation_id=?,organisation_id=1,domain=?,uid=?,username=?,email=?,identity_commitment=?,credential_commitment=? WHERE singleton=1", intent.operation_id, intent.domain, uid, intent.identity.username, intent.identity.email, identity_commitment, credential_commitment);
    await checkpoint("metadata-written");
    const result = await inspectRecord(db, (await db.query("SELECT * FROM initial_operator_enrollment WHERE singleton=1"))[0]);
    await checkpoint("before-commit"); await db.connection.commit(); begun = false;
    await checkpoint("after-commit"); return { ...result, changed: true };
  } catch (error) {
    if (begun) await db.connection.rollback().catch(() => {});
    if (error instanceof OperatorBootstrapError) throw error;
    fail("OPERATOR_ENROLLMENT_FAILED");
  } finally { if (Buffer.isBuffer(password)) password.fill(0); }
}
module.exports = { installOperatorSchema, validateInitialOperator, enrollInitialOperator };
