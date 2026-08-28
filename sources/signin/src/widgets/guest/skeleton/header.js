/**
 * Workspace header: folder tile + "Restricted Project: {name}" + "Restricted Guest
 * Access" subline.
 *
 * All three strings come from the widget's OWN options so a host can pass real
 * names without this page ever calling an API; with nothing passed they fall back
 * to generic localized copy (never the Figma sample data).
 *
 * @param {LetcBox} ui
 */
function __skl_signin_guest_header(ui) {
  const fig = ui.fig.family;
  const external = ui.isExternal();

  const name = ui.mget(_a.title) || ui.mget(_a.name) || "";
  // The title names the workspace's scope: "Internal Workspace: <name>" for a
  // private one, "External Workspace <name>" for a shared one. With no name
  // passed it degrades to the scope on its own.
  const prefix = external
    ? LOCALE.GUEST_EXTERNAL_WORKSPACE || "External Workspace:"
    : LOCALE.GUEST_INTERNAL_WORKSPACE || "Internal Workspace:";
  const fallback = external
    ? LOCALE.GUEST_SHARED_TITLE || "External workspace"
    : LOCALE.GUEST_RESTRICTED_TITLE || "Internal workspace";
  const title = name ? `${prefix} ${name}` : fallback;

  const titleBlock = Skeletons.Box.Y({
    className: `${fig}__header-titles`,
    kids: [
      Skeletons.Note({
        className: `${fig}__header-title`,
        content: title,
      }),
      Skeletons.Box.X({
        className: `${fig}__header-subline`,
        kids: [
          // A shared workspace is reached BY the link, so it shows the link
          // glyph; a restricted one shows the padlock.
          external
            ? Skeletons.Button.Svg({
                ico: "apps-link-simple",
                className: `${fig}__header-link`,
              })
            : Skeletons.Button.Svg({
                ico: "lock",
               className: `${fig}__header-lock`,
              }),
          Skeletons.Note({
            className: `${fig}__header-sublabel`,
            content: external
              ? LOCALE.SHARED_BY_LINK || "Shared by link"
              : LOCALE.GUEST_RESTRICTED_ACCESS || "Restricted Guest Access",
          }),
        ],
      }),
    ],
  });

  const left = Skeletons.Box.X({
    className: `${fig}__header-left`,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__header-tile`,
        kids: [
          Skeletons.Button.Svg({
            ico: "folder-header",
            className: `${fig}__header-tile-ico`,
          }),
        ],
      }),
      titleBlock,
    ],
  });

  return Skeletons.Box.X({
    className: `${fig}__header`,
    debug: __filename,
    kids: [left],
  });
}

module.exports = __skl_signin_guest_header;
