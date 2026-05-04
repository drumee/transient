
const __core = require("../builder");

module.exports = function(props, style) {
  props = props || {};
  props.flow = _a.none;
  const x = new __core(props, style);
  return x.render({
    kind : "box",
    flow : 'g'
  });
};
