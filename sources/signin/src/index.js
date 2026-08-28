

/**
 * Load Drumee rendering engine (LETC)
 * Work from electron
 * @param {*} e 
 */
function start() {
  Kind.registerAddons(require("./seeds"));
}

const { loadWidgets } = require("@drumee/ui-toolkit");
loadWidgets()

if (document.readyState == 'complete') {
  start()
} else {
  if (location.hash) {
    document.addEventListener('drumee:plugins:ready', start);
  } else {
    document.addEventListener('drumee:router:ready', start);
  }
}
