
module.exports = function (_ui_) {
  let a;
  const opt = _ui_.mget(_a.vendorOpt);
  const innerClass = _ui_.mget(_a.innerClass) || '';
  let state = 0;
  if (_ui_.mget(_a.initialState) != null) {
    state = _ui_.mget(_a.initialState);
  } else {
    state = _ui_.mget(_a.state);
  }

  return a = [
    Skeletons.Note({
      content: opt[0].label,
      className: `${_ui_.fig.family}__toggle off ${innerClass}`,
      uiHandler: [_ui_],
      state,
      index: 0
    }),
    Skeletons.Note({
      className: `${_ui_.fig.family}__toggle change`,
      state,
      uiHandler: [_ui_],
      service: _a.toggle
    }),
    Skeletons.Note({
      content: opt[1].label,
      className: `${_ui_.fig.family}__toggle on ${innerClass}`,
      // radio         : radio
      state,
      uiHandler: [_ui_],
      index: 1
    })
  ];
};
