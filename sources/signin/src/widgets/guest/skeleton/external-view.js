/**
 * EXTERNAL (shared) workspace view — Figma 1602:77081 "Guest Landing Page
 * (Viral) Link shared".
 *
 * Where the internal layout redacts everything behind a "Content Restricted"
 * card, this one shows the workspace: one window card holding a title bar with a
 * SHARED badge, a Files/Chat/Tasks tab bar, a type-filter row, the folder + file
 * grid, and an unblurred Conversation panel.
 *
 * Content comes from ui.externalContent() — folders / files / messages — so the
 * markup is data-driven and does not care where the rows came from. See the note
 * on that method in ../index.js about wiring it to the real share.
 *
 * @param {LetcBox} ui
 */

const { previewIcon } = require('../preview-icon');

/**
 * Title bar: folder glyph + name + SHARED badge on the left, the window's own
 * controls on the right. The controls are inert chrome — a guest cannot upload,
 * add or configure anything — so they carry no service and are aria-hidden.
 */
function windowBar(ui) {
  const fig = ui.fig.family;
  const external = ui.isExternal();

  const left = Skeletons.Box.X({
    className: `${fig}__ext-bar-left`,
    kids: [
      Skeletons.Button.Svg({
        ico: "folder-header",
        className: `${fig}__ext-bar-ico`,
      }),
      // The workspace's own name, like the folder window's topbar title —
      // never a static "Shared Folder".
      Skeletons.Note({
        className: `${fig}__ext-bar-title`,
        content: ui.workspaceName(),
      }),
      // Badge follows the SAME scope flag the layout does, so it can never
      // disagree with the page it labels.
      Skeletons.Note({
        className: `${fig}__ext-bar-badge`,
        content: external
          ? LOCALE.EXTERNAL || "External"
          : LOCALE.INTERNAL || "Internal",
      }),
    ],
  });

  // Same order and glyphs as the folder window's right cluster
  // (ui-team folder/skeleton/topbar.js): share/link, settings, zoom, minimize,
  // close. Upload and Add-new are NOT here — the folder window moved them into
  // the Files toolbar's "+ New", and so does this view (see filesToolbar).
  //
  // Minimize is a Note carrying U+2212, not an icon: the bundled
  // window-minimize glyph renders as a heavy bar, which is why the folder
  // window draws it as text too.
  const right = Skeletons.Box.X({
    className: `${fig}__ext-bar-right`,
    attrOpt: { "aria-hidden": "true" },
    kids: [
      Skeletons.Button.Svg({ ico: "app-share", className: `${fig}__ext-bar-btn link` }),
      Skeletons.Button.Svg({ ico: "setting", className: `${fig}__ext-bar-btn settings` }),
      Skeletons.Button.Svg({ ico: "desktop_fullview", className: `${fig}__ext-bar-btn zoom` }),
      Skeletons.Note({ className: `${fig}__ext-bar-minimize`, content: "−" }),
      Skeletons.Button.Svg({ ico: "cross", className: `${fig}__ext-bar-btn close` }),
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__ext-bar`,
    kids: [left, right],
  });
}

/**
 * Files / Chat / Tasks. Same shape as the real folder window's tab bar
 * (ui-team window/skeleton/toolkit tabBar → folderTab): a tabs group holding
 * icon + label per item, the active one outlined in the area accent. Files is
 * active; none of them are clickable for a guest.
 */
function tabs(ui) {
  const fig = ui.fig.family;
  // Files / Chat / Task / Meeting — the folder window's full set, with the
  // singular "Task" label it uses (LOCALE.TASK, not TASKS).
  const items = [
    { ico: "app-file", label: LOCALE.FILES || "Files", active: 1 },
    { ico: "meet-chat-dots", label: LOCALE.CHAT || "Chat" },
    { ico: "app-task", label: LOCALE.TASK || "Task" },
    { ico: "folder-meeting", label: LOCALE.MEETING || "Meeting" },
  ];
  return Skeletons.Box.X({
    className: `${fig}__ext-tabs`,
    attrOpt: { "aria-hidden": "true" },
    kids: [
      Skeletons.Box.X({
        className: `${fig}__ext-tab-group`,
        kids: items.map((t) =>
          Skeletons.Box.X({
            className: `${fig}__ext-tab${t.active ? " active" : ""}`,
            kids: [
              Skeletons.Button.Svg({
                ico: t.ico,
                className: `${fig}__ext-tab-icon`,
              }),
              Skeletons.Note({
                className: `${fig}__ext-tab-label`,
                content: t.label,
              }),
            ],
          })
        ),
      }),
    ],
  });
}

/**
 * Files toolbar — the folder window's fileTypeFilterBar: the type filters on the
 * left, then fileFilterControls on the right holding "+ New" and the list/grid
 * view toggle. Both of those live here rather than in the header, matching where
 * the folder window moved them.
 */
function filesToolbar(ui) {
  const fig = ui.fig.family;
  const items = [
    { label: LOCALE.ALL || "All", active: 1 },
    { label: LOCALE.DOCS || "Docs" },
    { label: LOCALE.PDF || "PDF" },
    { label: LOCALE.IMAGES || "Images" },
    { label: LOCALE.OTHER || "Other" },
  ];

  const filterTabs = items.map((f) =>
    Skeletons.Note({
      className: `${fig}__ext-filter${f.active ? " active" : ""}`,
      content: f.label,
    })
  );

  // Two segments with a check glyph each, exactly like fileViewToggle; the
  // active one is marked by the wrapper's state, so the skin shows one check.
  const viewSegment = (mode, ico) =>
    Skeletons.Box.X({
      className: `${fig}__ext-view-seg ${mode}`,
      kids: [
        Skeletons.Button.Svg({ ico: "account_check", className: `${fig}__ext-view-check` }),
        Skeletons.Button.Svg({ ico, className: `${fig}__ext-view-glyph` }),
      ],
    });

  const controls = Skeletons.Box.X({
    className: `${fig}__ext-file-controls`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__ext-new-ctrl`,
        kids: [
          Skeletons.Button.Svg({ ico: "plus-header", className: `${fig}__ext-new-ico` }),
          Skeletons.Note({
            className: `${fig}__ext-new-label`,
            content: LOCALE.NEW || "New",
          }),
        ],
      }),
      Skeletons.Box.X({
        className: `${fig}__ext-view-toggle`,
        // Grid is the view this page renders.
        attrOpt: { "data-state": "0" },
        kids: [viewSegment("list", "view-list"), viewSegment("grid", "view-grid")],
      }),
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__ext-filters`,
    attrOpt: { "aria-hidden": "true" },
    kids: [
      Skeletons.Box.X({ className: `${fig}__ext-filter-tabs`, kids: filterTabs }),
      controls,
    ],
  });
}

/** Folder tile: the pink folder art with its name underneath. */
function folderTile(ui, folder) {
  const fig = ui.fig.family;
  return Skeletons.Box.Y({
    className: `${fig}__ext-folder`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__ext-folder-art`,
        kids: [
          Skeletons.Button.Svg({
            ico: "folder-header",
            className: `${fig}__ext-folder-ico`,
          }),
        ],
      }),
      Skeletons.Note({
        className: `${fig}__ext-folder-name`,
        content: folder.name,
      }),
    ],
  });
}

