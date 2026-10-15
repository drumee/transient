"use strict";
const fs = require("node:fs"), path = require("node:path"), crypto = require("node:crypto");
const { fail, OperatorBootstrapError } = require("./errors");
const { MODES, commitment, fingerprint } = require("./validation");
function ownedFile(stat) {
  if (!stat.isFile() || stat.uid !== process.getuid() || (stat.mode & 0o777) !== 0o600 || stat.nlink !== 1) fail("OPERATOR_CREDENTIAL_RESOURCE_UNSAFE");
}
function location(file) {
  if (typeof file !== "string" || !path.isAbsolute(file) || path.normalize(file) !== file) fail("OPERATOR_CREDENTIAL_PATH_INVALID");
  let current = path.parse(file).root;
  for (const part of path.dirname(file).slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part); const stat = fs.lstatSync(current);
    if (!stat.isDirectory() || stat.isSymbolicLink()) fail("OPERATOR_CREDENTIAL_RESOURCE_UNSAFE");
    if ((stat.mode & 0o022) && !(stat.mode & 0o1000)) fail("OPERATOR_CREDENTIAL_RESOURCE_UNSAFE");
  }
  const parent = fs.lstatSync(path.dirname(file));
  if (parent.uid !== process.getuid() || (parent.mode & 0o777) !== 0o700) fail("OPERATOR_CREDENTIAL_RESOURCE_UNSAFE");
}
function read(file) {
  location(file); let fd;
  try {
    fd = fs.openSync(file, fs.constants.O_RDONLY | fs.constants.O_NOFOLLOW);
    const stat = fs.fstatSync(fd); ownedFile(stat);
    if (stat.size > 8192) fail("OPERATOR_CREDENTIAL_RESOURCE_CORRUPT");
    const bytes = fs.readFileSync(fd);
    try {
      const value = JSON.parse(bytes.toString("utf8"));
      const { checksum, ...payload } = value;
      if (commitment(payload) !== checksum || payload.contract_version !== 1 || !MODES.includes(payload.mode) || typeof payload.password !== "string") fail("OPERATOR_CREDENTIAL_RESOURCE_CORRUPT");
      const password = Buffer.from(payload.password, "utf8"); fingerprint(password); password.fill(0);
      return value;
    } finally { bytes.fill(0); }
  } catch (error) { if (error instanceof OperatorBootstrapError || error.code === "ENOENT") throw error; fail("OPERATOR_CREDENTIAL_RESOURCE_UNSAFE"); }
  finally { if (fd !== undefined) fs.closeSync(fd); }
}
function safeRead(file) {
  try { return read(file); }
  catch (error) { if (error.code === "ENOENT") return null; throw error; }
}
function binding(value) { return { contract_version: value.contract_version, domain: value.domain, organisation_id: value.organisation_id, operation_id: value.operation_id, identity: value.identity }; }
function matching(record, intent, mode) {
  if (record.mode !== mode || commitment(binding(record)) !== commitment(intent)) fail("OPERATOR_CREDENTIAL_RESOURCE_CONFLICT");
}
async function promptPassword({ input = process.stdin, output = process.stderr } = {}) {
  if (!input.isTTY || !output.isTTY || typeof input.setRawMode !== "function") fail("OPERATOR_SECURE_INPUT_REQUIRED");
  async function once(label) {
    const was_raw = input.isRaw;
    return new Promise((resolve, reject) => {
      const bytes = []; let finished = false;
      function finish(error) {
        if (finished) return; finished = true;
        input.removeListener("end", onError); input.removeListener("close", onError);
        input.removeListener("data", onData); input.removeListener("error", onError); input.setRawMode(!!was_raw); input.pause(); output.write("\n");
        const value = Buffer.from(bytes); bytes.fill(0); if (error) { value.fill(0); reject(error); } else resolve(value);
      }
      const onError = () => finish(new OperatorBootstrapError("OPERATOR_SECURE_INPUT_FAILED"));
      const onData = chunk => {
        for (const byte of chunk) {
          if (byte === 3 || byte === 4) return finish(new OperatorBootstrapError("OPERATOR_SECURE_INPUT_CANCELLED"));
          if (byte === 13 || byte === 10) return finish();
          if (byte === 127 || byte === 8) bytes.pop();
          else bytes.push(byte);
          if (bytes.length > 128) return finish(new OperatorBootstrapError("OPERATOR_CREDENTIAL_INVALID"));
        }
      };
      input.on("data", onData); input.once("error", onError); input.once("end", onError); input.once("close", onError);
      try { input.setRawMode(true); input.resume(); output.write(label); } catch (_) { onError(); }
    });
  }
  const first = await once("Initial Drumee password: "); let confirmation;
  try {
    confirmation = await once("Confirm password: ");
    if (first.length !== confirmation.length || !crypto.timingSafeEqual(first, confirmation)) fail("OPERATOR_CREDENTIAL_CONFIRMATION_FAILED");
    fingerprint(first); return first;
  } catch (error) { first.fill(0); throw error; }
  finally { if (confirmation) confirmation.fill(0); }
}
function descriptorPassword(fd) {
  if (!Number.isInteger(fd) || fd < 3) fail("OPERATOR_SECURE_INPUT_REQUIRED");
  const stat = fs.fstatSync(fd); ownedFile(stat);
  if (stat.size > 130) fail("OPERATOR_CREDENTIAL_INVALID");
  const bytes = fs.readFileSync(fd), trimmed = Buffer.from(bytes.toString("utf8").replace(/\r?\n$/, "")); bytes.fill(0);
  fingerprint(trimmed); return trimmed;
}
/** Explicit resource preparation. Parent must exist, be operator-owned 0700.
 * Never writes into plans, images, environment variables or ordinary reports.
 */
