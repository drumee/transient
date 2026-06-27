/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License").
 * https://www.gnu.org/licenses/agpl-3.0.html
 * =============================================================================
 *
 * chat-export-html.js
 * Build an HTML document from export sections[] for LibreOffice → PDF conversion.
 *
 * Layout: TABLE-BASED only (LibreOffice soffice accepts ~HTML4/CSS2.1).
 * No flex, no grid, no modern CSS.
 *
 * Sections received: [{ type, name, messages:[{ id, author:{id,name}, time,
 *   text, attachments:[{name,link}], reply_to, reactions }] }]
 *
 * PDF output intentionally OMITS reactions/seen and keeps reply-threading
 * (reply_to is shown as an indented quote row).
 */

"use strict";

/**
 * HTML-escape a string.
 * @param {string} s
 * @returns {string}
 */
function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Format a Unix epoch timestamp (seconds) to a readable local string.
 * Uses simple date math so the job has no heavy dependencies.
 * @param {number} epoch
 * @returns {string}
 */
function formatTime(epoch) {
  if (!epoch) return "";
  try {
    const d = new Date(epoch * 1000);
    const pad = (n) => String(n).padStart(2, "0");
    return (
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
      `${pad(d.getHours())}:${pad(d.getMinutes())}`
    );
  } catch (_) {
    return String(epoch);
  }
}

/**
 * Render one message as one or two <tr> rows.
 * If reply_to is set, a grey indent row is added before the main row.
 * Reactions are dropped (PDF output).
 *
 * @param {object} msg  Normalized message object
 * @returns {string}    HTML string (one or two <tr> elements)
 */
function renderMessageRows(msg) {
  const rows = [];

  // Reply-threading: show a subtle quote row above the message
  if (msg.reply_to) {
    rows.push(
      `<tr>` +
        `<td colspan="3" style="padding:2px 24px;background:#f5f5f5;color:#666;` +
          `font-size:10px;border-bottom:none;">` +
          `&#8617; Reply to: ${esc(msg.reply_to)}` +
        `</td>` +
      `</tr>`,
    );
  }

  // Attachment lines: plain text links
  let attachmentHtml = "";
  if (msg.attachments && msg.attachments.length) {
    const links = msg.attachments.map(
      (a) =>
        `<a href="${esc(a.link)}" style="color:#1a5276;">${esc(a.name || a.link)}</a>`,
    );
    attachmentHtml =
      `<br><span style="font-size:10px;color:#555;">Attachments: ` +
      links.join(", ") +
      `</span>`;
  }

  const authorName = esc(
    (msg.author && msg.author.name) ? msg.author.name : (msg.author && msg.author.id) || ""
  );
  const timeStr = esc(formatTime(msg.time));
  const textHtml = esc(msg.text || "").replace(/\n/g, "<br>");

  rows.push(
    `<tr>` +
      `<td style="white-space:nowrap;vertical-align:top;padding:4px 6px;` +
        `color:#555;font-size:10px;border-bottom:1px solid #e8e8e8;width:120px;">${timeStr}</td>` +
      `<td style="vertical-align:top;padding:4px 6px;font-weight:bold;` +
        `white-space:nowrap;border-bottom:1px solid #e8e8e8;width:140px;">${authorName}</td>` +
      `<td style="vertical-align:top;padding:4px 6px;` +
        `border-bottom:1px solid #e8e8e8;">${textHtml}${attachmentHtml}</td>` +
    `</tr>`,
  );

  return rows.join("\n");
}

/**
 * Render one section as an <h2> heading + message table.
 * @param {object} section  { type, name, messages[] }
 * @returns {string}
 */
function renderSection(section) {
  const title = esc(section.name || section.type || "");
  const msgs = section.messages || [];

  const tableRows = msgs.length
    ? msgs.map(renderMessageRows).join("\n")
    : `<tr><td colspan="3" style="color:#999;padding:8px;">(No messages)</td></tr>`;

  return (
    `<h2 style="font-family:Arial,sans-serif;font-size:13pt;color:#1a3c5e;` +
      `border-bottom:2px solid #1a3c5e;padding-bottom:4px;margin-top:24px;">${title}</h2>\n` +
    `<table border="0" cellspacing="0" cellpadding="0" width="100%" ` +
      `style="border-collapse:collapse;font-family:Arial,sans-serif;font-size:11px;">\n` +
    `  <thead>\n` +
    `    <tr style="background:#e8eaf0;">\n` +
    `      <th align="left" style="padding:4px 6px;font-size:10px;width:120px;">Time</th>\n` +
    `      <th align="left" style="padding:4px 6px;font-size:10px;width:140px;">Author</th>\n` +
    `      <th align="left" style="padding:4px 6px;font-size:10px;">Message</th>\n` +
    `    </tr>\n` +
    `  </thead>\n` +
    `  <tbody>\n` +
    tableRows + "\n" +
    `  </tbody>\n` +
    `</table>\n`
  );
}

/**
 * Build the full HTML document from export sections.
 *
 * @param {object} opts
 * @param {string}   opts.hubName      Hub / folder display name
 * @param {string}   opts.exportedAt   Human-readable export date string
 * @param {string|null} opts.dateStart Optional date range start (display string)
 * @param {string|null} opts.dateEnd   Optional date range end (display string)
 * @param {Array}    opts.sections     Sections from _gatherSections()
 * @returns {string}  Complete HTML document string
 */
function buildHtml({ hubName, exportedAt, dateStart, dateEnd, sections }) {
  const safeName = esc(hubName || "Drumee");
  const dateRange = (dateStart || dateEnd)
    ? ` &mdash; ${esc(dateStart || "")} to ${esc(dateEnd || "")}`
    : "";

  const body = (sections || []).map(renderSection).join("\n");
  const totalMessages = (sections || []).reduce(
    (sum, s) => sum + (s.messages ? s.messages.length : 0), 0
  );

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Chat Export &mdash; ${safeName}</title>
</head>
<body style="font-family:Arial,sans-serif;font-size:11px;color:#222;margin:20px;">

<h1 style="font-family:Arial,sans-serif;font-size:16pt;color:#1a3c5e;margin-bottom:4px;">
  Chat History &mdash; ${safeName}
</h1>
<p style="font-size:10px;color:#666;margin:0 0 16px 0;">
  Exported on: ${esc(exportedAt)}${dateRange}<br>
  Total messages: ${totalMessages}
</p>

${body}

</body>
</html>
`;
}

module.exports = { buildHtml };
