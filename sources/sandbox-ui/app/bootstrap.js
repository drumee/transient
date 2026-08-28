/* ==================================================================== *
*   Copyright xialia.com  2011-2023
* ==================================================================== */


async function preloadKinds() {
  Kind.registerAddons({
    'sandbox_user' : import('./user/index.js'),
  });
}

/**
 * Load Drumee rendering engine (LETC)
 * Work from electron
 * @param {*} e 
 */
async function start(e) {
  console.log(`Loading Sandbox 21`);
  document.removeEventListener('drumee:ready', start);
  let el = document.getElementById("loader-spinner");
  el && el.remove();
  const main = require(".");
  const lang = LOCALE.__currentLanguage || navigator.language;
  const locale = require('./locale')(lang);
  LOCALE = { ...LOCALE, ...locale };
  LOCALE.INTRO_POPUP_TITLE = LOCALE.SBX_INTRO_POPUP_TITLE;
  let kind = 'sandbox';
  await preloadKinds();
  Kind.register(kind, main);
  Kind.waitFor(kind).then((k) => {
    uiRouter.ensurePart(_a.body).then((p)=>{
      p.feed({ kind });
    })
  })

}
document.addEventListener('drumee:router:ready', start);
