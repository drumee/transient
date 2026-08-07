/**
 * Find the physical move row returned by mfs_move_all.
 *
 * A stored procedure call can arrive as a flat row array or as a raw
 * multi-result value such as [statusRow, [operationRows...]]. Only the move
 * row for the requested source node carries the canonical destination id.
 */
function findMfsMoveResult(result, sourceNid) {
  if (sourceNid == null) return null;

  if (Array.isArray(result)) {
    for (const item of result) {
      const move = findMfsMoveResult(item, sourceNid);
      if (move) return move;
    }
    return null;
  }

  if (!result || typeof result !== "object") return null;
  if (result.action !== "move" || result.nid == null) return null;
  return String(result.nid) === String(sourceNid) ? result : null;
}

function isCompleteMfsThreadMigration({ sourcePosition, destinationPosition }) {
  return Boolean(!sourcePosition && destinationPosition
    && Number(destinationPosition.root_identity_count) === 1
    && Number(destinationPosition.stale_child_identity_count) === 0);
}

/**
 * Give the database result a short, read-only convergence window. The
 * failure-isolated migration is not safe to invoke twice because a partial
 * first pass can already own destination message identities.
 */
async function waitForMfsThreadMigration(
  readPositions,
  { attempts = 1, delay = async () => { } } = {}
) {
  const maxAttempts = Math.max(1, Number(attempts) || 1);
  let positions;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    positions = await readPositions();
    if (isCompleteMfsThreadMigration(positions)) return positions;
    if (attempt + 1 < maxAttempts) await delay();
  }

  return positions;
}

module.exports = {
  findMfsMoveResult,
  isCompleteMfsThreadMigration,
  waitForMfsThreadMigration,
};
