const Avatar = require("../builder/avatar");

const __avatar_skl = function(ava, cn, name) {
  let a;
  const avatar = new Avatar(ava, cn, name);

  if (/default/.test(ava)) {
    a = avatar.color();
  } else {
    a = avatar.render();
  }

  return a;
};

module.exports = __avatar_skl;

