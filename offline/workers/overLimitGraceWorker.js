/**
 * Over-Limit Grace Worker
 *
 * The second half of the downgrade over-limit state machine
 * (service/lib/over-limit.js + yp org_over_limit_*): an org that is still
 * over its downgraded plan's storage or seat limit when the grace deadline
 * passes flips from over_limit (read-only, everyone can still look) to
 * hard_lock (owner/admin-only access — everyone else is denied entirely
 * until the owner resolves). One unresolved flag is enough; nothing is ever
 * deleted here or anywhere else in the feature.
 *
 * Effect first, mark second — org_over_limit_hard_lock is status-guarded
 * (state='over_limit' AND deadline passed), so a retried tick, or a worker
 * racing an owner who resolves at the buzzer, is a no-op: the resolution
 * path already removed the block and ROW_COUNT() comes back 0.
 *
 * Model: mirrors promoExpiryWorker.js — plain setTimeout self-rescheduler
 * (the runtime ships Bull, not `cron`), short interval since deadlines land
 * at arbitrary times of day.
 *
 * Env:
 *   OVER_LIMIT_GRACE_INTERVAL_SEC  poll cadence (default 900 = 15 min)
 *
 * The whole feature is gated by `over_limit_enforcement` in myDrumee.json —
 * but that global belongs to the service process, not this worker, so the
 * worker gates on data instead: org_over_limit_due only ever returns rows
 * that an enabled service wrote. No flags written → nothing to flip.
 */

const { Mariadb, RedisStore } = require('@drumee/server-essentials');
const OverLimit = require('../../service/lib/over-limit');

const WORKER_NAME = process.env.WORKER_NAME || 'over-limit-grace-worker-1';
const INTERVAL_MS = (parseInt(process.env.OVER_LIMIT_GRACE_INTERVAL_SEC, 10) || 900) * 1000;

console.log(`[OverLimitGraceWorker] Starting worker: ${WORKER_NAME}`);
console.log(`[OverLimitGraceWorker] Poll interval: ${INTERVAL_MS / 1000}s`);

let yp;
let redisReady = false;

function asArray(x) {
  if (Array.isArray(x)) return x;
  return x == null ? [] : [x];
}

async function initialize() {
  yp = new Mariadb({ name: 'yp' });
  console.log('[OverLimitGraceWorker] Database connected');
  try {
    await RedisStore.prototype.init.call(new RedisStore());
    redisReady = true;
    console.log('[OverLimitGraceWorker] RedisStore initialized');
  } catch (e) {
    // Flag-only mode: the lock still lands, clients learn on next boot.
    console.warn('[OverLimitGraceWorker] RedisStore unavailable:', e.message);
  }
}

async function lockOne(row) {
  const { org_id, domain_id } = row;
  try {
    let res = await yp.await_proc('org_over_limit_hard_lock', org_id);
    if (Array.isArray(res)) res = res[0];
    if (!res || ~~res.locked !== 1) {
      // Resolved (or already locked) between the scan and now — nothing to do.
      return false;
    }
    // Re-evaluate to refresh the numbers and push the hard_lock state to
    // every member's open session. evaluate() keeps hard_lock as-is (it
    // never un-hard-locks on its own) — this is a refresh + fan-out, not a
    // second decision.
    await OverLimit.evaluate(yp, ~~domain_id, {
      notify: redisReady ? (state) => OverLimit.notifyDomain(yp, RedisStore, state) : null,
    });
    console.log(`[OverLimitGraceWorker] hard-locked org=${org_id} domain=${domain_id}`);
    return true;
  } catch (error) {
    console.error(`[OverLimitGraceWorker] failed to lock org=${org_id}:`, error.message);
    return false;
  }
}

async function runGraceJob() {
  try {
    const due = asArray(await yp.await_proc('org_over_limit_due'));
    if (!due.length) return;
    console.log(`[OverLimitGraceWorker] ${due.length} org(s) past their grace deadline`);
    let locked = 0;
    for (const row of due) {
      if (await lockOne(row)) locked++;
    }
    console.log(`[OverLimitGraceWorker] done — ${locked}/${due.length} hard-locked`);
  } catch (error) {
    console.error('[OverLimitGraceWorker] job failed:', error);
  }
}

function scheduleNext() {
  setTimeout(async () => {
    try {
      await runGraceJob();
    } finally {
      scheduleNext();
    }
  }, INTERVAL_MS);
}

async function startWorker() {
  await initialize();
  await runGraceJob(); // catch up immediately on boot, then settle into the interval
  scheduleNext();
  process.on('SIGUSR2', async () => {
    console.log('[OverLimitGraceWorker] SIGUSR2 — manual run');
    await runGraceJob();
  });
  console.log('[OverLimitGraceWorker] Worker started. Manual run: kill -USR2', process.pid);
}

async function shutdown() {
  console.log('[OverLimitGraceWorker] Shutting down...');
  try {
    if (yp && yp.connection) await yp.end();
  } catch (error) {
    console.error('[OverLimitGraceWorker] Shutdown error:', error.message);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  console.error('[OverLimitGraceWorker] Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[OverLimitGraceWorker] Unhandled rejection:', reason);
  process.exit(1);
});

startWorker().catch((error) => {
  console.error('[OverLimitGraceWorker] Failed to start worker:', error);
  process.exit(1);
});

console.log('[OverLimitGraceWorker] Worker process started (PID:', process.pid, ')');

module.exports = { runGraceJob };
