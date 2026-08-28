/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License").
 * https://www.gnu.org/licenses/agpl-3.0.html
 * =============================================================================
 *
 * chat-export-odt.js
 * Build a Flat ODT (.fodt) document from export sections[] for LibreOffice →
 * PDF conversion.
 *
 * Why FODT instead of HTML: soffice imports HTML through the "Writer/Web"
 * filter, which has no page concept and re-derives table column widths per
 * page fragment — so an HTML table's columns drift on page 2+. A native ODT
 * goes through the real "Writer" filter (page layout), where a table column's
 * style:column-width is an absolute constraint held across every page break,
 * and <table:table-header-rows> repeats the header on each page. Verified: the
 * message column starts at the same x on every page (≤1px spread).
 *
 * Each section is its own <table:table> so its header repeats when it spans
 * pages. Columns are 2.5cm / 2.5cm / 11cm (≈1:1:3, Time / Author / Message).
 *
 * Sections received: [{ type, name, path?, folder_name?, messages:[{ id,
 *   author:{id,name}, time, text, attachments:[{name,link}], reply_to }] }]
 *
 * Reactions/seen are omitted; reply-threading is kept as an indented quote row.
 */

"use strict";

/**
 * Escape a string for XML text/attribute content.
 * @param {string} s
 * @returns {string}
 */
function escXml(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Escape a string and turn newlines into ODT line breaks (for cell text).
 * @param {string} s
 * @returns {string}
 */
function escXmlMultiline(s) {
  return escXml(s).replace(/\n/g, "<text:line-break/>");
}

/**
 * Format a Unix epoch timestamp (seconds) to a readable local string.
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
 * Flatten mention markup to plain text: "[@label](mention:hub:nid)" → "@label".
 * @param {string} text
 * @returns {string}
 */
function flattenMentions(text) {
  return String(text || "").replace(
    /\[(@[^\]]+)\]\(mention:[^)]+\)/g,
    "$1",
  );
}

// ─── Style + document scaffolding ─────────────────────────────────────────────
// All colours/weights are named styles (ODT has no inline CSS). Column widths
// are absolute cm so soffice pins them across page breaks.

const STYLES = `
  <style:style style:name="Ptitle" style:family="paragraph">
    <style:paragraph-properties fo:margin-bottom="0.1cm"/>
    <style:text-properties fo:font-size="16pt" fo:font-weight="bold" fo:color="#1a3c5e"/>
  </style:style>
  <style:style style:name="Pmeta" style:family="paragraph">
    <style:paragraph-properties fo:margin-bottom="0.4cm"/>
    <style:text-properties fo:font-size="8pt" fo:color="#666666"/>
  </style:style>
  <style:style style:name="Phead" style:family="paragraph">
    <style:paragraph-properties fo:margin-top="0.5cm" fo:margin-bottom="0.15cm"
      fo:padding-bottom="0.08cm" fo:border-bottom="0.05cm solid #1a3c5e"/>
    <style:text-properties fo:font-size="12pt" fo:font-weight="bold" fo:color="#1a3c5e"/>
  </style:style>
  <style:style style:name="Pcolhead" style:family="paragraph">
    <style:text-properties fo:font-size="8pt" fo:font-weight="bold" fo:color="#333333"/>
  </style:style>
  <style:style style:name="Ptime" style:family="paragraph">
    <style:text-properties fo:font-size="8pt" fo:color="#555555"/>
  </style:style>
  <style:style style:name="Pauthor" style:family="paragraph">
    <style:text-properties fo:font-size="9pt" fo:font-weight="bold"/>
  </style:style>
  <style:style style:name="Pmsg" style:family="paragraph">
    <style:text-properties fo:font-size="9pt" fo:color="#222222"/>
  </style:style>
  <style:style style:name="Pevent" style:family="paragraph">
    <style:text-properties fo:font-size="8pt" fo:font-style="italic" fo:color="#888888"/>
  </style:style>
  <style:style style:name="Preply" style:family="paragraph">
    <style:text-properties fo:font-size="8pt" fo:color="#666666"/>
  </style:style>
  <style:style style:name="Pattach" style:family="paragraph">
    <style:paragraph-properties fo:margin-top="0.05cm"/>
    <style:text-properties fo:font-size="7.5pt" fo:color="#555555"/>
  </style:style>
  <style:style style:name="Pempty" style:family="paragraph">
    <style:text-properties fo:font-size="9pt" fo:font-style="italic" fo:color="#999999"/>
  </style:style>
  <style:style style:name="Alink" style:family="text">
    <style:text-properties fo:color="#1a5276" style:text-underline-style="solid"
      style:text-underline-width="auto" style:text-underline-color="font-color"/>
  </style:style>

  <style:style style:name="Col1" style:family="table-column">
    <style:table-column-properties style:column-width="2.5cm"/></style:style>
  <style:style style:name="Col2" style:family="table-column">
    <style:table-column-properties style:column-width="2.5cm"/></style:style>
  <style:style style:name="Col3" style:family="table-column">
    <style:table-column-properties style:column-width="11cm"/></style:style>

  <style:style style:name="Tbl" style:family="table">
    <style:table-properties style:width="16cm" fo:margin-top="0.15cm" table:align="left"/></style:style>
  <style:style style:name="Cell" style:family="table-cell">
    <style:table-cell-properties fo:padding-top="0.09cm" fo:padding-bottom="0.09cm"
      fo:padding-left="0.18cm" fo:padding-right="0.18cm"
      fo:border-bottom="0.018cm solid #e8e8e8" style:vertical-align="top"/></style:style>
  <style:style style:name="CellHead" style:family="table-cell">
    <style:table-cell-properties fo:padding-top="0.09cm" fo:padding-bottom="0.09cm"
      fo:padding-left="0.18cm" fo:padding-right="0.18cm"
      fo:background-color="#e8eaf0" style:vertical-align="top"/></style:style>
  <style:style style:name="CellReply" style:family="table-cell">
    <style:table-cell-properties fo:padding-top="0.06cm" fo:padding-bottom="0.06cm"
      fo:padding-left="0.5cm" fo:padding-right="0.18cm"
      fo:background-color="#f5f5f5" style:vertical-align="top"/></style:style>
`;

