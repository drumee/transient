/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3
 */

/**
 * The workspace name a hub-invite notification renders.
 *
 * Both surfaces that shape a hub-invite row -- activity.js (the bell feed, via
 * mapHubInviteRow) and hub.invite_received_get (the pending-invite list) -- have
 * to answer this the same way. They used to each carry their own copy of the
 * chain, the copies drifted, and that drift IS the bug this exists to close: the
 * feed never resolved a name at all while the pending list did.
 *
 * The order matters:
 *   headline / ident   yp.entity's own fields. Kept FIRST so that anything that
 *                      already resolves keeps resolving -- but note both columns
 *                      are NULL on every hub in practice, which is why the feed
 *                      rendered "<inviter> invited you to " with a blank label.
 *   hub_live_name      yp.hub.name, the live display name, added to
 *                      notification_hub_invites. This is what normally answers.
 *   meta.hub_name      the name captured on the invite row itself. Last resort:
 *                      it is the only source left once the workspace has been
 *                      deleted, since there is then no yp.hub row to read. It
 *                      goes stale if the workspace was renamed, hence last.
 *
 * yp.hub.hubname is deliberately absent from the chain: it holds the hex id, and
 * rendering that as a workspace name is worse than rendering nothing. For the
 * same reason the meta branch rejects legacy rows that stored the hub id in that
 * field.
 *
 * @param {object} row  a notification_hub_invites row
 * @param {object} meta the parsed `data` JSON of that row
 * @returns {string|null} the name to render, or null when nothing resolves
 */
function resolveHubInviteName(row, meta) {
  const r = row || {};
  const m = meta || {};
  const hub_id = m.hub_id || null;
  return r.hub_headline
    || r.hub_ident
    || r.hub_live_name
    || (m.hub_name && m.hub_name !== hub_id ? m.hub_name : null);
}

module.exports = { resolveHubInviteName };
