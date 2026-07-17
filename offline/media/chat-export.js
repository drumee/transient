#!/usr/bin/env node
/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License").
 * https://www.gnu.org/licenses/agpl-3.0.html
 * =============================================================================
 *
 * chat-export.js
 * Offline job: gather hub chat → build HTML → soffice → PDF → Redis progress.
 *
 * Launched by channel.export (format=pdf) via:
 *   Spawn('offline/media/chat-export.js', [JSON.stringify(args)], SPAWN_OPT)
 *
 * Args (argv[0] JSON):
 *   { uid, hub_id, hub_name, scope_sel, start_date, end_date,
 *     format:'pdf', zipid, zipname, socket_id, lang }
 *
 * Progress events sent via RedisStore.sendData:
 *   { phase:'prepare'|'gather'|'build'|'convert'|'exit', progress:0-100,
 *     zipid, zipname, message, finished? }
 *
 * Pattern: mirrors offline/media/download.js + offline/drumate/backup.js.
 * soffice spawn: matches offline/media/to-pdf.js:200 pattern:
 *   `${Script.soffice} {outdir} {inputfile}` → produces orig.pdf in outdir.
 */

"use strict";

const Minimist = require("minimist");
const { exit } = require("process");
const {
  RedisStore, Mariadb, Constants, sysEnv, Script, Attr, toArray, Offline
} = require("@drumee/server-essentials");
const { resolve: pathResolve, join: pathJoin, basename } = require("path");
const {
  mkdirSync, writeFileSync, existsSync, renameSync
} = require("fs");
const { isEmpty, isString } = require("lodash");
const { spawn } = require("child_process");

const { DOWNLOAD_FOLDER } = Constants;
const { tmp_dir } = sysEnv();
const { buildOdt } = require("./chat-export-odt");

// ─── Lock-file guard (mirrors to-pdf.js pattern) ─────────────────────────────
// Only one soffice conversion at a time per process; track PID to detect stale.
const LOCK_FILE = pathResolve(tmp_dir, "chat-export-soffice.lock");

function acquireLock() {
  if (existsSync(LOCK_FILE)) {
    try {
      const pid = parseInt(
        require("fs").readFileSync(LOCK_FILE, "utf8").trim(),
        10,
      );
      // Check if the pid is still running
      try { process.kill(pid, 0); } catch (_) {
        // Process gone — stale lock, remove it
        require("fs").rmSync(LOCK_FILE, { force: true });
      }
    } catch (_) {}
  }
  if (existsSync(LOCK_FILE)) return false;
  try {
    writeFileSync(LOCK_FILE, String(process.pid), "utf8");
  } catch (_) { return false; }
  return true;
}

function releaseLock() {
  try { require("fs").rmSync(LOCK_FILE, { force: true }); } catch (_) {}
}

// ─── Inline gather helpers ────────────────────────────────────────────────────
// Re-implements the gather logic from channel.js _gatherSections.
// DRY INTENT: the logic is identical; the job can't import service/private/channel.js
// (it's a standalone process), so the logic is duplicated with a shared contract.
// If gather logic changes, update BOTH: service/private/channel.js and this file.

const { parse: jsonParse, stringify } = JSON;
const PAGE_SIZE = 45;

/**
 * Parse attachment JSON into [{name, link}] array.
 * @param {string|object|null} attachment
 * @param {string} hub_id
 * @returns {Array}
 */
function parseAttachments(attachment, hub_id) {
  if (!attachment) return [];
  try {
    const raw = typeof attachment === "string"
      ? jsonParse(attachment) : attachment;
    return toArray(raw).map((a) => {
      if (!a) return null;
      const nid = a.nid || (typeof a === "string" ? a : null);
      if (!nid) return null;
      const h = a.hub_id || hub_id;
      return {
        name: a.filename || nid,
        link: `/-/svc/media.orig?nid=${nid}&hub_id=${h}`,
      };
    }).filter(Boolean);
  } catch (_) {
    return [];
  }
}

/**
 * Normalize a raw channel row into a message object for the HTML builder.
 * @param {object} row
 * @param {string} hub_id
 * @returns {object}
 */
function normalizeRow(row, hub_id) {
  return {
    id: row.message_id,
    author: {
      id: row.author_id,
      name: row.fullname ||
        `${row.firstname || ""} ${row.lastname || ""}`.trim() ||
        row.author_id,
    },
    time: row.ctime,
    text: row.message || "",
    attachments: parseAttachments(row.attachment, hub_id),
    reply_to: row.thread_id || null,
    // reactions intentionally omitted from PDF
  };
}

