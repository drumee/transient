/**
 * @license
 * Copyright 2026 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3.
 * https://www.gnu.org/licenses/agpl-3.0.html
 */

const { RedisStore, utils } = require("@drumee/server-essentials");
const { isEmpty } = require("lodash");

// toArray comes from server-essentials' utils, NOT lodash — lodash's toArray
// turns an object into its values array, which would silently mangle the
// entity_sockets row set. Mirrors hub.js:52 `const { toArray } = utils`.
const { toArray } = utils;

/**
 * Tell every online member of a hub that someone just joined, so any open
 * permission matrices (Folder settings) refetch instead of showing a member
 * list that is missing the person who was just invited/added.
 *
 * Callable from any service context — including anonymous-scope ones like
 * hub.accept_invite that have no this.hub / this.db — because hub_id is passed
 * in rather than read off the service.
 *
 * The joiner's own sockets are NOT excluded here: entity_sockets' `exclude`
 * arg splices JSON array items straight into `s.id NOT IN (...)`, and
 * user_sockets returns rows ({cookie,uid,socket_id}) rather than bare ids, so
 * passing them through would emit broken SQL. The receiving window drops its
 * own echo instead (folder/index.js _onMemberJoined guards data.uid === Visitor.id).
 *
 * Never throws: a failed notification must not fail the join itself — every
 * call site is reached only after add_member/permission_grant have committed.
 *
 * @param {object} svc      service instance (needs .yp, .payload, .warn)
 * @param {string} hub_id   hub the member joined
 * @param {string} uid      the joiner's drumate id (may be null/undefined for
 *                          admin-driven multi-adds where there is no single
 *                          joiner to echo)
 */
async function notifyMemberJoined(svc, hub_id, uid) {
  if (!svc || !hub_id) return;
  try {
    const dest = toArray(await svc.yp.await_proc("entity_sockets", hub_id));
    if (isEmpty(dest)) return;
    await RedisStore.sendData(
      svc.payload({ hub_id, uid }, { service: "hub.member_joined" }),
      dest
    );
  } catch (e) {
    if (svc.warn) {
      svc.warn("[notifyMemberJoined] failed for hub", hub_id, e && e.message);
    }
  }
}

module.exports = { notifyMemberJoined };
