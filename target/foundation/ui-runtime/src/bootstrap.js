const { Context, Host, Organization, Visitor } = require("./context");
const { KindRegistry } = require("./kind");
const { Skeletons, staticKinds } = require("./skeletons");
const { Marionette } = require("./letc");
const { Template, createPreset } = require("./preset");
const { Validator } = require("./validator");

const runtimes = new WeakMap();

class PointerDragState {
  constructor() {
    this.value = false;
  }

  set(value) {
    this.value = Boolean(value);
    return this.value;
  }

  isDragging() {
    return this.value;
  }
}

function dispatchBootstrapEvent(documentRef, globalRef) {
  if (!documentRef || typeof documentRef.dispatchEvent !== "function") return null;
  const EventConstructor = globalRef.Event || globalThis.Event;
  const event = typeof EventConstructor === "function"
    ? new EventConstructor("drumee:bootstraping")
    : { type: "drumee:bootstraping" };
  event.name = "core";
  event.detail = { name: "core", runtime: "ui-runtime" };
  documentRef.dispatchEvent(event);
  return event;
}

class UiRuntime {
  constructor({ global = globalThis, document = global.document, host, visitor, organization, platform, env, validator, onBeforeReady, ...kindOptions } = {}) {
    this.global = global;
    this.document = document;
    this.options = { host, visitor, organization, platform, env, validator, onBeforeReady, kindOptions };
    this.Kind = new KindRegistry(kindOptions);
    this.ready = null;
    this.isReady = false;
  }

  bootstrap() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      this._initialize();
      if (typeof this.options.onBeforeReady === "function") await this.options.onBeforeReady(this);
      this.isReady = true;
      return this;
    })();
    this.Kind.setReady(this.ready);
    return this.ready;
  }

  _initialize() {
    this.Skeletons = Skeletons;
    this.Preset = createPreset(this.Skeletons);
    this.Template = Template;
    this.Validator = this.options.validator || Validator;
    this.pointerDrag = new PointerDragState();
    this.Platform = new Context(this.options.platform);
    this.Env = new Context(this.options.env);
    this.Host = new Host(this.options.host);
    this.Visitor = new Visitor(this.options.visitor);
    this.Organization = new Organization(this.options.organization);
    for (const [kind, Widget] of Object.entries(staticKinds)) this.Kind.registerStatic(kind, Widget);
    this.LetcBlank = staticKinds.wrapper;
    this.LetcBox = staticKinds.box;
    this.LetcList = staticKinds.list_smart;
    this.LetcText = staticKinds.note;
    this._publishGlobals();
    this.bootstrapEvent = dispatchBootstrapEvent(this.document, this.global);
  }

  _publishGlobals() {
    if (!this.global) return;
    Object.defineProperty(this.global, "pointerDragged", {
      configurable: true,
      enumerable: true,
      get: () => this.pointerDrag.isDragging(),
      set: (value) => this.pointerDrag.set(value)
    });
    Object.assign(this.global, {
      Preset: this.Preset,
      Template: this.Template,
      Skeletons: this.Skeletons,
      Validator: this.Validator,
      Kind: this.Kind,
      LetcBlank: this.LetcBlank,
      LetcBox: this.LetcBox,
      LetcList: this.LetcList,
      LetcText: this.LetcText,
      Platform: this.Platform,
      Env: this.Env,
      Host: this.Host,
      Visitor: this.Visitor,
      Organization: this.Organization
    });
  }

  createWidget(descriptor = {}) {
    const Widget = this.Kind.get(descriptor.kind);
    if (typeof Widget !== "function") throw new Error(`Kind ${descriptor.kind} is not renderable`);
    return new Widget({ runtime: this, ...descriptor });
  }

  mount(descriptor, parent) {
    const widget = this.createWidget(descriptor);
    if (!parent || typeof parent !== "object") throw new Error("A LETC Widget requires a DOM region");
    const region = new Marionette.Region({ el: parent });
    region.show(widget);
    widget.region = region;
    return widget;
  }
}

function bootstrap(options = {}) {
  const globalRef = options.global || globalThis;
  let runtime = runtimes.get(globalRef);
  if (!runtime) {
    runtime = new UiRuntime({ ...options, global: globalRef });
    runtimes.set(globalRef, runtime);
  }
  return runtime.bootstrap();
}

function getRuntime(globalRef = globalThis) {
  return runtimes.get(globalRef) || null;
}

function createRuntime(options = {}) {
  const runtime = new UiRuntime(options);
  runtime.bootstrap();
  return runtime;
}

module.exports = { PointerDragState, UiRuntime, bootstrap, createRuntime, getRuntime };
