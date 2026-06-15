// ==================================================================== *
//   Secure-share write guard
//   Shared by media.js write handlers (upload, make_dir) to enforce a secure-
//   share recipient's capability set SERVER-SIDE.
//
//   The DMZ guest session is cookie-bound to the share CREATOR (so hub
//   endpoints like media.show_node_by resolve), which means this.uid carries
//   the creator's FULL privilege — the normal write ACL therefore always passes
//   for a recipient, regardless of the share's level. This guard re-derives the
//   RECIPIENT's effective write capability (base share caps UNION approved
//   access grants) directly from the share token, mirroring the login logic in
//   dmz.js::_loginSecureShare. Keep the two in sync.
// ==================================================================== *
const { toArray } = require("@drumee/server-essentials");

function parseCaps(raw) {
  if (Array.isArray(raw)) return raw.slice();
  if (typeof raw === "string" && raw.trim()) {
    try {
      const p = JSON.parse(raw);
      if (Array.isArray(p)) return p;
    } catch (e) {
      /* ignore malformed JSON */
    }
  }
  return [];
}

/**
 * Decide whether a secure-share recipient may perform a write (upload / mkdir).
 *
 * @param {*} yp              yellow-page DB handle (await_proc)
 * @param {string} token      the share token sent with the write request
 * @param {string} recipientEmail  resolved by the caller — account email for an
 *                            authenticated viewer, replayed grant_email for an
 *                            anonymous one (mirrors _loginSecureShare keying)
 * @returns {Promise<null|boolean>}
 *   null  → NOT a secure-share write (no token, or token is not a secure share,
 *           e.g. a legacy DMZ folder link) → caller proceeds with normal ACL.
 *   true  → secure-share recipient HAS can_edit (base or approved grant) → allow.
 *   false → secure-share recipient lacks can_edit → caller must deny.
 */
async function secureShareWriteVerdict(yp, token, recipientEmail) {
  if (!token) return null;

  let info;
  try {
    info = toArray(await yp.await_proc("secure_share_info", token))[0];
  } catch (e) {
    // DB error: we cannot classify the token. Fail OPEN so a transient hiccup
    // never blocks normal/legacy writes — the client-side gate still applies.
    return null;
  }
  // Not a secure share (failed=1 / no creator) → legacy or invalid token; this
  // guard does not apply, so existing behaviour is left untouched.
  if (!info || info.failed || !info.creator_id) return null;
  // Revoked or expired share → no write. secure_share_info exposes this only as
  // a computed `validity` string (there is no revoked_at output column).
  if (info.validity && info.validity !== "TICKET_OK") return false;

  let caps = parseCaps(info.capabilities);
  if (!caps.length && info.permission_level && info.permission_level !== "can_view") {
    caps = [info.permission_level];
  }
  if (caps.indexOf("can_edit") !== -1) return true;

  // No base edit grant — check this recipient's APPROVED access requests. The
  // grant union is keyed by the recipient email the caller resolved, exactly as
  // _loginSecureShare does (can_edit can be requested + approved, so a view-only
  // base share may legitimately have an edit-upgraded recipient).
  const email = (recipientEmail || "").toLowerCase().trim();
  if (email) {
    try {
      const grants = toArray(
        await yp.await_proc("secure_share_get_access_grant", token, email)
      );
      for (const g of grants) {
        const raw = g && g.granted_level;
        if (!raw) continue;
        for (const lvl of String(raw).split(",").map((s) => s.trim())) {
          if (lvl === "can_edit") return true;
        }
      }
    } catch (e) {
      // Grant lookup failed on a CONFIRMED secure share → fall through to deny
      // (fail closed).
    }
  }
  return false;
}

module.exports = { secureShareWriteVerdict };
