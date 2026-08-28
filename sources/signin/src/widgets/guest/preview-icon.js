/**
 * Which glyph a file tile shows — a port of the desk grid's preview chain:
 *
 *   builtins/media/grid/template/index.js   picks by filetype
 *   builtins/media/grid/template/preview.js imgCapable ? thumbnail : icon/ext
 *   builtins/media/template/icon-name.js    filetype -> chartId
 *   builtins/media/template/map.js          extension -> chartId
 *
 * Returns { ico } for a sprite glyph, or { ext } for the extension-text badge
 * the grid falls back to when a document's extension has no icon of its own.
 *
 * ONE branch of the original is deliberately absent: image-capable rows
 * (`imgCapable`) render the file's own thumbnail in the desk grid. That needs a
 * per-file URL, and those are not readable anonymously — file/small, /thumb,
 * /medium and /orig all answer 401/403 for a share opened this way. So an image
 * falls back to its type glyph here, which is exactly what the desk grid itself
 * does for a node that is not image-capable.
 */

// builtins/media/template/map.js, verbatim. Every value is verified present in
// the raw sprite (icons/sprites/raw.sprite.svg).
const BY_EXT = {
  cnf: "settings",
  conf: "settings",
  css: "raw-documents_code",
  doc: "raw-documents_word",
  docx: "raw-documents_word",
  htm: "desktop__link",
  html: "desktop__link",
  ini: "settings",
  js: "code-js",
  json: "raw-json",
  md: "raw-markdown",
  odp: "raw-odp-red",
  odt: "raw-odt-red",
  pdf: "raw-documents_pdf",
  ppt: "raw-documents_powerpoint",
  pptx: "raw-documents_powerpoint",
  rtf: "raw-documents_word",
  schedule: "drumee-phone-cam",
  scss: "raw-documents_code",
  settings: "settings",
  xls: "raw-documents_excel",
  xlsx: "raw-documents_excel",
};

// The filetypes icon-name.js routes through the extension map before falling
// back to the extension-text badge.
const BY_EXT_TYPES = ["document", "stylesheet", "script", "schedule", "settings", "web"];

/**
 * @param {{ftype?: string, filetype?: string, ext?: string, mimetype?: string}} row
 * @returns {{ico?: string, ext?: string}}
 */
function previewIcon(row) {
  const type = row.ftype || row.filetype || "";
  const ext = String(row.ext || "").toLowerCase();

  switch (type) {
    case "image":
      return { ico: "desktop_picture" };
    case "video":
      // icon-name splits video by mimetype: an audio payload gets the music glyph.
      return { ico: row.mimetype === "audio" ? "desktop_musicfile" : "desktop_videofile" };
    case "music":
    case "audio":
      return { ico: "desktop_musicfile" };
    case "note":
    case "drumee.note":
    case "markdown":
      return { ico: "raw-ab_notes" };
    case "stream":
      return { ico: "drumee-phone-cam" };
    case "error":
      return { ico: "header_question" };
    case "app-data":
      return { ico: "raw-json" };
    default:
      break;
  }

  if (BY_EXT_TYPES.includes(type)) {
    const ico = BY_EXT[ext];
    // No icon for this extension → the grid shows the extension as text on a
    // file shape (Template.SvgText(ext, 'preview-icon extension …')).
    if (!ico) return ext ? { ext } : { ico: "documents_different" };
    // map.js returns the extension itself when there is no entry; icon-name
    // treats that as "render the text badge instead".
    return ico === ext ? { ext } : { ico };
  }

  // Unknown type: the grid's own default. json payloads keep the glyph, anything
  // else with an extension shows the text badge.
  if (ext && !/json/.test(String(row.mimetype || ""))) return { ext };
  return { ico: "desktop_docfile" };
}

module.exports = { previewIcon };
