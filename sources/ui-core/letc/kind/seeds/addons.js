// On demand Classes cannot be overloaded

const Registry = {}

/**
 * 
 */
function register(kind, ref) {
  if (Registry[kind]) {
    return;
  }
  if (_.isFunction(ref.then)) {
    Registry[kind] = new Promise((s, f) => {
      ref.then((m) => {
        if (m.default) {
          s(m.default)
        } else {
          s(m)
        }
      }).catch((e) => {
        console.warn(`Failed(21) to register kind=${kind}`, e)
        f(e)
      })
    })
  } else if (_.isFunction(ref)) {
    Registry[kind] = ref
  }

}

/**
 * 
 * @param {*} name 
 * @returns 
 */
function get(name) {
  if (Registry[name]) return Registry[name];
  return null;
};


module.exports = { Registry, get, register };