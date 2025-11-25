const __builder = require("../builder");

const __skl_note = function (props, style) {
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
  const a = x.render({ kind: 'blank' });
  return a;
};

module.exports = __skl_note;