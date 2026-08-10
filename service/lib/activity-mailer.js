/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3.
 * https://www.gnu.org/licenses/agpl-3.0.html
 */

// Emails workspace members about activity they would otherwise miss.
//
// The in-app Notifications panel only reaches users with an open session
// (WS fan-out targets live sockets). This module is the email leg for
// everyone else. Two entry points:
//
//   notifyHubActivity(ctx, {event, src, dest})
//     hub-wide fan-out, hooked at changelog_write — the funnel every MFS
//     event (media.new / replace / remove / rename / move / copy / ...)
//     goes through. Recipients = hub members.
//
//   notifyTaskEvent(ctx, {uids, title, taskId, kind})
//     targeted notification, hooked at task._notifyAssignees /
//     _notifyMentions. Recipients = the assigned/mentioned users only.
//
// A recipient gets a mail only when ALL of these hold:
//   1. they are not the actor;
//   2. they have no active socket (online users already saw the WS push);
//   3. the Redis dedup key is free — ACTIVITY_MAIL_COOLDOWN_SEC (default
//      1 s) only collapses simultaneous double-fires of the same event
//      (claimed with SET NX EX *before* sending so concurrent events
//      can't double-send);
//   4. shouldSendNotification passes (the Settings "Email notifications"
//      toggle — opt-out, matching every other notification mail).
//
// Links are environment-dynamic: base URL comes from sysEnv()
// (main_domain + endpoint_path — drumee.in/-/liam on a stage endpoint,
// app.drumee.com/- on prod) and deep-links open the workspace window via
// the desk router's wm/open route.
//
// Failures are logged and swallowed: a mail problem must never fail or
// slow the operation that triggered it. Callers do NOT await this.

const { resolve } = require("path");
const { isEmpty } = require("lodash");
const { Messenger, RedisStore, sysEnv, Attr, toArray } = require("@drumee/server-essentials");
const { shouldSendNotification } = require("./email-policy");
const { butlerFrom } = require("./mail-sender");

// Dedup window, NOT a throttle: every offline-recipient event mails; the
// 1 s claim only stops the same event double-sending under concurrency.
const COOLDOWN_SEC = parseInt(process.env.ACTIVITY_MAIL_COOLDOWN_SEC, 10) || 1;
const TPL = resolve(__dirname, "..", "private", "templates", "butler", "hub-activity.html");

// hub_get_members_by_type pages by 45 (pageToLimits); cap the walk so a
// pathological membership can't hold the mail loop.
const MAX_MEMBER_PAGES = 10;

// yp.entity.area -> desk window kind (mirrors the UI's
// window/configs/application.js mapping for filetype hub).
const AREA_KIND = {
  private: "window_team",
  share: "window_sharebox",
  dmz: "window_sharebox",
  public: "window_website",
};

function _endpointBase() {
  const { main_domain, endpoint_path } = sysEnv();
  return `https://${main_domain}${endpoint_path || "/-"}`;
}

/**
 * Display name of the workspace. The granted-hub model's `name` is not
 * reliably populated and `hubname` can be the raw hub id — never show that
 * to a human. yp.hub.name is what the UI renders.
 */
async function _hubDisplayName(ctx, hubId) {
  let name = (ctx.hub && ctx.hub.get && ctx.hub.get(Attr.name)) || "";
  if (!name || name === hubId) {
    try {
      const rows = toArray(await ctx.yp.await_query("SELECT name FROM hub WHERE id=?", hubId));
      if (rows[0] && rows[0].name) name = rows[0].name;
    } catch (_) {}
  }
  if (!name || name === hubId) name = "your workspace";
  return name;
}

/**
 * Deep link that opens the workspace window on the recipient's desk.
 * Falls back to the plain desk when the entity row can't be read.
 */
