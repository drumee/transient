const { password, button } = require("../../../skeletons");

/**
* 
* @param {*} ui 
* @param {*} opt 
* @returns 
*/
function passmeter(ui, opt) {
  let fig = `${ui.fig.family}`
  let { label, haptic = 2000 } = ui.model.toJSON();
  const form = Skeletons.Box.Y({
    className: `${fig}__form`,
    kids: [
      password(ui, {
        placeholder: LOCALE.PASSWORD,
        name: _a.password,
        sys_pn: _a.password,
        interactive: 1,
        service: 'password-input'
      }),
      password(ui, {
        placeholder: LOCALE.PASSWORD_CONFIRM,
        name: "password2",
        sys_pn: "password2",
        interactive: 1,
        service: 'password-input'
      }),
    ]
  })
  let commit;
  if (ui.mget(_a.api) && ui.mget(_a.label)) {
    commit = button(ui, {
      label,
      className: `${fig}__button`,
      priority: 'secondary full-width',
      service: _e.commit,
      type: _a.email,
      sys_pn: "commit-button",
      haptic
    })
  }
  return Skeletons.Box.Y({
    className: `${fig}__main`,
    kids: [
      form,
      Skeletons.Box.Y({
        className: `${fig}__divider`,
        kids: [Skeletons.Box.X({
          className: `${fig}__dashboard`,
          kids: [
            Skeletons.Note({
              className: `${fig}__topic`,
              sys_pn: "topic"
            }),
            Skeletons.Note({
              className: `${fig}__strength-state`,
              content: "",
              sys_pn: "strength-state"
            }),
            Skeletons.Box.X({
              className: `${fig}__strength-container`,
              kids: [
                Skeletons.Element({
                  className: `${fig}__strength-content`,
                  sys_pn: "strength-grade"
                }),
              ]
            })
          ]
        }),
        Skeletons.Box.X({
          className: `${fig}__dashboard`,
          kids: [
            Skeletons.Button.Svg({
              ico: "checked-circle",
              className: `${fig}__message-icon`,
              content: "",
              sys_pn: "message-icon",
              state: 0
            }),
            Skeletons.Note({
              className: `${fig}__message-text`,
              content: "",
              sys_pn: "message-text"
            }),
          ]
        })]
      }),
      commit
    ]
  })
};




export default passmeter