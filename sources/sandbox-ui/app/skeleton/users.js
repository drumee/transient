// ================================================================== *
//   Copyright Xialia.com  2011-2024
//   FILE : /Users/somanos/devel/sandbox-ui/app/main/skeleton/index.js
//   TYPE : Skelton
// ===================================================================**/

/**
 * 
 * @param {*} _ui_ 
 * @returns 
 */

function __skl_sandbox_domain(_ui_, kids) {
  const opt = {
    kind: "sandbox_user",
    uiHandler: [_ui_]
  };

  const list = Skeletons.List.Smart({
    className: `${_ui_.fig.group}__icons-list`,
    innerClass: `${_ui_.fig.group}__icons-scroll`,
    sys_pn: _a.list,
    itemsOpt: opt,
    vendorOpt: Preset.List.Orange_e,
    kids,
  });

  const a =
    Skeletons.Box.Y({
      debug: __filename,
      className: `${_ui_.fig.family}__container`,
      sys_pn: "message-container",
      kids: [
        Skeletons.Wrapper.Y({
          className: `${_ui_.fig.family}__message`,
          sys_pn: "message"
        }),
        Skeletons.Note({
          className: `${_ui_.fig.family}__text domain-name`,
          content: "Sandbow domain name: " + localStorage.getItem('sandboxDomain')
        }),
        Skeletons.Note({
          className: `${_ui_.fig.family}__users-list`,
          content: LOCALE.SBX_USERS_LIST
        }),
        list,
      ]
    })

  return a;
}
module.exports = __skl_sandbox_domain;