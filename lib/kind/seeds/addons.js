// On demand Classes cannot be overloaded

const Builtins = {};
const Ondemand = {};
window.KIND = {}

/**
 * 
 */
function register(kind, ref) {
  if (Builtins[kind]) {
    console.warn(`Kind ${kind} already registered, skipped.`);
    return;
  }
  if (_.isFunction(ref.then)) {
    Builtins[kind] = (s, f) => {
      ref.then((m) => {
        KIND[kind] = kind;
        s(m.default)
      }).catch(f)
    }
  }
}

/**
 * 
 * @param {*} name 
 * @returns 
 */
function get(name) {
  if (Builtins[name]) return new Promise(Builtins[name]);
  if (Ondemand[name]) return new Promise(Ondemand[name]);
  return null;
};

module.exports = { get, register };