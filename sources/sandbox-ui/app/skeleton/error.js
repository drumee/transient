// ============================================================ *
//   Copyright Xialia.com  2011-2024
//   FILE : /Users/somanos/devel/sandbox-ui/app/main/skeleton/index.js
//   TYPE : Skelton
// ============================================================**/

/**
 * 
 * @param {*} _ui_ 
 * @returns 
 */
function __skl_error(_ui_, error) {
  const timer = { 
    kind: "countdown_timer",
    in: 60,
    service:"reload",
    className: `${_ui_.fig.family}__error timer`,
  };

  const content = Skeletons.Box.Y({
    className: `${_ui_.fig.family}__error content`,
    kids: [
      Skeletons.Note({
        className: `${_ui_.fig.family}__error message`,
        content: error,
      }),
      timer,
      Skeletons.Note({
        className: `${_ui_.fig.family}__error button`,
        content: LOCALE.REFRESH,
        service: "reload"
      })
    ]
  });
  return Skeletons.Box.Y({
    className: `${_ui_.fig.family}__error main`,
    debug: __filename,
    kids: content
  })

}
module.exports = __skl_error;