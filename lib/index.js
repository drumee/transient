
window._a = require("./lex/attribute")
window._e = require("./lex/event")
window._K = require("./lex/constants")
window._T = require('./lex/template');
window.WARNING = require('./lex/warning');
window.ERROR = require('./lex/error');

require('./addons');

export * from './utils/constants';
export * from './utils/contextmenu';
export * from './utils/index';
export * from './utils/validator';
// export * from './socket/pipe';
export * from './socket/promise';
export * from './socket/request';
export * from './socket/service';
export * from './socket/upload';
export * from './socket/utils';
// export * from './widgets';

export const Attr = _a;
export const Const = _K;
export const Evts = _e;

// export *  from "./widgets/box";
/**
 * 
 * @returns Initialize golabls and singletons
 */
export function Init() {
  if (window.Kind) return


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

const widgets = require("./widgets");
export function LetcAvatar() { return widgets.Avatar };
export function LetcBlank() { return widgets.LetcBlank };
export function LetcBox() { return widgets.LetcBox };
export function LetcImageSmart() { return widgets.ImageSmart };
export function LetcImageSvg() { return widgets.ImageSvg };
export function LetcList() { return widgets.LetcList };
export function LetcMenu() { return widgets.LetcMenu };
export function LetcProgress() { return widgets.Progress };
export function LetcSmartList() { return widgets.LetcList.Smart };
export function LetcSpinner() { return widgets.Spinner };
export function LetcSvg() { return widgets.Svg };
export function LetcTableList() { return widgets.LetcList.Table };
export function LetcText() { return widgets.LetcText };
