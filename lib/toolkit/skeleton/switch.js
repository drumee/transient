
const __builder = require("../builder");
module.exports = function (props, style) {
  if (_.isString(props)) {
    props = {
      content: props,
      className: ""
    };
  }
  if (_.isString(style) && _.isEmpty(props.className)) {
    props.className = style;
    style = {};
  }

  props = props || {};
  const x = new __builder(props, style);
  const a = x.render({ kind: KIND.button.switch });
  if ((a.content == null)) {
    a.content = '';
  }
  return a;
}