/**
 * The tile's artwork, in the desk grid's own order of preference
 * (media/grid/template/preview.js):
 *
 *   poster present  the file's own rendered preview, as the grid's
 *                   .preview-content — and, for a video, the play badge
 *                   centred over it exactly as the grid overlays it.
 *   otherwise       whatever previewIcon() resolves: a sprite glyph, or the
 *                   extension as text where the grid falls back to that badge.
 *
 * The poster arrives inlined as a data URI from dmz.list_by_token; see
 * signin_guest._loadPosters() for why it is not a URL.
 */
function fileArt(ui, file) {
  const fig = ui.fig.family;
  const type = file.ftype || file.filetype || "";

  // filetype "audio" never reaches the icon map. grid/template/index.js
  // switches on filetype BEFORE calling preview.js and swaps in a bespoke
  // record-disc drawing for audio, so an .mp3 shows the disc rather than the
  // desktop_musicfile note glyph the map would have given it. The artwork is
  // the grid's own file, copied verbatim, not a redraw.
  if (type === "audio") {
    return Skeletons.Element({
      tagName: "div",
      className: `${fig}__ext-file-disc`,
      // raw-loader hands back the markup; assigned to innerHTML.
      content: require("../filetype/audio.txt").default,
    });
  }

  if (file.poster) {
    const kids = [];
    if (type === "video") {
      kids.push(
        Skeletons.Button.Svg({
          ico: "raw-video",
          className: `${fig}__ext-file-play`,
        })
      );
    }
    return Skeletons.Element({
      tagName: "div",
      className: `${fig}__ext-file-poster ${type}`,
      style: { backgroundImage: `url(${file.poster})` },
      kids,
    });
  }

  const preview = previewIcon(file);
  if (!preview.ext) {
    return Skeletons.Button.Svg({
      ico: preview.ico,
      className: `${fig}__ext-file-ico`,
    });
  }

  // Extension badge — a .txt, or any document whose extension has no icon of
  // its own. The grid draws this with Template.SvgText: a document outline
  // with the extension on a chip across it, NOT bare text. Template is a host
  // global (window.Template, set in the app core bundle), so use the real one
  // rather than keeping a second copy of the shape in step with it.
  const label = String(preview.ext).toLowerCase();
  if (typeof Template !== "undefined" && Template && Template.SvgText) {
    return Skeletons.Element({
      tagName: "div",
      className: `${fig}__ext-file-ext`,
      // Rendered as markup (the element's content is assigned to innerHTML).
      content: Template.SvgText(label, `${fig}__ext-file-ext-svg`),
    });
  }
  // No host Template (the widget rendered standalone) — the label alone still
  // says which kind of file this is.
  return Skeletons.Note({
    className: `${fig}__ext-file-ext`,
    content: label.toUpperCase(),
  });
}

