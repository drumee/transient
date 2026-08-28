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

module.exports = function (ui, opt = {}) {
  const { service, content } = opt;
  const a = Skeletons.Box.Y({
    className: `${ui.fig.family}__launch-pad`,
    service,
    uiHandler: [ui],
    kids: [
      Skeletons.Wrapper.Y({
        className: `${ui.fig.family}__launch-pad-button`,
        sys_pn: 'launch-pad-button',
        kids: [
          Skeletons.Note({
            active: 0,
            className: `progress`,
            content: "",
            sys_pn: "progress"
          }),
          Skeletons.Note({
            uiHandler: [ui],
            active: 1,
            className: `text button transition-colors bg-secondary text-secondary-foreground`,
            content,
            service,
            sys_pn: "launcher",
            haptic: 1
          }),
        ]
      })
    ]
  });
  return [a];
}
