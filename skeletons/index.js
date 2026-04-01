const haptic = 3000;

/**
 * 
 * @param {*} ui 
 * @param {*} opt 
 * @returns 
 */
export function button(ui, opt) {
  let { label, ico, service, sys_pn, className, priority = "primary", type, haptic } = opt;
  const pfx = className || `${ui.fig.group}__button`;
  let kids = []
  if (label) kids.push(
    Skeletons.Element({
      className: `${pfx} btn`,
      content: label,
      tagName: _K.tag.span,
    })
  )
  let main = Skeletons.Box.G;
  if (ico) {
    let el = Skeletons.Button.Svg({
      className: `${pfx} icon`,
      ico,
    })
    if ([_a.api].includes(type)) {
      kids.unshift(el);
      main = Skeletons.Box.X;
    } else if ([_a.row].includes(type)) {
      kids.push(el)
      main = Skeletons.Box.X;
    } else {
      kids.push(el)
      main = Skeletons.Box.G;
    }
  }

  return main({
    className: `${pfx}-main ${priority}`,
    partHandler: [ui],
    uiHandler: [ui],
    sys_pn,
    service,
    haptic,
    kidsOpt: {
      active: 0,
    },
    kids
  })
}

/**
 * 
 * @param {*} ui 
 * @returns 
 */
export function header(ui, content, tips) {
  const fig = ui.fig.family;
  let kids = [
    Skeletons.Box.X({
      className: `${fig}__logo-container`,
      kids: [
        Skeletons.Button.Svg({
          ico: "raw-logo-drumee-icon",
          className: `${fig}__logo-content`,
        })
      ]
    }),

    Skeletons.Box.Y({
      className: `${fig}__text-container`,
      kids: [
        Skeletons.Note({
          className: `${fig}__title`,
          content
        }),
      ]
    })

  ]

  if (tips) {
    kids.push(Skeletons.Box.Y({
      className: `${fig}__text-container`,
      kids: [
        Skeletons.Note({
          className: `${fig}__tips`,
          tips
        }),
      ]
    }))
  }

  let a = Skeletons.Box.Y({
    className: `${ui.fig.family}__header`,
    debug: __filename,
    kids
  })
  return a;
}

/**
 * 
 * @param {*} ui 
 * @param {*} opt 
 * @returns 
 */
export function entry(ui, opt) {
  let { value, name, placeholder, label, sys_pn, service = _a.input, autocomplete } = opt;
  autocomplete = autocomplete || name;
  const pfx = `${ui.fig.family}__entry`;
  let args = {
    className: `${pfx}-input`,
    name,
    value,
    formItem: name,
    innerClass: name,
    mode: _a.interactive,
    service,
    placeholder,
    uiHandler: [ui],
    autocomplete,
    radio: ui._id
  }
  if (sys_pn) {
    args.sys_pn = sys_pn;
    args.partHandler = [ui];
  }
  return Skeletons.Box.Y({
    className: `${pfx}-main`,
    kids: [
      Skeletons.Note({
        className: `${pfx}-label ${name}`,
        content: label,
      }),
      Skeletons.Entry(args)
    ]
  })
}


/**
* 
* @param {*} ui 
* @param {*} cn 
* @param {*} passmeter 
* @returns 
*/
export function password(ui, opt) {
  const { placeholder, interactive = 1, name, service, sys_pn } = opt;
  const pfx = `${ui.fig.family}__entry`;
  return Skeletons.Box.X({
    className: `${pfx}-main`,
    sys_pn: 'wrapper-pw',
    partHandler: [ui],
    kids: [
      Skeletons.EntryBox({
        uiHandler: [ui],
        type: _a.password,
        className: `${pfx}-input`,
        service: service || _e.submit,
        name,
        formItem: name,
        placeholder,
        interactive,
        sys_pn,
        shower: 1
      })
    ]
  });
}


/**
* 
* @param {*} ui 
* @param {*} cn 
* @param {*} passmeter 
* @returns 
*/
export function password_box(ui, opt) {
  const fig = ui.fig.family
  return Skeletons.Box.Y({
    className: `${fig}__form`,
    kids: [
      entry(ui, {
        placeholder: LOCALE.EMAIL,
        name: _a.email,
        sys_pn: _a.email,
        service: _a.input,
        value: ui.mget(_a.email) || ""
      }),
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
      }),
      { kind: 'dtk_pwsetter', sys_pn: 'pwsetter' },
      button(ui, {
        label: LOCALE.CREATE_ACCOUNT,
        service: 'create-account',
        type: _a.email,
        sys_pn: "commit-button",
        haptic
      }),
    ]
  })
}

/**
 * 
 * @param {*} ui 
 * @param {*} opt 
 * @returns 
 */
export function dialog_box(ui, opt) {
  const fig = ui.fig.family
  const { title, message, buttons, content } = opt;
  const Buttons = Skeletons.Box.X({
    className: `${fig}__buttons`,
    kids: buttons
  })

  return Skeletons.Box.Y({
    className: `${fig}__main`,
    debug: __filename,
    kids: [
      header(ui, title),
      Skeletons.Element({ className: `${fig}__message`, content: message || LOCALE.ERROR_SERVER }),
      content,
      Buttons
    ]
  })

}



