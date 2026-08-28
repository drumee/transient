/**
 * Sample contents for the EXTERNAL guest layout, taken from Figma 1602:77081.
 *
 * Used only when no `content` option is supplied — i.e. the direct
 * #/plugins?name=signin&kind=signin_guest entry point, which has no share to read
 * from. A host that knows the real share passes its own rows to
 * signin_guest (see externalContent() in ./index.js) and none of this is used.
 *
 * Kept as data, not markup, so swapping in real rows changes nothing else.
 */
module.exports = {
  folders: [
    { name: "Sub-folder v1" },
    { name: "Sub-folder v2" },
    { name: "Sub-folder v3" },
    { name: "Sub-folder v4" },
    { name: "Sub-folder v5" },
    { name: "Sub-folder v6" },
    { name: "Sub-folder v7" },
    { name: "Sub-folder v8" },
  ],
  files: [
    { name: "spec_v2.docx", kind: "doc", date: "Oct 12, 2023", ftype: "document", ext: "docx" },
    { name: "spec_v2.pdf", kind: "pdf", date: "Oct 12, 2023", ftype: "document", ext: "pdf" },
    { name: "note", kind: "note", date: "Oct 12, 2023", ftype: "note" },
    { name: "Spreadsheet", kind: "sheet", date: "Oct 12, 2023", ftype: "document", ext: "xlsx" },
    { name: "Presentation", kind: "slides", date: "Oct 12, 2023", ftype: "document", ext: "pptx" },
    { name: "bg_concept.png", kind: "image", date: "Oct 12, 2023", ftype: "image", ext: "png" },
  ],
  messages: [
    {
      out: 1,
      time: "11:42 AM",
      text: "Did everyone see <span class=\"signin-guest__ext-bubble-file\">/spec_v2.docx</span>? I've updated the core requirements.",
    },
    {
      author: "Sarah K.",
      time: "11:53 AM",
      text: "Please check the <span class=\"signin-guest__ext-bubble-file\">@Project_Brief_v2.pdf</span> for the latest revisions.",
    },
  ],
};
