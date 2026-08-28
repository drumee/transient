/**
 * The "Content Restricted" card, centred over the redacted file grid.
 * @param {LetcBox} ui
 */
function __skl_signin_guest_restricted_card(ui) {
  const fig = ui.fig.family;

  return Skeletons.Box.Y({
    className: `${fig}__card`,
    debug: __filename,
    kids: [
      Skeletons.Button.Svg({
        ico: "app-eye-off",
        className: `${fig}__card-ico`,
      }),
      Skeletons.Note({
        className: `${fig}__card-title`,
        content: LOCALE.CONTENT_RESTRICTED_TITLE || "Content Restricted",
      }),
      Skeletons.Box.Y({
        className: `${fig}__card-text`,
        kids: [
          Skeletons.Note({
            className: `${fig}__card-line`,
            content: LOCALE.CONTENT_RESTRICTED_LINE_1 ||
              "This workspace is currently locked for guests.",
          }),
          Skeletons.Note({
            className: `${fig}__card-line`,
            content: LOCALE.CONTENT_RESTRICTED_LINE_2 ||
              "Please sign up or log in to view and download these assets.",
          }),
        ],
      }),
    ],
  });
}

module.exports = __skl_signin_guest_restricted_card;
