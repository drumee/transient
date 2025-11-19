module.exports = function(_ui_){
  let a, state;
  const opt   = _ui_.mget(_a.vendorOpt);
  const radio = `switch:${_ui_.cid}`;
  if (_ui_.mget(_a.initialState) != null) {
    state = _ui_.mget(_a.initialState);
  } else { 
    state = _ui_.mget(_a.state) || 0;
  }
  opt[0].state = state;
  opt[1].state = state^1;

  return a = [
    Skeletons.Note({
      content       : opt[0].label,
      className     : `editbox-toggle editbox-toggle--left ${_ui_.fig.family}__toggle left`,
      radio,
      uiHandler     : _ui_,
      index         : 0
    }),
    Skeletons.Note({
      content       : opt[1].label,
      className     : `editbox-toggle editbox-toggle--right ${_ui_.fig.family}__toggle right`,
      radio,
      uiHandler     : _ui_,
      index         : 1
    })
  ];
};
