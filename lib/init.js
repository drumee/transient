
window._a = require("./lex/attribute")
window._e = require("./lex/event")
window._K = require("./lex/constants")
window._T = require('./lex/template');
window.WARNING = require('./lex/warning');
window.ERROR = require('./lex/error');

require("backbone");
window.Marionette = require("backbone.marionette");

if (!window.Kind) {
  const { KindRegistry } = require("./kind")
  window.Kind = new KindRegistry();

  window.Preset = {
    Button: require('./preset/button'),
    ConfirmButtons: require('./preset/confirm-buttons'),
    List: require('./preset/list-stream'),
    Utils: require('./preset/utils')
  };

  window.Template = require('./preset/template');
  window.Skeletons = require('./toolkit');
  window.Websocket = null;

  window.Platform = new Backbone.Model();
  window.Env = new Backbone.Model();
  window.Host = require('./host')();
  window.Visitor = require('./user')();
  window.Organization = require('./organization')();
}


