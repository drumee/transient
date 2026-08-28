// Cherry-picked GSAP entry point.
//
// Imports only gsap-core (engine + standard eases) and CSSPlugin (transforms,
// opacity, left/top).  Everything else — ScrollTrigger, Draggable, MotionPath,
// EasePack, Flip, etc. — is intentionally excluded.
//
// Using ES-module import statements here lets the consuming app's bundler
// (webpack 5 / rollup) resolve the source files directly instead of the
// pre-compiled dist/gsap.js, enabling dead-code elimination across the two
// ~65 KB source modules.
//
// CJS consumers: require('./vendor/gsap') returns the module namespace;
// webpack/rollup expose the default export directly via their CJS interop so
// `require('…/vendor/gsap')` works unchanged.
// GSAP v2 ease namespaces → v3 string eases

const Expo = {
  get easeOut() { return "expo.out"; },
  get easeIn() { return "expo.in"; },
  get easeInOut() { return "expo.inOut"; },
};

const Cubic = {
  get easeOut() { return "power3.out"; },
  get easeIn() { return "power3.in"; },
  get easeInOut() { return "power3.inOut"; },
};

const Linear = {
  get easeNone() { return "none"; },
  get easeIn() { return "none"; },
  get easeOut() { return "none"; },
  get easeInOut() { return "none"; },
};

function getTarget(t) {
  if (!t) return t;
  if (t.jquery) return t.get(0);
  if (t[0] && t[0].nodeType) return t[0];
  return t;
}

// GSAP v2 property aliases → v3 names
function translateKey(k) {
  if (k === 'alpha') return 'opacity';
  if (k === 'rotationX') return 'rotateX';
  if (k === 'rotationY') return 'rotateY';
  if (k === 'rotationZ') return 'rotateZ';
  return k;
}

function translateVars(vars) {
  const out = {};
  for (const [k, v] of Object.entries(vars)) out[translateKey(k)] = v;
  return out;
}

// GSAP v2 API: to(target, duration, vars) → v3: to(target, {duration, ...vars})
const TweenMax = {
  to(target, duration, vars) {
    return gsap.to(getTarget(target), { duration, ...translateVars(vars) });
  },
  fromTo(target, duration, fromVars, toVars) {
    return gsap.fromTo(getTarget(target), translateVars(fromVars), { duration, ...translateVars(toVars) });
  },
  set(target, vars) {
    return gsap.set(getTarget(target), translateVars(vars));
  },
};

const TweenLite = TweenMax;

class TimelineMax {
  constructor() {
    this._tl = gsap.timeline();
  }
  to(target, duration, vars) {
    this._tl.to(getTarget(target), { duration, ...translateVars(vars) });
    return this;
  }
}

import { gsap } from 'gsap/gsap-core';
import { CSSPlugin } from 'gsap/CSSPlugin';

gsap.registerPlugin(CSSPlugin);

export default gsap;
export { gsap };
export { TweenMax, TweenLite, TimelineMax, Expo, Cubic, Linear }