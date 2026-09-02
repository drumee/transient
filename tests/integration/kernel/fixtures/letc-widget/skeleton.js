module.exports = function (ui) {
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__main`,
    kids: [Skeletons.Note({ className: `${ui.fig.family}__text`, content: "Widget pattern ready" })]
  });
};