/**
 * Order channel_export_folder_tree rows depth-first (parent before children,
 * siblings by name — the proc pre-sorts by depth/name) and attach a display
 * `path` string to each row.
 * @param {Array} folders  rows {id, parent_id, depth, name}
 * @returns {Array}
 */
function orderFolderTree(folders) {
  const byParent = new Map();
  for (const f of folders) {
    const key = `${f.parent_id}`;
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(f);
  }
  const root = folders.find((f) => Number(f.depth) === 0);
  const out = [];
  const walk = (node, trail) => {
    const path = trail ? `${trail} / ${node.name}` : `${node.name}`;
    out.push({ ...node, path });
    for (const child of byParent.get(`${node.id}`) || []) walk(child, path);
  };
  if (root) walk(root, "");
  return out;
}

/**
 * Gather all messages (page-by-page) into sections[]: one folder_chat section
 * per folder (tree order), each folder's file threads following it. Root-card
 * "file.thread" rows become type:'event' lines.
 * @param {Mariadb} db     Hub DB connection
 * @param {string}  uid
 * @param {string}  hub_id
 * @param {string|null} root_nid  export subtree root (null = hub root)
 * @param {string|string[]} scope_sel
 * @param {boolean} include_folders  whether to include folder/general chat when
 *   scope_sel is an explicit thread array (folder modal true, file-scope false).
 *   Ignored for 'all'/'hub_chat_only' (always include folders).
 * @param {number|null} date_start
 * @param {number|null} date_end
 * @param {Array}   file_threads  from channel_export_file_thread_list
 * @param {Array}   folder_tree   from channel_export_folder_tree
 * @returns {Promise<Array>}
 */
