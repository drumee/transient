module.exports = function(_ui_, opt, yes_opt){  
  if (opt == null) { opt = {}; }
  const confirmBtnClass = opt.confirmBtnClass || opt.confirmBtnAction || '';
  const cancelBtnClass = opt.cancelBtnClass || opt.cancelBtnAction || '';

  const a = Skeletons.Box.X({
    className: `${_ui_.fig.family}__buttons-wrapper buttons u-ai-center`,
    kids: [
      Skeletons.Note({
        service   : opt.cancelService || _e.closePopup,
        content   : opt.cancelLabel || LOCALE.CANCEL,
        uiHandler : _ui_, 
        className : `${_ui_.fig.family}__button-cancel ${cancelBtnClass} button-cancel button clickable`
      }),
      Skeletons.Note({
        content   : opt.confirmLabel || LOCALE.YES,
        service   : opt.confirmService || _e.submit,
        className : `${_ui_.fig.family}__button-confirm ${confirmBtnClass} button-confirm button clickable`,
        uiHandler : _ui_, 
        haptic    : 300,
        dataset   : {
          error   : 0
        }
      })
    ]
  });
  _.merge(a.kids[1], yes_opt);
  return a; 
}
