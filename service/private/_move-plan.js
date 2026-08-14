/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3
 */

const { toArray } = require("@drumee/server-essentials");

/**
 * Normalize the row set returned by `mfs_move_all` / `mfs_copy_all` into a flat
 * list of plan rows.
 *
 * The driver's `get_rows` (server-essentials/lib/addons/array.js) unwraps a
 * single result set into flat row objects, but keeps several result sets
 * nested. `mfs_move_all` emits more than one: the plan itself, plus a stray set
 * from `seo_update_hub`, which ends in a bare SELECT called once per moved
 * node.
 *
 * Consumers switch on `row.action`. Handed a nested array, `.action` is
 * undefined, no case matches, and the loop finishes without moving a single
 * file — after the database has already committed. That is how a workspace ends
 * up with rows pointing at node ids whose storage directory was never created:
 * the record says the file moved, every preview and download 404s.
 *
 * `mfs_create_node` makes this permanent rather than incidental. It is called
 * from inside `mfs_move_all` and its rollback branch emits a result set of its
 * own, which `ensureCreateNode` reads as `node[1]` to drive deadlock and
 * duplicate-name retries. That branch cannot be removed, so a move can always
 * grow an extra result set. Normalizing here covers every source of one.
 *
 * `mfs_move_all` also emits the plan before the SEO loop, so the plan is first
 * in line. That ordering is not what makes this correct — the driver nests
 * whenever there is more than one result set, whatever their order — and this
 * function is what the correctness rests on.
 *
 * Every INSERT into `_final_media` sets `action` explicitly ('show', 'showone',
 * 'move'), so its presence is what distinguishes a plan row from the noise.
 */
function movePlanRows(data, ctx = null) {
  const flat = [];
  for (const item of toArray(data)) {
    if (Array.isArray(item)) {
      flat.push(...item);
    } else {
      flat.push(item);
    }
  }

  const rows = [];
  const strays = [];
  for (const row of flat) {
    if (Array.isArray(row)) {
      // Unreachable against today's driver, which nests at most one level:
      // get_rows tests `typeof i[0] !== 'array'`, and typeof never yields
      // "array", so its deeper branch is dead. Kept so that fixing that typo
      // upstream cannot quietly put arrays back into the plan.
      strays.push(row);
    } else if (row && (row.action || row.failed)) {
      // `failed` rows carry the sqlstate from a rolled-back mfs_create_node.
      // They are not plan rows, but transact() reports them, and dropping them
      // here would silently discard the only account of why a move fell short.
      rows.push(row);
    } else if (row) {
      strays.push(row);
    }
  }

  // Never silent. A move that relocates nothing looked exactly like a move that
  // succeeded for seven months, because the unmatched rows fell through a
  // `switch` that logged nothing.
  if (ctx && ctx.warn) {
    if (rows.length === 0) {
      // Empty counts too. call_proc routes a failed CALL through _handleError,
      // which logs and returns undefined rather than throwing, so a hard SQL
      // failure reaches here as nothing at all — indistinguishable from a move
      // that legitimately had no work to do, unless it is said out loud.
      ctx.warn("Move plan carried no actionable row", {
        received: flat.length,
        sample: JSON.stringify(strays[0] || null).slice(0, 200),
      });
    } else if (strays.length > 0) {
      ctx.warn("Ignored non-plan rows in move result", {
        count: strays.length,
      });
    }
  }

  return rows;
}

module.exports = { movePlanRows };
