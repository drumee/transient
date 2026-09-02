/* ==================================================================== *
* Widget skeleton automatically generated on <%= date %>
* npm run add-widget -- --fig=<%= group %>.<%= name %> --dest=<%= dest %>
* ==================================================================== */

/**
 * 
 * @param {*} ui 
 * @returns 
 */

module.exports = function (ui) {
  return Skeletons.Box.Y({
    className  : `#{ui.fig.family}__main`,
    debug      : __filename,
    kids       : [
      Skeletons.Box.X({
        className  : `#{ui.fig.family}__container`,
        kids : [
          Skeletons.Note({
            className  :`#{ui.fig.family}__text`,
            content : "Hello world!"
          }),
          Skeletons.Button.Svg({
            className  :`#{ui.fig.family}__icon`,
            ico : "message_smile"
          }),
        ]
      })
    ]
  })
}
