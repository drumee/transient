module.exports = function (ui) {
  const fig = ui.fig.family; // window-info
  // Based on window/confirm: brand logo on the left, an X close on the right
  // (matches the "drumee … ✕" header in the reference dialog).
  return Skeletons.Box.X({
    className: `${fig}__topbar`,
    sys_pn: "topbar",
    debug: __filename,
    service: _e.raise,
    kids: [
      Skeletons.Box.X({
        className: `${fig}__logo`,
        kids: [
          Skeletons.Button.Svg({
            ico: "logo-upload",
            className: `${fig}__logo-ico`,
          }),
          Skeletons.Note({
            content: "drumee",
            className: `${fig}__logo-text`,
          }),
        ],
      }),
      Skeletons.Box.X({
        className: `${fig}__close`,
        service: _e.close,
        uiHandler: ui,
        bubble: 0,
        kidsOpt: { active: 0 },
        kids: [
          Skeletons.Image.Svg({
            ico: "cross",
            className: `${fig}__close-ico`,
          }),
        ],
      }),
    ],
  });
};
