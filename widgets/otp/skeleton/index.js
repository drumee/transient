const { header } = require("../../../skeletons");

function __skl_welcome_signup(ui) {
  const fig = ui.fig.family
  let digits = []
  let { title, message } = ui.model.toJSON()
  const len = ui.model.get('length') || 6
  for (let i = 0; i < len; i++) {
    digits.push(
      Skeletons.Entry({
        name: `digit-${i}`,
        service: _a.input
      })
    )
  }
  const code = Skeletons.Box.X({
    kidsOpt: {
      className: `${fig}__digit`,
      placeholder: "",
      maxlength: 1,
      interactive: 1
    },
    className: `${fig}__digits`,
    sys_pn: "digits",
    kids: digits
  })

  const resend = Skeletons.Box.X({
    className: `${fig}__resend`,
    kidsOpt: {
      tagName: _K.tag.span,
    },
    kids: [
      Skeletons.Element({
        className: `${fig}__resend-text`,
        content: `${LOCALE.DIDNT_GET_EMAIL} ${LOCALE.OR}`
      }),
      Skeletons.Element({
        className: `${fig}__resend-text resend`,
        content: LOCALE.RESEND_CODE,
        service: "resend-code"
      }),
    ]
  })

  const tips = Skeletons.Box.X({
    className: `${fig}__tips`,
    kidsOpt: {
      tagName: _K.tag.span,
    },
    kids: [
      Skeletons.Note({
        sys_pn: "tips-text",
        className: `${fig}__tips-text`,
      }),
    ]
  })

  if (_.isString(message)) {
    message = Skeletons.Box.X({
      className: `${fig}__message`,
      kids: [
        Skeletons.Element({
          className: `${fig}__message-text`,
          content: message
        })
      ]
    });
  }
  return Skeletons.Box.Y({
    className: `${fig}__main`,
    debug: __filename,
    kids: [
      header(ui, title || LOCALE.VALIDATION_SENT_TO),
      message,
      code,
      tips,
      resend
    ]
  })

}

export default __skl_welcome_signup