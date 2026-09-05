/*
 * Non-MFS LETC compatibility substrate.
 *
 * This is a selective CJS extraction from ui-core's `letc/addons/**` and
 * `widgets/box`.  It deliberately keeps Marionette's real View and
 * CollectionView lifecycle instead of providing a descriptor renderer.
 */
const Backbone = require("backbone");
const Marionette = require("backbone.marionette");
const jquery = require("jquery");
const _ = require("lodash");

Backbone.$ = jquery;

const ATTR = Object.freeze({
  active: "active",
  alt: "alt",
  bubble: "bubble",
  className: "className",
  content: "content",
  flow: "flow",
  kind: "kind",
  kids: "kids",
  name: "name",
  renderer: "renderer",
  style: "style",
  styleOpt: "styleOpt",
  sysPn: "sys_pn",
  value: "value",
  widgetId: "widgetId"
});

function normalizeOptions(options = {}) {
  if (options.model instanceof Backbone.Model) return { ...options };
  const attributes = { ...options };
  delete attributes.runtime;
  delete attributes.region;
  delete attributes.collection;
  return { ...options, model: new Backbone.Model(attributes) };
}

function initializeView(view, options = {}) {
  view.runtime = options.runtime || view.options.runtime;
  view._id = view._id || _.uniqueId("letc-");
  view.model.atLeast = view.model.atLeast || function atLeast(attributes = {}) {
    for (const [name, value] of Object.entries(attributes)) {
      if (this.get(name) == null) this.set(name, value);
    }
    return this;
  };
  view.model.set(ATTR.widgetId, view._id);
  const suppliedFig = view.model.get("fig");
  const figName = view.figName || view.constructor.figName || view.constructor.name || "letc_widget";
  const family = figName.replace(/^_+/, "").replace(/_/g, "-");
  const [group, ...rest] = family.split("-");
  view.fig = { group, family, name: rest.join("-") || family, ...(suppliedFig || {}) };
  view._branches = {};
}

function applyViewState(view) {
  const className = view.mget(ATTR.className) || view.nativeClassName;
  if (className) view.el.className = className;
  const flow = view.mget(ATTR.flow);
  if (flow != null) view.el.dataset.flow = flow;
  const sysPn = view.mget(ATTR.sysPn);
  if (sysPn) view.el.dataset.sysPn = sysPn;
  const style = view.mget(ATTR.styleOpt) || view.mget(ATTR.style) || {};
  if (style && typeof style === "object") view.$el.css(style);
}

class LetcView extends Marionette.View {
  constructor(options = {}) {
    super(normalizeOptions(options));
  }

  initialize(options = {}) {
    initializeView(this, options);
  }

  get template() {
    return false;
  }

  mget(name) {
    return this.model.get(name);
  }

  mset(name, value, options) {
    return this.model.set(name, value, options);
  }

  get(name) {
    return this.model.get(name) ?? this.getOption(name);
  }

  declareHandlers(options = {}) {
    this._handledEvents = { part: "single", ui: "single", ...options };
    return this._handledEvents;
  }

  onRender() {
    applyViewState(this);
    this.onDomRefresh();
  }

  onDomRefresh() {}

  waitElement(element, handler) {
    const target = typeof element === "string" ? this.el.ownerDocument.getElementById(element) : element;
    if (target) return Promise.resolve(handler(target));
    return Promise.resolve(null);
  }

  renderPseudo() {}

  registerPart(child, name) {
    this._branches[name] = child;
    child.el.dataset.partname = name;
    this[`__${_.camelCase(name)}`] = child;
    this.triggerMethod("part:ready", child, name);
    return child;
  }
}

class LetcBox extends Marionette.CollectionView {
  constructor(options = {}) {
    const normalized = normalizeOptions(options);
    const kids = normalized.collection || new Backbone.Collection(normalizeKids(normalized.kids));
    super({ ...normalized, collection: kids });
  }

  initialize(options = {}) {
    initializeView(this, options);
    this.collection = this.collection || new Backbone.Collection();
    this.escapeContextmenu = Boolean(this.mget("escapeContextmenu"));
  }

  get template() {
    return false;
  }

  mget(name) {
    return this.model.get(name);
  }

  mset(name, value, options) {
    return this.model.set(name, value, options);
  }

  get(name) {
    return this.model.get(name) ?? this.getOption(name);
  }

  declareHandlers(options = {}) {
    this._handledEvents = { part: "single", ui: "single", ...options };
    return this._handledEvents;
  }

  childView(model) {
    const Widget = this.runtime && this.runtime.Kind.get(model.get(ATTR.kind));
    if (!Widget) throw new Error(`Unknown static LETC kind: ${model.get(ATTR.kind)}`);
    return Widget;
  }

  childViewOptions(model) {
    return { ...model.toJSON(), model, runtime: this.runtime };
  }

  buildChildView(model, ChildViewClass, options) {
    const child = new ChildViewClass({ ...options, model, runtime: this.runtime });
    child.parent = this;
    return child;
  }

  onRender() {
    applyViewState(this);
    this.onDomRefresh();
  }

  onAddChild(child) {
    child.parent = this;
    const part = child.mget(ATTR.sysPn);
    if (part) this.registerPart(child, part);
  }

  onDomRefresh() {}

  feed(content) {
    if (!content) return this.children.last();
    const resolved = typeof content === "function" ? content(this) : content;
    const descriptors = normalizeKids(resolved);
    this.collection.set(descriptors);
    return this.children.last();
  }

  append(content) {
    this.collection.add(normalizeKids(content));
    return this.children.last();
  }

  prepend(content) {
    this.collection.add(normalizeKids(content), { at: 0 });
    return this.children.first();
  }

  clear() {
    this.collection.reset();
  }

  isEmpty() {
    return this.collection.length === 0;
  }

  getPart(name) {
    return this._branches[name];
  }

  registerPart(child, name) {
    this._branches[name] = child;
    child.el.dataset.partname = name;
    this[`__${_.camelCase(name)}`] = child;
    this.triggerMethod("part:ready", child, name);
    return child;
  }
}

function normalizeKids(value) {
  if (!value) return [];
  const list = Array.isArray(value) ? value : [value];
  return list.filter((entry) => entry && entry.kind);
}

module.exports = {
  ATTR,
  Backbone,
  LetcBox,
  LetcView,
  Marionette,
  _,
  normalizeKids
};
