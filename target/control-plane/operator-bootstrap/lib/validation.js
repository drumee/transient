"use strict";
const crypto = require("node:crypto");
const { fail } = require("./errors");
const MODES = Object.freeze(["test", "interactive", "automatic"]);
function context({ contract_version, domain, organisation_id, operation_id, identity, authorization } = {}) {
  if (contract_version !== 1) fail("OPERATOR_CONTRACT_INVALID");
  if (organisation_id !== 1) fail("OPERATOR_ORGANISATION_INVALID");
  if (typeof domain !== "string" || domain.length > 253 || domain !== domain.toLowerCase() || !/^(?:localhost|[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+)$/.test(domain) || domain.split(".").some(label => label.length > 63)) fail("OPERATOR_DOMAIN_INVALID");
  if (typeof operation_id !== "string" || !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{7,127}$/.test(operation_id)) fail("OPERATOR_OPERATION_INVALID");
  if (!authorization || authorization.authorized !== true || authorization.scope !== "initial-operator" || authorization.operation_id !== operation_id || authorization.domain !== domain || authorization.organisation_id !== organisation_id) fail("OPERATOR_AUTHORIZATION_REQUIRED");
  if (!identity || Object.keys(identity).some(key => !["username", "email"].includes(key)) || typeof identity.username !== "string" || !/^[a-z][a-z0-9._-]{2,63}$/.test(identity.username) || ["nobody", "guest", "system"].includes(identity.username)) fail("OPERATOR_IDENTITY_INVALID");
  if (typeof identity.email !== "string" || identity.email.length > 128 || !/^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(identity.email)) fail("OPERATOR_EMAIL_INVALID");
  return { contract_version, domain, organisation_id, operation_id, identity: { username: identity.username, email: identity.email } };
}
const commitment = value => crypto.createHash("sha256").update(JSON.stringify(value)).digest("hex");
function fingerprint(password) {
  if (!Buffer.isBuffer(password) || password.length < 16 || password.length > 128 || password.includes(0) || password.toString("utf8").includes("\n") || !Buffer.from(password.toString("utf8")).equals(password)) fail("OPERATOR_CREDENTIAL_INVALID");
  return crypto.createHash("sha512").update(password).digest("hex");
}
module.exports = { MODES, context, commitment, fingerprint };