/**
 * Render one message as one or two <table:table-row> elements.
 * Event messages → an italic row (time cell + text spanning the last 2 cols).
 * Reply-threading → a grey quote row spanning all 3 cols before the main row.
 * @param {object} msg   Normalized message object
 * @param {Map}    byId  message_id → msg, for reply_to resolution
 * @returns {string}
 */
function renderMessageRows(msg, byId) {
  if (msg.type === "event") {
    return (
      `<table:table-row>` +
        `<table:table-cell table:style-name="Cell">` +
          `<text:p text:style-name="Ptime">${escXml(formatTime(msg.time))}</text:p>` +
        `</table:table-cell>` +
        `<table:table-cell table:style-name="Cell" table:number-columns-spanned="2">` +
          `<text:p text:style-name="Pevent">&#8212; ${escXml(flattenMentions(msg.text))} &#8212;</text:p>` +
        `</table:table-cell>` +
        `<table:covered-table-cell/>` +
      `</table:table-row>`
    );
  }

  const rows = [];

  // Reply-threading: quote the original author + a short snippet when the
  // replied-to message is part of this export.
  if (msg.reply_to) {
    const orig = byId && byId.get(`${msg.reply_to}`);
    let quote;
    if (orig) {
      const flat = flattenMentions(orig.text || "");
      const oa = (orig.author && orig.author.name) || "";
      quote = `Reply to ${oa}: ${flat.slice(0, 60)}${flat.length > 60 ? "…" : ""}`;
    } else {
      quote = "Reply to a message outside this export";
    }
    rows.push(
      `<table:table-row>` +
        `<table:table-cell table:style-name="CellReply" table:number-columns-spanned="3">` +
          `<text:p text:style-name="Preply">&#8617; ${escXml(quote)}</text:p>` +
        `</table:table-cell>` +
        `<table:covered-table-cell/>` +
        `<table:covered-table-cell/>` +
      `</table:table-row>`,
    );
  }

  const authorName = (msg.author && msg.author.name)
    ? msg.author.name
    : (msg.author && msg.author.id) || "";
  const textHtml = escXmlMultiline(flattenMentions(msg.text));

  // Attachment paragraph under the message body.
  let attachPara = "";
  if (msg.attachments && msg.attachments.length) {
    const links = msg.attachments.map(
      (a) =>
        `<text:a xlink:type="simple" xlink:href="${escXml(a.link)}" ` +
        `text:style-name="Alink">${escXml(a.name || a.link)}</text:a>`,
    );
    attachPara =
      `<text:p text:style-name="Pattach">Attachments: ${links.join(", ")}</text:p>`;
  }

  rows.push(
    `<table:table-row>` +
      `<table:table-cell table:style-name="Cell">` +
        `<text:p text:style-name="Ptime">${escXml(formatTime(msg.time))}</text:p>` +
      `</table:table-cell>` +
      `<table:table-cell table:style-name="Cell">` +
        `<text:p text:style-name="Pauthor">${escXml(authorName)}</text:p>` +
      `</table:table-cell>` +
      `<table:table-cell table:style-name="Cell">` +
        `<text:p text:style-name="Pmsg">${textHtml}</text:p>${attachPara}` +
      `</table:table-cell>` +
    `</table:table-row>`,
  );

  return rows.join("");
}