async function gatherSections(db, uid, hub_id, root_nid, scope_sel, include_folders, date_start, date_end, file_threads, folder_tree) {
  const includeFolders = !Array.isArray(scope_sel) ? true : !!include_folders;

  let selectedFts = [];
  if (scope_sel === "all") {
    selectedFts = file_threads;
  } else if (Array.isArray(scope_sel)) {
    const sel = new Set(scope_sel.map(String));
    selectedFts = file_threads.filter((ft) => sel.has(String(ft.file_thread_id)));
  }

  const folders = orderFolderTree(toArray(folder_tree));
  const rootFolder = folders[0] || null;
  const ftByFileNid = new Map(
    toArray(file_threads).map((ft) => [`${ft.file_nid}`, ft]),
  );

  // General chat grouped by folder (metadata._scope_nid)
  const byFolder = new Map();
  if (includeFolders) {
    let page = 1;
    while (true) {
      const rows = toArray(
        await db.await_proc(
          "channel_export_messages",
          uid,
          root_nid || null,
          date_start || null,
          date_end || null,
          page,
        ),
      );
      if (!rows.length) break;
      for (const row of rows) {
        const msg = normalizeRow(row, hub_id);
        if (row.message_type === "file.thread") {
          let meta = {};
          try {
            meta = typeof row.metadata === "string"
              ? jsonParse(row.metadata) : row.metadata || {};
          } catch (_) {}
          const ft = ftByFileNid.get(`${meta._file_nid}`);
          msg.type = "event";
          msg.text = `Chat thread started for "${(ft && ft.filename) || meta._file_nid || "a file"}"`;
        }
        const key = row.scope_nid || (rootFolder ? `${rootFolder.id}` : "");
        if (!byFolder.has(key)) byFolder.set(key, []);
        byFolder.get(key).push(msg);
      }
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
  }

  const sections = [];
  const pushThreadSection = async (ft, folder) => {
    const messages = [];
    let page = 1;
    while (true) {
      const rows = toArray(
        await db.await_proc(
          "channel_export_file_thread_messages",
          uid,
          `${ft.file_thread_id}`,
          date_start || null,
          date_end || null,
          page,
        ),
      );
      if (!rows.length) break;
      for (const row of rows) messages.push(normalizeRow(row, hub_id));
      if (rows.length < PAGE_SIZE) break;
      page++;
    }
    sections.push({
      type: "file_thread",
      name: ft.filename || ft.file_thread_id,
      file_thread_id: ft.file_thread_id,
      file_nid: ft.file_nid,
      folder_nid: ft.folder_nid || (folder && folder.id) || null,
      folder_name: ft.folder_name || (folder && folder.name) || null,
      messages,
    });
  };

  // Pass 1 — all folder/general chat sections first (tree order).
  if (includeFolders) {
    for (const folder of folders) {
      const messages = byFolder.get(`${folder.id}`) || [];
      if (!messages.length) continue;
      sections.push({
        type: "folder_chat",
        name: folder.name,
        path: folder.path,
        nid: folder.id,
        messages,
      });
    }
  }

  // Pass 2 — file threads after all folder chat, grouped by their folder's
  // tree position.
  const emittedThreads = new Set();
  for (const folder of folders) {
    for (const ft of selectedFts) {
      if (`${ft.folder_nid}` !== `${folder.id}`) continue;
      emittedThreads.add(`${ft.file_thread_id}`);
      await pushThreadSection(ft, folder);
    }
  }
  for (const ft of selectedFts) {
    if (emittedThreads.has(`${ft.file_thread_id}`)) continue;
    await pushThreadSection(ft, null);
  }

  return sections;
}

// ─── Main job class ───────────────────────────────────────────────────────────

class __chat_export_job extends Offline {

  initialize() {
    const argv = Minimist(process.argv.slice(2));
    let data;
    try {
      data = jsonParse(argv._[0]);
    } catch (e) {
      console.error("chat-export: failed to parse args", e && e.message);
      exit(1);
    }

    this.uid        = data.uid;
    this.hub_id     = data.hub_id;
    this.hub_name   = data.hub_name || data.hub_id;
    this.root_nid   = data.root_nid || null;
    this.root_name  = data.root_name || this.hub_name;
    this.scope_sel  = data.scope_sel || "all";
    // Default true so a folder-modal mixed selection still exports folder chat;
    // the file-scope path sends false explicitly.
    this.include_folders = data.include_folders === undefined
      ? true : !!data.include_folders;
    this.date_start = data.start_date || null;
    this.date_end   = data.end_date   || null;
    this.zipid      = data.zipid;
    this.zipname    = data.zipname;
    this.socket_id  = data.socket_id || null;
    this.lang       = data.lang || "en";

    for (const name of ["uid", "hub_id", "zipid", "zipname"]) {
      if (isEmpty(this[name])) {
        console.error(`chat-export: required arg '${name}' is missing`);
        exit(1);
      }
    }

    global.verbosity = 2;

    // YP connection (resolves hub db_name via forward_proc)
    this.yp = new Mariadb({ user: process.env.USER });
    // Payload template for Redis progress (mirroring download.js)
    this._payload = null;
    this.service  = "channel.export";

    const res = new RedisStore();
    res.init().then(() => {
      this._run().catch((e) => {
        console.error("chat-export: fatal error:", e && e.message, e);
        this._send({ phase: "exit", progress: 0, zipid: this.zipid, zipname: this.zipname,
          message: "EXPORT_FAILED", exit: 1, finished: 1 })
          .finally(() => { releaseLock(); this._stop(1); });
      });
    });
  }

  // ── Progress messaging ──────────────────────────────────────────────────────

  async _send(model) {
    if (!this.socket_id) return;
    if (!this._payload) {
      this._payload = {
        model: {},
        options: { service: this.service, tag: this.service, keys: ["zipid"] },
      };
    }
    this._payload.model = { ...this._payload.model, ...model };
    this._payload.options.message = model.message || "";
    try {
      await RedisStore.sendData(this._payload, this.socket_id);
    } catch (e) {
      console.warn("chat-export: Redis send failed:", e && e.message);
    }
  }

  _stop(code = 0) {
    try { if (this.yp) this.yp.end(); } catch (_) {}
    this.clear();
    exit(code);
  }

  // ── Main flow ───────────────────────────────────────────────────────────────

  async _run() {
    await this._send({
      phase: "prepare", progress: 0,
      zipid: this.zipid, zipname: this.zipname, message: "IN_PREPARATION",
    });

    // Resolve hub DB name
    const hub = await this.yp.await_proc("get_hub", this.hub_id);
    if (!hub || !hub.db_name) {
      throw new Error(`chat-export: hub not found for hub_id=${this.hub_id}`);
    }
    // Mariadb reads the target schema from the `name` key (Attr.name); the `db`
    // key is ignored and the connection silently falls back to YELLOW_PAGE (yp),
    // where the channel_export_* procs do not exist. Mirror the working workers
    // (expiryWorker / backfill-posters): pass the hub schema as `name`.
    const db = new Mariadb({ name: hub.db_name, user: process.env.USER });

    const stageDir = pathResolve(tmp_dir, DOWNLOAD_FOLDER, this.uid, this.zipid);
    mkdirSync(stageDir, { recursive: true });

    // ── Gather ────────────────────────────────────────────────────────────────
    await this._send({
      phase: "gather", progress: 10,
      zipid: this.zipid, message: "GATHERING_MESSAGES",
    });

    const file_threads = toArray(
      await db.await_proc("channel_export_file_thread_list", this.uid, this.root_nid),
    );
    const folder_tree = toArray(
      await db.await_proc("channel_export_folder_tree", this.hub_id, this.root_nid),
    );

    const sections = await gatherSections(
      db, this.uid, this.hub_id, this.root_nid,
      this.scope_sel, this.include_folders, this.date_start, this.date_end,
      file_threads, folder_tree,
    );

    // ── Build the Flat ODT document ─────────────────────────────────────────
    await this._send({
      phase: "build", progress: 50,
      zipid: this.zipid, message: "BUILDING_DOCUMENT",
    });

    const Moment = require("moment");
    const exportedAt = Moment(Moment.now() / 1000, "X").format("YYYY-MM-DD HH:mm");
    const dateStart = this.date_start
      ? Moment(this.date_start, "X").format("YYYY-MM-DD") : null;
    const dateEnd = this.date_end
      ? Moment(this.date_end, "X").format("YYYY-MM-DD") : null;

    // FODT (not HTML): soffice imports it through the real Writer filter, so
    // table column widths stay pinned across page breaks and the header row
    // repeats on every page (HTML goes through Writer/Web, which drifts).
    const odt = buildOdt({
      hubName: this.root_name || this.hub_name,
      exportedAt,
      dateStart,
      dateEnd,
      sections,
    });

    const odtPath = pathJoin(stageDir, "export.fodt");
    writeFileSync(odtPath, odt, "utf8");

    // ── soffice convert FODT → export.pdf ──────────────────────────────────────
    await this._send({
      phase: "convert", progress: 60,
      zipid: this.zipid, message: "CONVERTING_TO_PDF",
    });

    // Acquire lock before spawning soffice (to-pdf.js pattern)
    let locked = false;
    const LOCK_WAIT_MS = 500;
    const LOCK_RETRIES = 30;
    for (let i = 0; i < LOCK_RETRIES; i++) {
      if (acquireLock()) { locked = true; break; }
      await new Promise((r) => setTimeout(r, LOCK_WAIT_MS));
    }
    if (!locked) throw new Error("chat-export: could not acquire soffice lock");

    await new Promise((resolve, reject) => {
      // Script.soffice pattern: `${Script.soffice} {outdir} {inputfile}`
      // → produces <basename>.pdf in outdir
      const cmd = `${Script.soffice} ${stageDir} ${odtPath}`;
      const sp = spawn(Script.soffice, [stageDir, odtPath], {
        stdio: ["ignore", "pipe", "pipe"],
      });

      sp.stdout.on("data", (d) => process.stdout.write(d));
      sp.stderr.on("data", (d) => process.stderr.write(d));

      sp.on("exit", async (code) => {
        releaseLock();
        if (code !== 0) {
          reject(new Error(`soffice exited with code ${code} cmd=${cmd}`));
        } else {
          resolve();
        }
      });

      sp.on("error", (e) => { releaseLock(); reject(e); });
    });

    // ── Rename soffice output → final zipname ──────────────────────────────────
    // soffice names the PDF after the INPUT basename: export.fodt → export.pdf.
    const producedPdf = pathJoin(stageDir, "export.pdf");
    if (!existsSync(producedPdf)) {
      throw new Error(`chat-export: soffice did not produce export.pdf in ${stageDir}`);
    }
    const finalPdf = pathJoin(stageDir, this.zipname);
    renameSync(producedPdf, finalPdf);

    // ── Done ──────────────────────────────────────────────────────────────────
    await this._send({
      phase: "exit", progress: 100,
      zipid: this.zipid, zipname: this.zipname,
      message: "DOWNLOADING", finished: 1, exit: 0,
    });

    try { db.end(); } catch (_) {}
    setTimeout(() => this._stop(0), 2000);
  }
}

new __chat_export_job();
