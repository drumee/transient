

module.exports = function (ui, opt, yes_opt) {

  if (opt == null) { opt = {}; }
  const confirmBtnClass = opt.confirmBtnClass || opt.confirmBtnAction || '';
  const cancelBtnClass = opt.cancelBtnClass || opt.cancelBtnAction || '';

  return Skeletons.Box.X({
    className: `${ui.fig.family}__buttons-wrapper buttons u-ai-center`,
    kids: [
      Skeletons.Note({
        service: opt.cancelService || _e.closePopup,
        content: opt.cancelLabel || LOCALE.CANCEL,
        uiHandler: ui,
        className: `${ui.fig.family}__button-cancel ${cancelBtnClass} button-cancel button clickable`,
        ...yes_opt
      }),
      Skeletons.Note({
        content: opt.confirmLabel || LOCALE.YES,
        service: opt.confirmService || _e.submit,
        className: `${ui.fig.family}__button-confirm ${confirmBtnClass} button-confirm button clickable`,
        uiHandler: ui,
        haptic: 300,
        dataset: {
          error: 0
        }
      })
    ]
  });
};;
