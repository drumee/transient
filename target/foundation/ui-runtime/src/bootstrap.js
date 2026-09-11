const { Context, Host, Organization, Visitor } = require("./context");
const { KindRegistry } = require("./kind");
const { loadBrowserScript } = require("./loader");
const { Skeletons, staticKinds } = require("./skeletons");
const { Marionette } = require("./letc");
const { Template, createPreset } = require("./preset");
const { ServiceClient, updateSessionAuthorization } = require("./service");
const { Validator } = require("./validator");
const { Websocket } = require("./websocket");

const runtimes = new WeakMap();

function runtimeAssetUrl(value, serviceBase) {
  if (typeof value !== "string" || !value) return value;
  if (!/^https?:\/\//i.test(String(serviceBase || "")) || !value.startsWith("/")) return value;
  return new URL(value, serviceBase).toString();
}

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
  constructor({ global = globalThis, document = global.document, host, visitor, organization, platform, env, validator, onBeforeReady, serviceClient, serviceBase, serviceCredentials, sessionAuthorization, fetch: fetchImpl, websocket, websocketUrl, WebSocket, ...kindOptions } = {}) {
    this.global = global;
    this.document = document;
    this.options = { host, visitor, organization, platform, env, validator, onBeforeReady, kindOptions };
    this.serviceClient = serviceClient || new ServiceClient({
      baseUrl: serviceBase || "/-/svc/",
      fetch: fetchImpl || (global && typeof global.fetch === "function" ? global.fetch.bind(global) : undefined),
      credentials: serviceCredentials,
      sessionAuthorization
    });
    const bootstrapPlugin = kindOptions.bootstrapPlugin || ((name) => this.serviceClient.fetchService("bootstrap.plugin", { name }));
    const loadJS = kindOptions.loadJS || ((path) => loadBrowserScript(runtimeAssetUrl(path, serviceBase), {
      document: this.document,
      XMLHttpRequest: global && global.XMLHttpRequest
    }));
    this.Kind = new KindRegistry({ ...kindOptions, bootstrapPlugin, loadJS });
    this.Websocket = websocket || new Websocket({ global, url: websocketUrl, serviceClient: this.serviceClient, WebSocket });
    this.ready = null;
    this.isReady = false;
    // This is deliberately a write-only, non-replaceable bootstrap boundary.
    // A server-side rotation can be followed by its embedding/runtime owner,
    // while a Widget cannot wrap the method to observe a future raw bridge.
    Object.defineProperty(this, "setSessionAuthorization", {
      configurable: false,
      enumerable: false,
      writable: false,
      value: (authorization) => {
        if (this.serviceClient instanceof ServiceClient) {
          updateSessionAuthorization(this.serviceClient, authorization);
        } else if (this.serviceClient && typeof this.serviceClient.setSessionAuthorization === "function") {
          // An explicitly injected transport is owned by its caller; retain
          // its established update contract without making it kernel state.
          this.serviceClient.setSessionAuthorization(authorization);
        } else {
          throw new Error("The configured service transport cannot update session authorization");
        }
        return this;
      }
    });
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
      Organization: this.Organization,
      Websocket: this.Websocket
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
  } else if (Object.hasOwn(options, "sessionAuthorization")) {
    runtime.setSessionAuthorization(options.sessionAuthorization);
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

module.exports = { PointerDragState, UiRuntime, bootstrap, createRuntime, getRuntime, runtimeAssetUrl };
