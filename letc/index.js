const { validator, createSafeObject } = require("@drumee/ui-essentials");
const builtin_kinds =
{
  "chart": {
    "line": "chart_line",
    "pie": "chart_pie",
    "sline": "chart_sline"
  },
  "image": {
    "box": "image_box",
    "canvas": "image_canvas",
    "core": "image_core",
    "cropper": "image_cropper",
    "raw": "image_raw",
    "reader": "image_reader",
    "smart": "image_smart",
    "svg": "image_svg"
  },
  "list": {
    "smart": "list_smart",
    "table": "list_table"
  },
  "media": {
    "audio": "media_image",
    "document": "media_document",
    "folder": "media_folder",
    "helper": "media_helper",
    "image": "media_image",
    "preview": "media_preview",
    "thread": "media_thread",
    "ui": "media_ui",
    "video": "media_video"
  },
  "menu": {
    "base": "menu",
    "topic": "menu_topic",
    "wrapper": "menu_wrapper"
  },
  "svg": {
    "gradient_circle": "svg_gradient_circle",
    "circle_percent": "svg_circle_percent",
    "line": "svg_line",
    "path": "svg_path"
  }
}

let _lpreoad = function () { }

/**
 * 
 */
function export_globals(resolve) {
  console.log(`Loading Drumee Core...`, document.readyState);
  window.KIND = createSafeObject(builtin_kinds);

  window.Preset = {
    Button: require('./preset/button'),
    ConfirmButtons: require('./preset/confirm-buttons'),
    List: require('./preset/list-stream'),
    Utils: require('./preset/utils')
  };

  window.Template = require('./preset/template');
  window.Skeletons = require('./toolkit/skeletons').Skeletons;
  window.Websocket = null;

  window.Validator = validator;
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
