/* global Skeletons */
module.exports = function helloSkeleton(ui) {
  return Skeletons.Box.Y({
    className: `${ui.fig.family}__main`,
    kids: [
      Skeletons.Note({
        className: `${ui.fig.family}__title`,
        content: ui.mget("title")
      }),
      Skeletons.Note({
        className: `${ui.fig.family}__status`,
        content: `Status: ${ui.mget("status")}`
      })
    ]
  });
};
