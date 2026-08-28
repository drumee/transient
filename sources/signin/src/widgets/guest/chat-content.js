/**
 * Turn a dmz.chat_by_token reply into the bubbles the Conversation panel
 * renders — the counterpart of share-content.js for the workspace chat.
 *
 * Row shape from the endpoint:
 *   { message_id, author_id, author, message, ctime, is_reply }
 *
 * Everything a guest sees here is incoming: the panel is read-only and the
 * visitor has authored nothing, so no bubble is ever `out`.
 */

/** "11:42 AM" from unix seconds; "" when there is no usable timestamp. */
function formatTime(ts) {
  const n = Number(ts || 0);
  if (!n) return "";
  try {
    return new Date(n * 1000).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  } catch (e) {
    return "";
  }
}

/**
 * The bubble body is assigned to innerHTML (the sample carries markup for file
 * chips), so anything coming from a real message has to be escaped or a message
 * could inject markup into the page. Escaped here rather than at the view,
 * which cannot tell trusted sample text from a stranger's message.
 */
function escapeHtml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * The author's avatar, via the host's own helper.
 *
 * Visitor.avatar() short-circuits to the VIEWER's own avatar when they have one
 * set as an absolute URL — harmless here, since the viewer is anonymous and has
 * none, but it is why this is not used for anything but a guest page.
 *
 * @param {string} id author id
 * @returns {string} "" when no id or no host helper
 */
function avatarUrl(id) {
  if (!id) return "";
  try {
    if (typeof Visitor !== "undefined" && Visitor && Visitor.avatar) {
      return Visitor.avatar(id, "vignette");
    }
  } catch (e) {
    // fall through to the endpoint-relative form
  }
  return `avatar/${id}?type=vignette`;
}

/**
 * @param {Array} rows messages returned by dmz.chat_by_token
 * @returns {Array<{author: string, avatar: string, text: string, time: string}>}
 */
function mapMessages(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const out = [];
  for (const row of list) {
    if (!row) continue;
    const text = escapeHtml(row.message);
    if (!text) continue;
    out.push({
      // A real name, or the local part of the author's address when the account
      // has no name set — the endpoint never sends the domain. Falls back to a
      // generic label only when it sends neither.
      author: (row.author || "").trim() || LOCALE.MEMBER || "Member",
      // Avatars are served publicly (avatar/<id>?type=vignette answers 200 to
      // an anonymous request), so unlike file previews these can be a plain URL
      // and do not have to be inlined by the server.
      avatar: avatarUrl(row.author_id),
      text,
      time: formatTime(row.ctime),
    });
  }
  return out;
}

module.exports = { mapMessages };
