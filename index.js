
let loaded = 0;
function start() {
  if (loaded) return;
  Kind.registerAddons({
    'dtk_otp': import('./widgets/otp'),
    'dtk_dialog': import('./widgets/dialog'),
    'dtk_pwsetter': import('./widgets/pwsetter'),
  })
  loaded = 1;
}


/**
 * 
 */
export function loadWidgets() {
  if (document.readyState == 'complete') {
    start()
  } else {
    if (location.hash) {
      document.addEventListener('drumee:plugins:ready', start);
    } else {
      document.addEventListener('drumee:router:ready', start);
    }
  }
}

export * from './utils/index';
export * from './utils/validator';
export * from './utils/contextmenu';
