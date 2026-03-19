const { createSafeObject } = require("@drumee/ui-toolkit");

let _lpreoad = function () { }

/**
 * 
 */
function export_globals(resolve) {
  console.log(`Loading Drumee Core...`, document.readyState);
  window.KIND = createSafeObject();

  window.Preset = {
    Button: require('./preset/button'),
    ConfirmButtons: require('./preset/confirm-buttons'),
    List: require('./preset/list-stream'),
    Utils: require('./preset/utils')
  };

  window.Template = require('./preset/template');
  window.Skeletons = require('./toolkit/skeletons');
  window.Websocket = null;

  window.Validator = require('@drumee/ui-essentials').validator
  window.Kind = require("./kind");
  window.pointerDragged = false;
  window.LetcBlank = require("./widgets/blank");
  window.LetcBox = require("./widgets/box");
  window.LetcList = require("./widgets/list/smart");
  window.LetcText = require("./widgets/text");

  window.Platform = new Backbone.Model();
  window.Env = new Backbone.Model();
  window.Host = require('./host')();
  window.Visitor = require('./user')();
  window.Organization = require('./organization')();
  window.DrumeeMFS = require('./mfs');
  const event = new Event('drumee:bootstraping');
  event.name = 'core'
  document.dispatchEvent(event);
  document.removeEventListener('drumee:bootstraping', _lpreoad)
  resolve(event)
}

/**
 * 
 * @param {*} e 
 */
function _load(e, resolve) {
  /** Wait for the locale module to be loaded */
  if (e.name !== 'locale' || window.Kind) return
  require("lodash");
  window.jQuery = require("jquery");
  window.$ = window.jQuery;
  window.Marionette = require("backbone.marionette");
  require("jquery-ui/ui/widgets/droppable");
  require("jquery-ui/ui/widgets/resizable");
  require('./addons');
  if (document.readyState == 'complete') {
    export_globals(resolve)
  } else {
    document.addEventListener('readystatechange', () => {
      if (document.readyState == 'complete') { export_globals(resolve) }
    }, false);
  }
}


/**
 * 
 */
export function load() {
  return new Promise((resolve) => {
    _lpreoad = (e) => {
      _load(e, resolve)
    }
    document.addEventListener('drumee:bootstraping', _lpreoad)
  })
}
