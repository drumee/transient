const Avatar = require("../builder/avatar");

module.exports = function (ava, cn, name) {
  let a;
  const avatar = new Avatar(ava, cn, name);

  if (/default/.test(ava)) {
    return avatar.color();
  }
  return avatar.render();
};


