/**
 * LAUNCH30 Promo Expiry Worker
 *
 * Reverts a claimed LAUNCH30 trial (yp.quota source='promo-launch30') once
 * its 30 days pass. Mirrors the exact fall-back an org's Stripe cancellation
 * already produces: payment_clear_entitlement DELETEs the org-keyed quota
 * row, so every member falls to their own per-user free tier (tier-4) rather
 * than a locked-out ('free','org') row. reward_grant_storage re-materialising
 * inside that same proc does not fire here — the claimant has no
 * yp.reward_claim completion — so the net effect for a LAUNCH30 org is
 * exactly "back to Free".
 *
 * Model: mirrors reminderWorker.js — plain setTimeout self-rescheduler (the
 * runtime ships Bull, not `cron`), short interval since trials expire at an
 * arbitrary time of day, not at midnight.
 *
 * Env:
 *   PROMO_EXPIRY_INTERVAL_SEC  poll cadence (default 900 = 15 min)
 */

const { Mariadb } = require('@drumee/server-essentials');

const WORKER_NAME = process.env.WORKER_NAME || 'promo-expiry-worker-1';
const INTERVAL_MS = (parseInt(process.env.PROMO_EXPIRY_INTERVAL_SEC, 10) || 900) * 1000;

console.log(`[PromoExpiryWorker] Starting worker: ${WORKER_NAME}`);
console.log(`[PromoExpiryWorker] Poll interval: ${INTERVAL_MS / 1000}s`);

let yp;

function asArray(x) {
  if (Array.isArray(x)) return x;
  return x == null ? [] : [x];
}

async function initialize() {
  yp = new Mariadb({ name: 'yp' });
  console.log('[PromoExpiryWorker] Database connected');
}

async function expireOne(row) {
  const { payer_id, org_id } = row;
  try {
    // Same revert path an org's Stripe cancel takes — see the module doc.
    await yp.await_proc('payment_clear_entitlement', org_id);
    await yp.await_proc('promo_launch30_mark_expired', payer_id);
    console.log(`[PromoExpiryWorker] expired promo for payer=${payer_id} org=${org_id}`);
    return true;
  } catch (error) {
    console.error(`[PromoExpiryWorker] failed to expire payer=${payer_id} org=${org_id}:`, error.message);
    return false;
  }
}

async function runExpiryJob() {
  try {
    const due = asArray(await yp.await_proc('promo_launch30_due'));
    if (!due.length) return;
    console.log(`[PromoExpiryWorker] ${due.length} trial(s) due for expiry`);
    let expired = 0;
    for (const row of due) {
      if (await expireOne(row)) expired++;
    }
    console.log(`[PromoExpiryWorker] done — ${expired}/${due.length} expired`);
  } catch (error) {
    console.error('[PromoExpiryWorker] Job failed:', error);
  }
}

function scheduleNext() {
  setTimeout(async () => {
    try {
      await runExpiryJob();
    } finally {
      scheduleNext();
    }
  }, INTERVAL_MS);
}

async function startWorker() {
  await initialize();
  await runExpiryJob(); // catch up immediately on boot, then settle into the interval
  scheduleNext();
  process.on('SIGUSR2', async () => {
    console.log('[PromoExpiryWorker] SIGUSR2 — manual run');
    await runExpiryJob();
  });
  console.log('[PromoExpiryWorker] Worker started. Manual run: kill -USR2', process.pid);
}

async function shutdown() {
  console.log('[PromoExpiryWorker] Shutting down...');
  try {
    if (yp && yp.connection) await yp.end();
  } catch (error) {
    console.error('[PromoExpiryWorker] Shutdown error:', error.message);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  console.error('[PromoExpiryWorker] Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[PromoExpiryWorker] Unhandled rejection:', reason);
  process.exit(1);
});

startWorker().catch((error) => {
  console.error('[PromoExpiryWorker] Failed to start worker:', error);
  process.exit(1);
});

console.log('[PromoExpiryWorker] Worker process started (PID:', process.pid, ')');

module.exports = { runExpiryJob };
