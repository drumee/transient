
window._a = require("./lib/lex/attribute")
window._e = require("./lib/lex/event")
window._K = require("./lib/lex/constants")
window._T = require('./lib/lex/template');
window.WARNING = require('./lib/lex/warning');
window.ERROR = require('./lib/lex/error');

require("backbone");
window.Marionette = require("backbone.marionette");

if (!window.Kind) {
  const { KindRegistry } = require("./lib/kind")
  window.Kind = new KindRegistry();

  window.Preset = {
    Button: require('./lib/preset/button'),
    ConfirmButtons: require('./lib/preset/confirm-buttons'),
    List: require('./lib/preset/list-stream'),
    Utils: require('./lib/preset/utils')
  };

  window.Template = require('./lib/preset/template');
  window.Skeletons = require('./lib/toolkit');
  window.Websocket = null;

  window.Platform = new Backbone.Model();
  window.Env = new Backbone.Model();
  window.Host = require('./lib/host')();
  window.Visitor = require('./lib/user')();
  window.Organization = require('./lib/organization')();
}


