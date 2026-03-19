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
    Registry[kind] = (s, f) => {
      ref.then((m) => {
        if (m.default) {
          s(m.default)
        }else{
          s(m)
        }
      }).catch((e)=>{
        console.warn(`Failed to register kind=${kind}`, e)
        f(e)
      })
    }
  }
}

/**
 * 
 * @param {*} name 
 * @returns 
 */
function get(name) {
  if (Registry[name]) return new Promise(Registry[name]);
  return null;
};


module.exports = { Registry, get, register };