/**
 * File tile: the preview card, then name + kebab + date — the desk grid's
 * media-grid__background + meta-row.
 */
function fileTile(ui, file) {
  const fig = ui.fig.family;
  const art = fileArt(ui, file);

  return Skeletons.Box.Y({
    className: `${fig}__ext-file`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__ext-file-art ${file.kind || "doc"}`,
        kids: [art],
      }),
      // media-grid__meta-row: a column holding the name+kebab line and the
      // date beneath it, so the name can run to two lines and push the date
      // down instead of the two competing for one fixed row.
      Skeletons.Box.Y({
        className: `${fig}__ext-file-meta`,
        kids: [
          Skeletons.Box.X({
            className: `${fig}__ext-file-meta-top`,
            kids: [
              Skeletons.Note({
                className: `${fig}__ext-file-name`,
                content: file.name,
              }),
              Skeletons.Button.Svg({
                ico: "bold-dot-vertical",
                className: `${fig}__ext-file-kebab`,
              }),
            ],
          }),
          Skeletons.Note({
            className: `${fig}__ext-file-date`,
            content: file.date || "",
          }),
        ],
      }),
    ],
  });
}

/**
 * Conversation panel. Unlike the internal one this renders real message text, so
 * it is NOT aria-hidden — but the composer stays a plain box (never a
 * Skeletons.Entry): a guest has no session to post with.
 */
function conversation(ui, messages) {
  const fig = ui.fig.family;

  // avatar | (author, bubble, time) — the chat-item layout: the author's
  // picture in its own column, everything else stacked beside it.
  const bubbles = messages.map((m) =>
    Skeletons.Box.X({
      className: `${fig}__ext-msg ${m.out ? "out" : "in"}`,
      kids: [
        m.avatar
          ? Skeletons.Element({
              tagName: "div",
              className: `${fig}__ext-msg-avatar`,
              style: { backgroundImage: `url(${m.avatar})` },
            })
          : Skeletons.Element({
              tagName: "div",
              className: `${fig}__ext-msg-avatar empty`,
            }),
        Skeletons.Box.Y({
          className: `${fig}__ext-msg-main`,
          kids: [
            Skeletons.Note({
              className: `${fig}__ext-msg-author`,
              content: m.author || "",
            }),
            Skeletons.Note({
              className: `${fig}__ext-bubble ${m.out ? "out" : "in"}`,
              content: m.text,
            }),
            Skeletons.Note({
              className: `${fig}__ext-msg-time`,
              content: m.time || "",
            }),
          ].filter(Boolean),
        }),
      ],
    })
  );

  const composer = Skeletons.Box.X({
    className: `${fig}__ext-composer`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__ext-composer-field`,
        kids: [
          Skeletons.Box.X({
            className: `${fig}__ext-composer-left`,
            kids: [
              Skeletons.Button.Svg({
                ico: "app-attachment",
                className: `${fig}__ext-composer-clip`,
              }),
              Skeletons.Note({
                className: `${fig}__ext-composer-placeholder`,
                content: LOCALE.TYPE_A_MESSAGE || "Type a message...",
              }),
            ],
          }),
          Skeletons.Box.X({
            className: `${fig}__ext-composer-right`,
            kids: [
              // The app's own emoji glyph, as the chat action menu uses it.
              Skeletons.Button.Svg({
                ico: "chat-action-smiley",
                className: `${fig}__ext-composer-emoji`,
              }),
              Skeletons.Button.Svg({
                ico: "app-send",
                className: `${fig}__ext-composer-send`,
              }),
            ],
          }),
        ],
      }),
    ],
  });

  return Skeletons.Box.Y({
    className: `${fig}__ext-chat`,
    kids: [
      // Same shape as the toolkit's chatHeaderBar: title on the left, then the
      // 3-dot thread menu and search on the right (that order).
      Skeletons.Box.X({
        className: `${fig}__ext-chat-head`,
        kids: [
          Skeletons.Note({
            className: `${fig}__ext-chat-title`,
            content: LOCALE.TEAM_CHAT || "Team chat",
          }),
          Skeletons.Box.X({
            className: `${fig}__ext-chat-actions`,
            attrOpt: { "aria-hidden": "true" },
            kids: [
              Skeletons.Button.Svg({
                ico: "apps-dots-vertical",
                className: `${fig}__ext-chat-btn`,
              }),
              Skeletons.Button.Svg({
                ico: "magnifying-glass",
                className: `${fig}__ext-chat-btn`,
              }),
            ],
          }),
        ],
      }),
      Skeletons.Box.Y({
        className: `${fig}__ext-chat-body`,
        kids: bubbles,
      }),
      composer,
    ],
  });
}

function __skl_signin_guest_external(ui) {
  const fig = ui.fig.family;
  const { folders, files, messages } = ui.externalContent();

  const filesPanel = Skeletons.Box.Y({
    className: `${fig}__ext-files`,
    kids: [
      filesToolbar(ui),
      Skeletons.Box.Y({
        className: `${fig}__ext-grid`,
        kids: [
          Skeletons.Box.X({
            className: `${fig}__ext-folder-row`,
            kids: folders.map((f) => folderTile(ui, f)),
          }),
          Skeletons.Box.X({
            className: `${fig}__ext-file-row`,
            kids: files.map((f) => fileTile(ui, f)),
          }),
        ],
      }),
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__split`,
    debug: __filename,
    kids: [
      Skeletons.Box.Y({
        className: `${fig}__ext`,
        kids: [
          windowBar(ui),
          tabs(ui),
          Skeletons.Box.X({
            className: `${fig}__ext-content`,
            kids: [filesPanel, conversation(ui, messages)],
          }),
        ],
      }),
    ],
  });
}

module.exports = __skl_signin_guest_external;
