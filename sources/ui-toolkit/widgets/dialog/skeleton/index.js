const { header } = require("../../../skeletons")

export default function (ui) {
  const fig = ui.fig.family
  const { title, message, buttons, body } = ui.model.toJSON()
  let Buttons = null;
  if (buttons) {
    Buttons = Skeletons.Box.X({
      className: `${fig}__buttons`,
      kids: buttons
    })
  }
  if (message == null) message = '';
  let a = Skeletons.Box.Y({
    className: `${fig}__main`,
    debug: __filename,
    kids: [
      header(ui, title),
      Skeletons.Element({ className: `${fig}__message`, content: message }),
      body,
      Buttons
    ]
  })

  return a;

}
