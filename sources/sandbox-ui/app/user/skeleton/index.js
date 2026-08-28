// ================================================================== *
//   Copyright Xialia.com  2011-2024
//   FILE : /Users/somanos/devel/sandbox-ui/app/user/skeleton/index.js
//   TYPE : Skelton
// ===================================================================**/

/**
 * 
 * @param {*} _ui_ 
 * @returns 
 */
function avatar(_ui_) {
  return {
    className: `${_ui_.fig.family}__avatar`,
    kind: "profile",
    id: _ui_.mget(_a.uid),
    type: 'thumb',
    active: 0,
    surname: _ui_.mget(_a.username)
  }
}
function __skl_sandbox_user(_ui_) {
  const main = Skeletons.Box.Y({
    className: `${_ui_.fig.family}__main`,
    debug: __filename,
    kids: [
      Skeletons.Box.G({
        className: `${_ui_.fig.family}__container`,
        kids: [
          Skeletons.Button.Svg({
            className: `${_ui_.fig.family}__button link`,
            ico: "editbox_link",
            service: _a.copy
          }),
          Skeletons.Element({
            className: `${_ui_.fig.family}__button qr-code`,
            tagName: "img",
            sys_pn: "qr-code",
            service: "show-qr-code"
          }),
          Skeletons.Box.Y({
            className: `${_ui_.fig.family}__user`,
            kids: [
              Skeletons.Note({
                className: `${_ui_.fig.family}__text`,
                content: _ui_.mget(_a.username)
              }),
              Skeletons.Note({
                className: `${_ui_.fig.family}__text`,
                content: LOCALE[_ui_.mget(_a.role)]
              })
            ]
          }),
          avatar(_ui_)
        ]
      })
    ]
  })

  return main;
}
module.exports = __skl_sandbox_user;