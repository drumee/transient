const __core = require("../../builder");
module.exports = function(props, style) {
  props = props || {};
  props.flow = _a.none;
  const x = new __core(props, style);
  const a = x.render({
    kind : KIND.box,
    flow : 'g'
  });
  return a;
}