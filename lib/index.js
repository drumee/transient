require('./addons');

export * from './utils/constants';
export * from './utils/contextmenu';
export * from './utils/index';
export * from './utils/validator';
export * from './socket/promise';
export * from './socket/request';
export * from './socket/service';
export * from './socket/upload';
export * from './socket/utils';
export * from './widgets/blank';
export * from './widgets/box';

export const Attr = _a;
export const Const = _K;
export const Evts = _e;

const widgets = require("./widgets")
export function LetcAvatar() { return widgets.Avatar };
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