/**
 * Render one section: a heading paragraph + its own table (header row set to
 * repeat across pages).
 * @param {object} section  { type, name, path?, folder_name?, messages[] }
 * @param {Map}    byId
 * @returns {string}
 */
function renderSection(section, byId) {
  let title;
  if (section.type === "file_thread") {
    const loc = section.folder_name ? `${section.folder_name} / ` : "";
    title = `File thread: ${loc + (section.name || "")}`;
  } else {
    title = section.path || section.name || section.type || "";
  }
  const msgs = section.messages || [];

  const headerRow =
    `<table:table-header-rows>` +
      `<table:table-row>` +
        `<table:table-cell table:style-name="CellHead"><text:p text:style-name="Pcolhead">Time</text:p></table:table-cell>` +
        `<table:table-cell table:style-name="CellHead"><text:p text:style-name="Pcolhead">Author</text:p></table:table-cell>` +
        `<table:table-cell table:style-name="CellHead"><text:p text:style-name="Pcolhead">Message</text:p></table:table-cell>` +
      `</table:table-row>` +
    `</table:table-header-rows>`;

  const dataRows = msgs.length
    ? msgs.map((m) => renderMessageRows(m, byId)).join("")
    : `<table:table-row>` +
        `<table:table-cell table:style-name="Cell" table:number-columns-spanned="3">` +
          `<text:p text:style-name="Pempty">(No messages)</text:p>` +
        `</table:table-cell><table:covered-table-cell/><table:covered-table-cell/>` +
      `</table:table-row>`;

  return (
    `<text:p text:style-name="Phead">${escXml(title)}</text:p>` +
    `<table:table table:style-name="Tbl">` +
      `<table:table-column table:style-name="Col1"/>` +
      `<table:table-column table:style-name="Col2"/>` +
      `<table:table-column table:style-name="Col3"/>` +
      headerRow +
      dataRows +
    `</table:table>`
  );
}

/**
 * Build the full Flat ODT document from export sections.
 *
 * @param {object} opts
 * @param {string}   opts.hubName      Hub / folder display name
 * @param {string}   opts.exportedAt   Human-readable export date string
 * @param {string|null} opts.dateStart Optional date range start (display string)
 * @param {string|null} opts.dateEnd   Optional date range end (display string)
 * @param {Array}    opts.sections     Sections from _gatherSections()
 * @returns {string}  Complete .fodt document string
 */
function buildOdt({ hubName, exportedAt, dateStart, dateEnd, sections }) {
  const safeName = escXml(hubName || "Drumee");
  const dateRange = (dateStart || dateEnd)
    ? ` — ${escXml(dateStart || "")} to ${escXml(dateEnd || "")}`
    : "";

  // Global reply_to lookup — replies in a file thread quote the general-chat
  // message they were started from, which lives in a different section.
  const byId = new Map();
  for (const s of sections || []) {
    for (const m of s.messages || []) byId.set(`${m.id}`, m);
  }

  const body = (sections || []).map((s) => renderSection(s, byId)).join("");
  const totalMessages = (sections || []).reduce(
    (sum, s) => sum + (s.messages ? s.messages.length : 0), 0
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:table="urn:oasis:names:tc:opendocument:xmlns:table:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:xlink="http://www.w3.org/1999/xlink"
  office:version="1.3"
  office:mimetype="application/vnd.oasis.opendocument.text">
 <office:styles>
  <style:default-style style:family="paragraph">
   <style:text-properties fo:font-family="Liberation Sans" style:font-name-complex="Liberation Sans"/>
  </style:default-style>
 </office:styles>
 <office:automatic-styles>
  <style:page-layout style:name="pm1">
   <style:page-layout-properties fo:page-width="21cm" fo:page-height="29.7cm"
     fo:margin-top="1.5cm" fo:margin-bottom="1.5cm"
     fo:margin-left="1.5cm" fo:margin-right="1.5cm"/>
  </style:page-layout>
${STYLES}
 </office:automatic-styles>
 <office:master-styles>
  <style:master-page style:name="Standard" style:page-layout-name="pm1"/>
 </office:master-styles>
 <office:body>
  <office:text>
   <text:p text:style-name="Ptitle">Chat History — ${safeName}</text:p>
   <text:p text:style-name="Pmeta">Exported on: ${escXml(exportedAt)}${dateRange}<text:line-break/>Total messages: ${totalMessages}</text:p>
   ${body}
  </office:text>
 </office:body>
</office:document>
`;
}

module.exports = { buildOdt };
