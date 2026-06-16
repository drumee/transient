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
 * Decide whether a secure-share recipient holds ANY of the required capabilities.
 *
 * The recipient's effective capability set is the share's base caps UNION their
 * approved access grants, keyed by the resolved recipient email — identical to
 * the login derivation in dmz.js::_loginSecureShare. Keep the three in sync.
 *
 * Used by every per-operation guard that the coarse node-privilege bitmask cannot
 * isolate on its own (e.g. download — which the ACL treats as read-level, so a
 * view-only recipient would otherwise be able to fetch bytes; and upload/mkdir).
 *
 * @param {*} yp                 yellow-page DB handle (await_proc)
 * @param {string} token         the share token sent with the request
 * @param {string} recipientEmail account email for an authenticated viewer, or the
 *                               replayed grant_email for an anonymous one
 * @param {string[]} requiredCaps capabilities that authorize the op; the recipient
 *                               passes if they hold ANY one (e.g. download is
 *                               allowed by can_download OR can_edit)
 * @returns {Promise<null|boolean>}
 *   null  → NOT a secure-share request (no token, or a legacy/non-secure token) →
 *           caller proceeds with the normal ACL, untouched.
 *   true  → recipient holds one of requiredCaps → allow.
 *   false → recipient holds none of requiredCaps (or the share is revoked/expired)
 *           → caller must deny.
 */
async function secureShareCapVerdict(yp, token, recipientEmail, requiredCaps) {
  if (!token) return null;
  const req = Array.isArray(requiredCaps) ? requiredCaps : [requiredCaps];

  let info;
  try {
    info = toArray(await yp.await_proc("secure_share_info", token))[0];
  } catch (e) {
    // DB error: we cannot classify the token. Fail OPEN so a transient hiccup
    // never blocks normal/legacy ops — the rebind + client gate still apply.
    return null;
  }
  // Not a secure share (failed=1 / no creator) → legacy or invalid token; this
  // guard does not apply, so existing behaviour is left untouched.
  if (!info || info.failed || !info.creator_id) return null;
  // Revoked or expired share → deny. secure_share_info exposes this only as a
  // computed `validity` string (there is no revoked_at output column).
  if (info.validity && info.validity !== "TICKET_OK") return false;

  let caps = parseCaps(info.capabilities);
  if (!caps.length && info.permission_level && info.permission_level !== "can_view") {
    caps = [info.permission_level];
  }
  const satisfies = (list) => req.some((c) => list.indexOf(c) !== -1);
  // Base caps already satisfy → allow without the extra grant lookup (preserves
  // the original short-circuit for the common case).
  if (satisfies(caps)) return true;

  // Not satisfied by the base caps — check this recipient's APPROVED access
  // grants (a view-only base share may have a recipient upgraded to download/edit).
  const email = (recipientEmail || "").toLowerCase().trim();
  if (email) {
    try {
      const grants = toArray(
        await yp.await_proc("secure_share_get_access_grant", token, email)
      );
      for (const g of grants) {
        const raw = g && g.granted_level;
        if (!raw) continue;
        for (const lvl of String(raw).split(",").map((s) => s.trim()).filter(Boolean)) {
          if (req.indexOf(lvl) !== -1) return true;
        }
      }
    } catch (e) {
      // Grant lookup failed on a CONFIRMED secure share → fall through to deny
      // (fail closed).
    }
  }
  return false;
}

/**
 * Backward-compatible write verdict (upload / mkdir): write requires can_edit.
 * Thin wrapper over secureShareCapVerdict so existing callers are unchanged.
 * @returns {Promise<null|boolean>} see secureShareCapVerdict.
 */
async function secureShareWriteVerdict(yp, token, recipientEmail) {
  return secureShareCapVerdict(yp, token, recipientEmail, ["can_edit"]);
}

/**
 * Resolve the privilege bitmask a secure-share recipient is capped to, for capping
 * the per-node privilege returned by a folder LISTING (mfs_show_node_by). Used so a
 * recipient who is still creator-bound (an anonymous viewer) does not see the
 * creator's full per-node privilege in nested folders — the listing display is
 * clamped to the share's level at every depth. (Logged-in recipients are rebound to
 * their own capped uid, so their listing privilege is already capped and this is a
 * no-op for them.) This is a DISPLAY cap only — server-side write enforcement is the
 * separate token guards / capped-principal binding.
 *
 * Uses the CLIENT cumulative scale (matches dmz.js::_loginSecureShare CAP_PRIVILEGE
 * and the node `privilege` field): view/read=3, +download=7, +edit=15. can_chat adds
 * no bit (chat is gated by the can_chat flag, not the privilege bitmask).
 *
 * @returns {Promise<null|number>} null → NOT a secure share (no token / legacy /
 *   invalid) → caller must NOT cap; otherwise the cumulative privilege bitmask.
 */
async function secureShareCapPrivilege(yp, token, recipientEmail) {
  if (!token) return null;
  let info;
  try {
    info = toArray(await yp.await_proc("secure_share_info", token))[0];
  } catch (e) {
    return null; // cannot classify → do not cap (transient); behaviour unchanged
  }
  if (!info || info.failed || !info.creator_id) return null;
  // Revoked/expired/locked → the listing should not be serving content anyway; don't
  // touch the privilege here (DMZ login already gates validity). null = no cap.
  if (info.validity && info.validity !== "TICKET_OK") return null;

  let caps = parseCaps(info.capabilities);
  if (!caps.length && info.permission_level && info.permission_level !== "can_view") {
    caps = [info.permission_level];
  }
  // Union this recipient's approved access grants (a view-only base share may have
  // an upgraded recipient). Keyed by the resolved recipient email; anonymous → none.
  const email = (recipientEmail || "").toLowerCase().trim();
  if (email) {
    try {
      const grants = toArray(
        await yp.await_proc("secure_share_get_access_grant", token, email)
      );
      for (const g of grants) {
        const raw = g && g.granted_level;
        if (!raw) continue;
        for (const lvl of String(raw).split(",").map((s) => s.trim()).filter(Boolean)) {
          if (caps.indexOf(lvl) === -1) caps.push(lvl);
        }
      }
    } catch (e) {
      /* base caps only */
    }
  }

  let capPriv = 0b0000011; // view / read baseline
  if (caps.indexOf("can_download") !== -1) capPriv |= 0b0000111; // + download
  if (caps.indexOf("can_edit") !== -1) capPriv |= 0b0001111;     // + edit/modify
  return capPriv;
}

module.exports = { secureShareWriteVerdict, secureShareCapVerdict, secureShareCapPrivilege };
