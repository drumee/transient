const __icon = require("../../builder/button/label");
module.exports = function(props, style) {
  const x = new __icon(props, style);
  return x.render({
    kind : KIND.image.svg
  });
}