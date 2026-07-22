/**
 * Meeting Reminder Worker
 *
 * Polls the global `yp.meeting_schedule` index (maintained write-through by
 * service/private/room.js book/update/remove) for scheduled meetings whose
 * start time has arrived and pushes a "your meeting is starting" reminder to
 * every attendee + the organizer via the same RedisStore fan-out the in-app
 * invite push uses (room.js _notify_invitees / expiryWorker.sendNotification).
 *
 * Model: mirrors versionRetentionWorker.js — plain setTimeout self-rescheduler
 * (the runtime ships Bull, not `cron`). Runs on a short interval rather than
 * daily because reminders are time-sensitive.
 *
 * Env:
 *   REMINDER_INTERVAL_SEC  poll cadence (default 60)
 *   REMINDER_GRACE_SEC     don't announce meetings that started more than this
 *                          long ago, e.g. after worker downtime (default 3600;
 *                          0 = no floor)
 */

const { Mariadb, RedisStore } = require('@drumee/server-essentials');

const WORKER_NAME = process.env.WORKER_NAME || 'reminder-worker-1';
const INTERVAL_MS = (parseInt(process.env.REMINDER_INTERVAL_SEC, 10) || 60) * 1000;
const GRACE_SEC = Number.isInteger(parseInt(process.env.REMINDER_GRACE_SEC, 10))
  ? parseInt(process.env.REMINDER_GRACE_SEC, 10)
  : 3600;

console.log(`[ReminderWorker] Starting worker: ${WORKER_NAME}`);
console.log(`[ReminderWorker] Poll interval: ${INTERVAL_MS / 1000}s, grace: ${GRACE_SEC}s`);

let yp;
let redisInitialized = false;

function asArray(x) {
  if (Array.isArray(x)) return x;
  return x == null ? [] : [x];
}

function parseJSON(v, fallback) {
  if (v == null) return fallback;
  if (typeof v !== 'string') return v;
  try {
    return JSON.parse(v);
  } catch (e) {
    return fallback;
  }
}

async function initialize() {
  yp = new Mariadb({ name: 'yp' });
  console.log('[ReminderWorker] Database connected');
  await RedisStore.prototype.init.call(new RedisStore());
  redisInitialized = true;
  console.log('[ReminderWorker] RedisStore initialized');
}

/**
 * First occurrence strictly after `now` for a recurring meeting, or null for a
 * one-off / an ended series. Advances past any occurrences missed while the
 * worker was down so we don't fire a burst of back-dated reminders.
 */
function nextOccurrence(stime, etime, recur, now) {
  if (!recur || !recur.freq || recur.freq === 'none') return null;
  const dur = etime > stime ? etime - stime : 0;
  const until = recur.until ? Number(recur.until) : null;
  let next = stime;
  let guard = 0;
  do {
    if (recur.freq === 'daily') next += 86400;
    else if (recur.freq === 'weekly') next += 604800;
    else if (recur.freq === 'monthly') {
      const d = new Date(next * 1000);
      d.setMonth(d.getMonth() + 1);
      next = Math.floor(d.getTime() / 1000);
    } else return null;
    if (until && next > until) return null;
  } while (next <= now && guard++ < 1000);
  return { stime: next, etime: next + dur };
}

async function fireReminder(m, now) {
  const attendees = asArray(parseJSON(m.attendees, []))
    .map((a) => (a && (a.uid || a)))
    .filter(Boolean);
  // The organizer wants a reminder too, not just the invitees.
  const uids = [...new Set([...attendees, m.created_by].filter(Boolean))];

  if (uids.length) {
    const recipients = asArray(await yp.await_proc('user_sockets', uids));
    if (recipients.length && redisInitialized) {
      await RedisStore.sendData(
        {
          service: 'room.reminder',
          type: 'meeting_reminder',
          hub_id: m.hub_id,
          nid: m.nid,
          room_id: m.nid,
          title: m.title,
          stime: Number(m.stime) || 0,
          timestamp: Date.now(),
        },
        recipients,
      );
      console.log(`[ReminderWorker] reminded ${recipients.length} socket(s) for meeting ${m.nid} (hub ${m.hub_id})`);
    }
  }

  // Advance recurring meetings to their next occurrence; flag one-offs fired.
  const recur = parseJSON(m.recur, null);
  const next = nextOccurrence(Number(m.stime) || 0, Number(m.etime) || 0, recur, now);
  await yp.await_proc('meeting_schedule_mark_fired', m.id, next ? next.stime : 0, next ? next.etime : 0);
}

async function runReminderJob() {
  const now = Math.floor(Date.now() / 1000);
  try {
    const due = asArray(await yp.await_proc('meeting_schedule_due', now, GRACE_SEC));
    if (!due.length) return;
    console.log(`[ReminderWorker] ${due.length} meeting(s) due at ${new Date().toISOString()}`);
    for (const m of due) {
      try {
        await fireReminder(m, now);
      } catch (e) {
        console.error(`[ReminderWorker] failed on meeting ${m && m.nid}:`, e.message);
      }
    }
  } catch (error) {
    console.error('[ReminderWorker] Job failed:', error.message);
  }
}

function scheduleNext() {
  setTimeout(async () => {
    try {
      await runReminderJob();
    } finally {
      scheduleNext();
    }
  }, INTERVAL_MS);
}

async function startWorker() {
  console.log('[ReminderWorker] Initializing...');
  await initialize();
  scheduleNext();
  process.on('SIGUSR2', async () => {
    console.log('[ReminderWorker] SIGUSR2 — manual run');
    await runReminderJob();
  });
  console.log('[ReminderWorker] Worker started. Manual run: kill -USR2', process.pid);
}

async function shutdown() {
  console.log('[ReminderWorker] Shutting down...');
  try {
    if (yp && yp.connection) await yp.end();
  } catch (error) {
    console.error('[ReminderWorker] Shutdown error:', error.message);
  }
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
process.on('uncaughtException', (error) => {
  console.error('[ReminderWorker] Uncaught exception:', error);
  process.exit(1);
});
process.on('unhandledRejection', (reason) => {
  console.error('[ReminderWorker] Unhandled rejection:', reason);
  process.exit(1);
});

startWorker().catch((error) => {
  console.error('[ReminderWorker] Failed to start worker:', error);
  process.exit(1);
});

console.log('[ReminderWorker] Worker process started (PID:', process.pid, ')');

module.exports = { runReminderJob };
