/**
 * Turn a media.show_node_by listing into the rows the external layout renders.
 *
 * Row shape comes from common/procedures/mfs/mfs_show_node_by.sql:
 * { nid, filename, ext, ftype, filetype, mtime, ctime, ... }. Folders and files
 * are separated because the layout draws them as two different tiles.
 */

// ext -> the tile glyph key external-view.js knows (FILE_ICO).
const KIND_BY_EXT = {
  pdf: "pdf",
  doc: "doc", docx: "doc", odt: "doc", rtf: "doc", txt: "doc",
  xls: "sheet", xlsx: "sheet", ods: "sheet", csv: "sheet",
  ppt: "slides", pptx: "slides", odp: "slides",
  md: "note",
};

const isFolder = (row) => {
  const t = row.ftype || row.filetype;
  return t === "folder" || t === "hub";
};

/**
 * The tile's date line, exactly as media/grid/template/index.js writes it:
 * anything under a week old reads as an age ("3 days ago"), older reads as a
 * date ("Oct 12, 2023"), and ctime wins over mtime.
 *
 * The grid gets the age wording from Dayjs.fromNow(); dayjs is not on the
 * guest page, so its relativeTime thresholds are reproduced below. Only the
 * sub-week ones can ever be reached from here.
 *
 * @returns {string} "" when the row carries no usable timestamp
 */
function formatDate(row) {
  const ts = Number(row.ctime || row.mtime || 0);
  if (!ts) return "";
  try {
    const then = new Date(ts * 1000);
    const secs = Math.round((Date.now() - then.getTime()) / 1000);
    const days = Math.floor(secs / 86400);
    if (secs >= 0 && days < 7) {
      const mins = Math.round(secs / 60);
      const hours = Math.round(secs / 3600);
      if (secs < 45) return "a few seconds ago";
      if (secs < 90) return "a minute ago";
      if (mins < 45) return `${mins} minutes ago`;
      if (mins < 90) return "an hour ago";
      if (hours < 22) return `${hours} hours ago`;
      if (hours < 36) return "a day ago";
      return `${Math.round(secs / 86400)} days ago`;
    }
    return then.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch (e) {
    return "";
  }
}

function fileName(row) {
  const base = row.filename || "";
  return row.ext ? `${base}.${row.ext}` : base;
}

function fileKind(row) {
  const t = row.ftype || row.filetype;
  if (t === "image") return "image";
  // Real listings carry ftype values well beyond file/folder — document, video,
  // script, audio … — so anything without an explicit extension mapping gets the
  // GENERIC file glyph rather than being mislabelled as a Word document.
  return KIND_BY_EXT[String(row.ext || "").toLowerCase()] || "note";
}

/**
 * @param {Array} rows listing returned by media.show_node_by
 * @returns {{folders: Array, files: Array}}
 */
function mapListing(rows) {
  const list = Array.isArray(rows) ? rows : rows ? [rows] : [];
  const folders = [];
  const files = [];
  for (const row of list) {
    if (!row || !row.filename) continue;
    if (isFolder(row)) {
      folders.push({ name: row.filename });
    } else {
      files.push({
        name: fileName(row),
        kind: fileKind(row),
        date: formatDate(row),
        // Carried through untouched for preview-icon.js, which resolves the
        // glyph exactly as the desk grid does (filetype, then extension).
        ftype: row.ftype || row.filetype,
        ext: row.ext,
        mimetype: row.mimetype,
        // Inlined data URI, present only on the poster pass (see _loadPosters).
        poster: row.poster,
        nid: row.nid,
      });
    }
  }
  return { folders, files };
}

module.exports = { mapListing };
