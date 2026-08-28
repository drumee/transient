// service/lib/google_credentials.js
//
// Loads the Google Drive OAuth app credentials from
// /etc/drumee/credential/google/drive.json — a dedicated OAuth client for the
// Drive migration feature, separate from the login app (google/info.json read
// by loby/service/google.js). Shape: { id, secret }.
//
// Mirrors the loby file-based pattern instead of DB sysconf so the Drive app
// can be rotated independently of the login app.

const { resolve } = require('path');
const { readFileSync } = require('jsonfile');
const { sysEnv } = require('@drumee/server-essentials');

let _cache = null;

/**
 * @returns {{ id: string, secret: string }} Drive OAuth client id/secret.
 * @throws if the file is missing, malformed, or lacks id/secret.
 */
function googleDriveCredentials() {
  if (_cache) return _cache;
  const { credential_dir } = sysEnv();
  const file = resolve(credential_dir, 'google/drive.json');
  let c;
  try {
    c = readFileSync(file);
  } catch (e) {
    throw new Error(`google/drive.json unreadable (${file}): ${e && e.message}`);
  }
  if (!c || !c.id || !c.secret) {
    throw new Error(`google/drive.json missing id/secret (${file})`);
  }
  _cache = {
    id: c.id,
    secret: c.secret,
    // Optional Google Picker bits — MUST come from the SAME Cloud project as
    // the OAuth client: a REST API key and the project NUMBER (IAM & Admin →
    // Settings; not the project id). Absent → the FE picker is disabled and
    // picker_token answers PICKER_NOT_CONFIGURED.
    api_key: c.api_key || null,
    project_number: c.project_number || null,
  };
  return _cache;
}

let _saCache;

/**
 * Optional service-account key for the whole-folder import path (the user
 * SHARES a Drive folder with the SA's email; the SA then reads the entire
 * tree with its own auth — no OAuth scopes, no CASA). Standard Google SA
 * JSON key at /etc/drumee/credential/google/drive-sa.json.
 * @returns {{ client_email, private_key, ... } | null} null when absent.
 */
function googleDriveServiceAccount() {
  if (_saCache !== undefined) return _saCache;
  const { credential_dir } = sysEnv();
  const file = resolve(credential_dir, 'google/drive-sa.json');
  try {
    const c = readFileSync(file);
    _saCache = (c && c.client_email && c.private_key) ? c : null;
  } catch (e) {
    _saCache = null;
  }
  return _saCache;
}

module.exports = { googleDriveCredentials, googleDriveServiceAccount };
