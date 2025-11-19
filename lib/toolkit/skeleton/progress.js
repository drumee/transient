const __builder = require("../builder");
module.exports = function(props, style) {
  props = props || {};
  props.loader = props.loader || props.client || props.listener;
  props.name   = props.name   || props.filename || props.loader.get(_a.filename);
  const x = new __builder(props, style);
  const a = x.render({ kind:KIND.progress });
  if ((a.content == null)) {
    a.content = '';
  }
  return a;
}