async function _hubLink(ctx, hubId) {
  const base = _endpointBase();
  try {
    const rows = toArray(
      await ctx.yp.await_query("SELECT home_id, area FROM entity WHERE id=?", hubId)
    );
    const r = rows[0];
    if (r && r.home_id) {
      const kind = AREA_KIND[r.area] || "window_team";
      return `${base}/#/desk/wm/open/nid=${r.home_id}&hub_id=${hubId}&kind=${kind}&filetype=hub`;
    }
  } catch (_) {}
  return `${base}/#/desk`;
}

function _actorName(ctx) {
  return (
    (ctx.user && (ctx.user.get(Attr.fullname) || ctx.user.get(Attr.username))) || "Someone"
  );
}

/**
 * Claim the burst-guard key and send one mail. Returns silently on any
 * skip condition. `recipient` needs {email, fullname}.
 */
async function _sendOne(ctx, redis, opt) {
  const { recipient, claimKey, subject, action, filename, hubName, link } = opt;
  const claimed = await redis.set(claimKey, "1", { NX: true, EX: COOLDOWN_SEC });
  if (claimed !== "OK") return;
  if (!(await shouldSendNotification(ctx.yp, recipient.email))) return;

  const msg = new Messenger({
    subject,
    recipient: recipient.email,
    handler: ctx.exception && ctx.exception.email,
  });
  const html = msg.renderFrom(TPL, {
    recipient: recipient.fullname || recipient.email.replace(/@.+$/, ""),
    sender: _actorName(ctx),
    hub_name: hubName,
    action,
    filename,
    link,
  });
  await msg.send({ html, from: butlerFrom() });
}

function _redis() {
  // No Redis -> no burst guard -> don't send at all. Silence beats a mail
  // storm the first busy morning the claim key can't be taken.
  try {
    return RedisStore.getClient() || null;
  } catch (_) {
    return null;
  }
}

/**
 * Hub-wide members (owner included — permission&32 rows) with their email,
 * fullname and `online` flag, minus the actor. The proc only exists on hub
 * databases; on a personal (drumate) database the call throws and we treat
 * the hub as having no one to notify.
 */
