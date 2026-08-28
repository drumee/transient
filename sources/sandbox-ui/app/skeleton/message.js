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
function __skl_sandbox_ack(_ui_, type) {
  let content = '';
  if (type == _a.copy) {
    content = [
      Skeletons.Note({
        className: `${_ui_.fig.family}__text message`,
        content: LOCALE.ACK_COPY_LINK,
      }),
      Skeletons.Note({
        className: `${_ui_.fig.family}__text message`,
        content: LOCALE.SBX_PASTE_LINK,
      })
    ]
  } else {
    const id = `img-${_ui_.mget(_a.widgetId)}`;
    content = [
      Skeletons.Element({
        className: `${_ui_.fig.family}__canvas message`,
        tagName: "img",
        sys_pn: "qr-code",
        attribute: { id },
      }),
      Skeletons.Note({
        className: `${_ui_.fig.family}__text message`,
        content: LOCALE.SBX_SCAN_QR,
      })
    ]
  }
  return [
    Preset.Button.Close(_ui_),
    Skeletons.Box.Y({
      className: `${_ui_.fig.family}__container message`,
      debug: __filename,
      kids: content
    })
  ]
}
module.exports = __skl_sandbox_ack;