function createFileCredentialProvider({ mode, file, password_fd, input, output } = {}) {
  if (!MODES.includes(mode)) fail("OPERATOR_MODE_INVALID");
  if (typeof file !== "string") fail("OPERATOR_CREDENTIAL_PATH_INVALID");
  return {
    mode,
    async prepare(intent) {
      let lock, temp, password;
      try {
        location(file);
        // Exclusive short-lived writer lock; stale locks are never stolen.
        try { lock = fs.openSync(file + ".lock", fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600); }
        catch (_) { fail("OPERATOR_CREDENTIAL_RESOURCE_BUSY"); }
        const previous = safeRead(file);
        if (previous) { matching(previous, intent, mode); return { password: Buffer.from(previous.password, "utf8") }; }
        password = mode === "interactive" ? password_fd !== undefined ? descriptorPassword(password_fd) : await promptPassword({ input, output }) : Buffer.from(crypto.randomBytes(32).toString("base64url"));
        fingerprint(password);
        const payload = { ...intent, mode, password: password.toString("utf8") };
        const resource = { ...payload, checksum: commitment(payload) };
        temp = file + ".pending-" + crypto.randomBytes(8).toString("hex");
        const fd = fs.openSync(temp, fs.constants.O_CREAT | fs.constants.O_EXCL | fs.constants.O_WRONLY | fs.constants.O_NOFOLLOW, 0o600);
        try { fs.writeFileSync(fd, JSON.stringify(resource)); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
        fs.linkSync(temp, file); fs.unlinkSync(temp); temp = null;
        const parent_fd = fs.openSync(path.dirname(file), fs.constants.O_RDONLY | fs.constants.O_DIRECTORY | fs.constants.O_NOFOLLOW);
        try { fs.fsyncSync(parent_fd); } finally { fs.closeSync(parent_fd); }
        return { password: Buffer.from(password) };
      } catch (error) { if (error instanceof OperatorBootstrapError) throw error; fail("OPERATOR_CREDENTIAL_PREPARATION_FAILED"); }
      finally {
        if (password) password.fill(0);
        if (temp) { try { fs.unlinkSync(temp); } catch (_) {} }
        if (lock !== undefined) { fs.closeSync(lock); fs.unlinkSync(file + ".lock"); }
      }
    }
  };
}
function retrieveInitialCredential({ file, authorization } = {}) {
  if (!authorization || authorization.authorized !== true || authorization.scope !== "retrieve-initial-credential") fail("OPERATOR_RETRIEVAL_AUTHORIZATION_REQUIRED");
  try {
    const record = read(file);
    if (record.operation_id !== authorization.operation_id) fail("OPERATOR_CREDENTIAL_RESOURCE_CONFLICT");
    // Explicit trusted-process retrieval only. Caller owns secure delivery and
    // must clear the buffer; this is never an enrollment result or default CLI.
    return { username: record.identity.username, email: record.identity.email, password: Buffer.from(record.password, "utf8") };
  } catch (error) { if (error instanceof OperatorBootstrapError) throw error; fail("OPERATOR_CREDENTIAL_RESOURCE_MISSING"); }
}
module.exports = { createFileCredentialProvider, retrieveInitialCredential, promptPassword };