async function _recipients(ctx, actorId) {
  const seen = new Set();
  const out = [];
  for (let page = 1; page <= MAX_MEMBER_PAGES; page++) {
    let rows;
    try {
      rows = await ctx.db.await_proc("hub_get_members_by_type", actorId, "all", page);
    } catch (_) {
      return out;
    }
    rows = rows ? [].concat(rows) : [];
    if (isEmpty(rows)) break;
    for (const r of rows) {
      if (!r || !r.id || !r.email || r.id === actorId || seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(r);
    }
    if (rows.length < 45) break;
  }
  return out;
}

// Event names as recorded in yp.mfs_changelog: media.new / replace / remove /
// rename / move / relocate / workspace_move / copy.

/**
 * Specific, human-readable action: WHO did WHAT to WHICH item in WHICH
 * workspace. `action` reads as `<actor> <action> "<hub name>"` — it always
 * ends with the preposition that introduces the workspace name.
 */
function _describe(event, src, dest) {
  const nameOf = (o) => (o && (o.filename || o.name) ? String(o.filename || o.name) : "");
  const kind = src && src.filetype === "folder" ? "folder" : "file";
  const item = nameOf(src);
  const newName = nameOf(dest);
  switch (event) {
    case "media.new":
      return {
        action: item ? `added the ${kind} “${item}” to` : "added new content to",
        filename: item,
      };
    case "media.replace":
      return {
        action: item ? `updated the ${kind} “${item}” in` : "updated a file in",
        filename: item,
      };
    case "media.remove":
      return {
        action: item ? `removed the ${kind} “${item}” from` : "removed content from",
        filename: item,
      };
    case "media.rename":
      if (item && newName && item !== newName) {
        return { action: `renamed “${item}” to “${newName}” in`, filename: newName };
      }
      return {
        action: item || newName ? `renamed “${item || newName}” in` : "renamed an item in",
        filename: newName || item,
      };
    case "media.move":
    case "media.relocate":
    case "media.workspace_move":
      return {
        action: item ? `moved the ${kind} “${item}” in` : "moved content in",
        filename: item,
      };
    case "media.copy":
      return {
        action: item ? `copied the ${kind} “${item}” in` : "copied content in",
        filename: item,
      };
    default:
      return { action: "made changes in", filename: item };
  }
}

/**
 * Fire-and-forget entry point — call WITHOUT await from the request path.
 *
 * @param {object} ctx   the running Media service instance (db/yp/user/hub/input)
 * @param {object} opt   { event, src, dest } as passed to changelog_write
 */
async function notifyHubActivity(ctx, opt = {}) {
  const hub = ctx.hub;
  if (!hub || !hub.get) return;
  const hubId = hub.get(Attr.id);
  if (isEmpty(hubId) || isEmpty(ctx.uid)) return;
  const redis = _redis();
  if (!redis) return;

  const recipients = await _recipients(ctx, ctx.uid);
  if (isEmpty(recipients)) return;

  const hubName = await _hubDisplayName(ctx, hubId);
  const link = await _hubLink(ctx, hubId);
  const { action, filename } = _describe(opt.event, opt.src, opt.dest);
  const subject = `${_actorName(ctx)} ${action} “${hubName}” on Drumee`;

  for (const r of recipients) {
    try {
      if (parseInt(r.online)) continue;
      await _sendOne(ctx, redis, {
        recipient: { email: r.email, fullname: r.fullname },
        claimKey: `activity-mail:${hubId}:${r.id}`,
        subject,
        action,
        filename,
        hubName,
        link,
      });
    } catch (e) {
      if (ctx.warn) ctx.warn("activity-mailer: send failed:", e && e.message);
    }
  }
}

const TASK_ACTION = {
  assigned: (title) => (title ? `assigned you the task “${title}” in` : "assigned you a task in"),
  mention: (title) =>
    title ? `mentioned you in the task “${title}” in` : "mentioned you in a task in",
  reply: (title) =>
    title
      ? `replied to your comment on the task “${title}” in`
      : "replied to your comment on a task in",
};

/**
 * Targeted email for task events — assignees / mentions / comment replies.
 * Fire-and-forget, same rules as notifyHubActivity but per explicit uid
 * list and with a per-task burst-guard key.
 *
 * @param {object} ctx  the running task service instance
 * @param {object} opt  { uids, title, taskId, kind: 'assigned'|'mention'|'reply' }
 */
async function notifyTaskEvent(ctx, opt = {}) {
  const uids = toArray(opt.uids).filter((u) => u && u !== ctx.uid);
  if (isEmpty(uids)) return;
  const hub = ctx.hub;
  const hubId = hub && hub.get && hub.get(Attr.id);
  if (isEmpty(hubId)) return;
  const redis = _redis();
  if (!redis) return;

  // One round-trip: uids that own an active socket are online.
  const online = new Set(
    toArray(await ctx.yp.await_proc("user_sockets", uids)).map((s) => s && s.uid)
  );

  const kind = TASK_ACTION[opt.kind] ? opt.kind : "assigned";
  const action = TASK_ACTION[kind](opt.title ? String(opt.title) : "");
  const hubName = await _hubDisplayName(ctx, hubId);
  const link = await _hubLink(ctx, hubId);
  const subject = `${_actorName(ctx)} ${action} “${hubName}” on Drumee`;

  for (const uid of uids) {
    try {
      if (online.has(uid)) continue;
      const rows = toArray(
        await ctx.yp.await_query("SELECT email, fullname FROM drumate WHERE id=?", uid)
      );
      const r = rows[0];
      if (!r || !r.email) continue;
      await _sendOne(ctx, redis, {
        recipient: { email: r.email, fullname: r.fullname },
        claimKey: `activity-mail:task:${opt.taskId || hubId}:${kind}:${uid}`,
        subject,
        action,
        filename: opt.title ? String(opt.title) : "",
        hubName,
        link,
      });
    } catch (e) {
      if (ctx.warn) ctx.warn("activity-mailer: task send failed:", e && e.message);
    }
  }
}

module.exports = { notifyHubActivity, notifyTaskEvent };
