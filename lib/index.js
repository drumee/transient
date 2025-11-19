
/**
 * 
 * @returns Initialize golabls and singletons
 */
export function Init() {
  if (window.Kind) return
  window.WARNING = require('lex/warning');
  window.ERROR = require('lex/error');
  window._a = require('lex/attribute');
  window._K = require('lex/constants');
  window._T = require('lex/template');
  window._e = require('lex/event');

  require('./addons');

  const { KindRegistry } = require("./kind")
  window.Kind = new KindRegistry();

  window.Preset = {
    Button: require('./preset/button'),
    ConfirmButtons: require('./preset/confirm-buttons'),
    List: require('./preset/list-stream'),
    Utils: require('./preset/utils')
  };

  window.Template = require('./preset/template');
  window.Skeletons = require('./toolkit/skeletons');
  window.Websocket = null;

  window.Platform = new Backbone.Model();
  window.Env = new Backbone.Model();
  window.Host = require('./host')();
  window.Visitor = require('./user')();
  window.Organization = require('./organization')();
}

export * from './utils/constants';
export * from './utils/contextmenu';
export * from './utils/index';
export * from './utils/validator';
export * from './socket/pipe';
export * from './socket/promise';
export * from './socket/request';
export * from './socket/service';
export * from './socket/upload';
export * from './socket/utils';
