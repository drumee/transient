const __builder = require("../../builder");

const __skl_note = function(props, style) {
  props = _.merge({autocomplete: _a.off}, props);
  const x = new __builder(props, style);
  const a = x.render({ kind:'entry', type:_a.textarea});
  return a;
};

module.exports = __skl_note;