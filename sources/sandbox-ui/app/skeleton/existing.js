// ================================================================== *
//   Copyright Xialia.com  2011-2024
//   FILE : /Users/somanos/devel/sandbox-ui/app/main/skeleton/index.js
//   TYPE : Skelton
// ===================================================================**/

/**
 * 
 * @param {*} ui 
 * @returns 
 */

function __skl_sandbox_app(ui, users) {
  let opt = {
    service: _a.reset,
    content: LOCALE.SBX_DELETE_DATA
  }
  const a = Skeletons.Box.Y({
    className: `${ui.fig.family}__main`,
    kids: [
      Skeletons.Box.X({
        className: `${ui.fig.family}__welcome-logo header`,
        kids: [
          Skeletons.Image.Smart({
            className: `${ui.fig.family}__welcome-logo`,
            src: `/images/drumee-logo.png`,
          }),
        ]
      }),
      Skeletons.Box.Y({
        className: `${ui.fig.family}__body`,
        debug: __filename,
        sys_pn: _a.content,
        kids: require("./users")(ui, users)
      }),
      Skeletons.Wrapper.Y({
        className: `${ui.fig.family}__footer`,
        sys_pn: "footer",
        dataset: {
          state: _a.closed
        },
        kids: require("./launch-pad")(ui, opt)
      })
    ]
  });
  return a;
}
module.exports = __skl_sandbox_app;
