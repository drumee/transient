const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const {
  Context,
  Host,
  KindRegistry,
  LetcBlank,
  LetcBox,
  LetcList,
  LetcProfile,
  LetcProgress,
  LetcText,
  Marionette,
  Organization,
  ServiceClient,
  Skeletons,
  UiRuntime,
  Visitor,
  Websocket,
  bootstrap,
  retainedSkeletonCatalog,
  excludedSkeletonCatalog,
  sourceIdentity
} = require("../src");
const { sessionAuthorizationHeaders } = require("../src/service");
const { runtimeAssetUrl } = require("../src/bootstrap");

function createBootstrapTarget() {
  const document = new EventTarget();
  document.readyState = "complete";
  return { document, Event };
}

test("Kind registry registers, finds and reports missing kinds", () => {
  const kind = new KindRegistry();
  class Widget {}
  assert.equal(kind.register("probe_widget", Widget), Widget);
  assert.equal(kind.exists("probe_widget"), true);
  assert.equal(kind.get("probe_widget"), Widget);
  assert.equal(kind.get("missing"), null);
  assert.equal(kind.register("probe_widget", class Ignored {}), undefined);
});

test("addon registration emits the historical addons:registered handshake", () => {
  const kind = new KindRegistry();
  let events = 0;
  kind.on("addons:registered", () => events++);
  class Widget {}
  kind.registerAddons({ addon_widget: Widget });
  assert.equal(kind.exists("addon_widget"), true);
  assert.equal(kind.get("addon_widget"), Widget);
  assert.equal(events, 1);
});

test("plugin loading skips an existing kind only after bootstrap is ready", async () => {
  let calls = 0;
  class Existing {}
  const kind = new KindRegistry({ bootstrapPlugin: async () => { calls++; return { path: "/ignored" }; } });
  kind.register("existing", Existing);
  kind.setReady(Promise.resolve());
  assert.equal(await kind.loadPlugin({ name: "ignored", kind: "existing" }), Existing);
  assert.equal(calls, 0);
});

test("plugin loading preserves bootstrap.plugin → loadJS → registerAddons", async () => {
  const paths = [];
  let kind;
  class Widget {}
  kind = new KindRegistry({
    bootstrapPlugin: async (name) => ({ path: `/-/plugins/${name}/main.js` }),
    loadJS: async (loadedPath) => {
      paths.push(loadedPath);
      kind.registerAddons({ probe_widget: Widget });
    }
  });
  kind.setReady(Promise.resolve());
  assert.equal(await kind.loadPlugin({ name: "probe", kind: "probe_widget" }), Widget);
  assert.deepEqual(paths, ["/-/plugins/probe/main.js"]);
  assert.equal(await kind.loadPlugin({ name: "probe", kind: "probe_widget" }), Widget);
  assert.deepEqual(paths, ["/-/plugins/probe/main.js"]);
});

test("plugin transport and bundle failures reject cleanly", async () => {
  const rejectedTransport = new KindRegistry({ bootstrapPlugin: async () => { throw new Error("transport failed"); } });
  rejectedTransport.setReady(Promise.resolve());
  await assert.rejects(rejectedTransport.loadPlugin({ name: "probe", kind: "probe_widget" }), /transport failed/);
  const rejectedBundle = new KindRegistry({
    bootstrapPlugin: async () => ({ path: "/broken.js" }),
    loadJS: async () => { throw new Error("bundle failed"); }
  });
  rejectedBundle.setReady(Promise.resolve());
  await assert.rejects(rejectedBundle.loadPlugin({ name: "probe", kind: "probe_widget" }), /bundle failed/);
});

test("generic service transport preserves logical module.method requests and Drumee envelopes", async () => {
  const calls = [];
  const client = new ServiceClient({
    baseUrl: "/-/svc/",
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: { message: "Hello from Drumee" } }) };
    }
  });
  assert.deepEqual(await client.fetchService("bootstrap.plugin", { name: "hello" }), { message: "Hello from Drumee" });
  assert.deepEqual(await client.postService("hello.ping", {}), { message: "Hello from Drumee" });
  assert.equal(calls[0].url, "/-/svc/bootstrap.plugin?name=hello");
  assert.equal(calls[0].options.method, "GET");
  assert.equal(calls[1].url, "/-/svc/hello.ping");
  assert.equal(calls[1].options.body, "{}");
});

test("service client preserves the historical x-param session authorization bridge", async () => {
  const calls = [];
  const client = new ServiceClient({
    baseUrl: "https://api.kernel.test/-/svc/",
    sessionAuthorization: { keysel: "regsid", sid: "authorized-session-0001" },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: { token: "opaque" } }) };
    }
  });
  assert.deepEqual(sessionAuthorizationHeaders({ sid: "authorized-session-0001" }), {
    "x-param-keysel": "regsid",
    "x-param-regsid": "authorized-session-0001"
  });
  await client.postService("bootstrap.authn", {});
  assert.equal(calls[0].options.headers["x-param-keysel"], "regsid");
  assert.equal(calls[0].options.headers["x-param-regsid"], "authorized-session-0001");
  assert.equal(Object.hasOwn(calls[0].options.headers, "Authorization"), false);
  assert.equal(Object.hasOwn(client, "sessionAuthorization"), false);
  assert.equal(client.sessionAuthorization, undefined);
  assert.equal(Object.hasOwn(client, "fetch"), false);
  assert.equal(client.fetch, undefined);
  assert.equal(runtimeAssetUrl("/-/plugins/hello/main.js", "https://api.kernel.test/-/svc/"), "https://api.kernel.test/-/plugins/hello/main.js");
  assert.equal(runtimeAssetUrl("/-/plugins/hello/main.js", "/-/svc/"), "/-/plugins/hello/main.js");
});

test("runtime session bridge stays private while its transport still emits it", async () => {
  const sid = "widget-secret-session-0001";
  const calls = [];
  const target = createBootstrapTarget();
  const runtime = new UiRuntime({
    global: target,
    document: target.document,
    sessionAuthorization: { keysel: "regsid", sid },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: {} }) };
    }
  });
  await runtime.bootstrap();
  assert.equal(runtime.sessionAuthorization, undefined);
  assert.equal(runtime.options.sessionAuthorization, undefined);
  assert.equal(runtime.serviceClient.sessionAuthorization, undefined);
  assert.equal(runtime.regsid, undefined);
  assert.equal(runtime.serviceClient.regsid, undefined);
  assert.equal(typeof runtime.getSessionAuthorization, "undefined");
  assert.equal(typeof runtime.serviceClient.getSessionAuthorization, "undefined");
  assert.doesNotMatch(JSON.stringify({ runtime: runtime.options }), new RegExp(sid));
  await runtime.serviceClient.postService("bootstrap.authn", {});
  assert.equal(calls[0].options.headers["x-param-regsid"], sid);
});

test("a plugin-facing Widget context cannot intercept the private service transport or read the bridge", async () => {
  const sid = "widget-secret-session-0002";
  const calls = [];
  const target = createBootstrapTarget();
  const runtime = new UiRuntime({
    global: target,
    document: target.document,
    sessionAuthorization: { keysel: "regsid", sid },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: { ok: true } }) };
    }
  });
  await runtime.bootstrap();
  // This is the exact runtime/options/model surface supplied to a LETC Widget;
  // browser integration below exercises the same check through Hello itself.
  const widget = {
    runtime,
    options: { runtime },
    model: { get() { return undefined; } },
    postService(service, payload) { return this.runtime.serviceClient.postService(service, payload); }
  };
  let intercepted = false;
  runtime.serviceClient.fetch = (url, options) => {
    intercepted = Boolean(options && options.headers && options.headers["x-param-regsid"]);
    throw new Error("a Widget must not replace the private transport");
  };
  await widget.postService("hello.ping", {});
  assert.equal(intercepted, false);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.headers["x-param-regsid"], sid);
  const readable = [
    runtime.regsid,
    runtime.sessionAuthorization,
    runtime.options.regsid,
    runtime.options.sessionAuthorization,
    runtime.serviceClient.regsid,
    runtime.serviceClient.sessionAuthorization,
    widget.runtime && widget.runtime.regsid,
    widget.options && widget.options.regsid,
    widget.options && widget.options.sessionAuthorization,
    widget.model && widget.model.get("regsid"),
    widget.model && widget.model.get("sessionAuthorization"),
    widget.state && widget.state.regsid
  ];
  assert.equal(readable.includes(sid), false);
  assert.doesNotMatch(JSON.stringify(runtime.options), new RegExp(sid));
});

test("session authorization rotation is write-only and replaces all later request headers", async () => {
  const first = "rotation-session-value-0001";
  const second = "rotation-session-value-0002";
  const calls = [];
  const client = new ServiceClient({
    sessionAuthorization: { keysel: "regsid", sid: first },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: {} }) };
    }
  });
  await client.postService("hello.ping", {});
  const setter = client.setSessionAuthorization;
  let setterIntercepted = false;
  client.setSessionAuthorization = (value) => { setterIntercepted = value === second; };
  client.setSessionAuthorization({ keysel: "regsid", sid: second });
  await client.postService("hello.ping", {});
  await client.postService("bootstrap.authn", {});
  assert.equal(calls[0].options.headers["x-param-regsid"], first);
  assert.deepEqual(calls.slice(1).map((call) => call.options.headers["x-param-regsid"]), [second, second]);
  assert.equal(client.setSessionAuthorization, setter);
  assert.equal(setterIntercepted, false);
  assert.equal(Object.getOwnPropertyDescriptor(client, "setSessionAuthorization").writable, false);
  assert.equal(JSON.stringify(client).includes(first), false);
  assert.equal(JSON.stringify(client).includes(second), false);
  assert.equal(client.regsid, undefined);
  assert.equal(client.sessionAuthorization, undefined);
  assert.equal(typeof client.getRegsid, "undefined");
  assert.equal(typeof client.getSessionAuthorization, "undefined");
});

test("the non-replaceable runtime rotation boundary updates the private transport", async () => {
  const first = "runtime-rotation-value-0001";
  const second = "runtime-rotation-value-0002";
  const calls = [];
  const target = createBootstrapTarget();
  const runtime = new UiRuntime({
    global: target,
    document: target.document,
    sessionAuthorization: { keysel: "regsid", sid: first },
    fetch: async (url, options) => {
      calls.push({ url, options });
      return { ok: true, status: 200, json: async () => ({ status: "ok", data: {} }) };
    }
  });
  await runtime.bootstrap();
  await runtime.serviceClient.postService("hello.ping", {});
  const setter = runtime.setSessionAuthorization;
  let intercepted = false;
  runtime.setSessionAuthorization = (value) => { intercepted = value && value.sid === second; };
  runtime.setSessionAuthorization({ keysel: "regsid", sid: second });
  await runtime.serviceClient.postService("hello.ping", {});
  assert.equal(runtime.setSessionAuthorization, setter);
  assert.equal(intercepted, false);
  assert.equal(Object.getOwnPropertyDescriptor(runtime, "setSessionAuthorization").writable, false);
  assert.deepEqual(calls.map((call) => call.options.headers["x-param-regsid"]), [first, second]);
  assert.equal(runtime.regsid, undefined);
  assert.equal(runtime.sessionAuthorization, undefined);
});

test("bootstrap creates one deterministic non-MFS singleton environment and preserves bootstrap event semantics", async () => {
  const target = createBootstrapTarget();
  const events = [];
  target.document.addEventListener("drumee:bootstraping", (event) => events.push({ name: event.name, detail: event.detail }));
  const first = await bootstrap({ global: target, document: target.document, host: { domain: "kernel.test" } });
  const second = await bootstrap({ global: target, document: target.document });
  assert.equal(first, second);
  assert.equal(first.Kind.get("note"), first.LetcText);
  assert.equal(first.Kind.get("box"), first.LetcBox);
  assert.equal(first.Kind.get("list_smart"), first.LetcList);
  assert.equal(first.Kind.get("wrapper"), first.LetcBlank);
  assert.equal(first.Kind.get("profile"), LetcProfile);
  assert.equal(first.Kind.get("progress"), LetcProgress);
  assert.ok(first.Websocket instanceof Websocket);
  assert.equal(first.Websocket.state, "disconnected");
  assert.equal(target.Websocket, first.Websocket);
  assert.equal(first.pointerDrag.isDragging(), false);
  assert.equal(first.Host.name(), "kernel.test");
  assert.deepEqual(events, [{ name: "core", detail: { name: "core", runtime: "ui-runtime" } }]);
  assert.equal(Object.hasOwn(target, "KIND"), false);
});

test("a plugin request cannot observe a partially initialized bootstrap", async () => {
  const target = createBootstrapTarget();
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const runtime = new UiRuntime({ global: target, document: target.document, onBeforeReady: () => gate });
  const boot = runtime.bootstrap();
  let resolved = false;
  const plugin = runtime.Kind.loadPlugin({ name: "core", kind: "note" }).then(() => { resolved = true; });
  await Promise.resolve();
  assert.equal(resolved, false);
  release();
  await Promise.all([boot, plugin]);
  assert.equal(resolved, true);
});

test("Websocket obtains a fresh OTAK for every connection while preserving generic dispatch", async () => {
  const sockets = [];
  const timers = [];
  const intervals = [];
  class FakeSocket {
    constructor(url, protocol) {
      this.url = url;
      this.protocol = protocol;
      this.sent = [];
      sockets.push(this);
    }

    send(value) { this.sent.push(JSON.parse(value)); }
    close() { if (this.onclose) this.onclose({ code: 1000 }); }
    open() { this.onopen(); }
    message(value) { this.onmessage({ data: JSON.stringify(value) }); }
  }
  let now = 0;
  const authnCalls = [];
  const websocket = new Websocket({
    global: { location: { protocol: "http:", host: "kernel.test" } },
    serviceClient: {
      async postService(service) {
        authnCalls.push(service);
        return { token: `token-${authnCalls.length}` };
      }
    },
    WebSocket: FakeSocket,
    now: () => now,
    setTimeout(handler) { timers.push(handler); return handler; },
    clearTimeout() {},
    setInterval(handler) { intervals.push(handler); return handler; },
    clearInterval() {}
  });
  const received = [];
  const listener = (data, options, model) => received.push({ data, options, model });
  const off = websocket.bindEvent("hello.push", listener);
  const connected = websocket.connect();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sockets[0].url, "ws://kernel.test/-/websocket/?otak=token-1");
  assert.equal(sockets[0].url.includes("regsid"), false);
  assert.equal(sockets[0].protocol, "service");
  sockets[0].open();
  sockets[0].message({ service: "sys.hello", data: { socket_id: "socket-a" } });
  await connected;
  assert.equal(websocket.state, "connected");
  assert.equal(websocket.socketId, "socket-a");
  websocket.upstream("sys.ping", { type: "checkConnection" });
  assert.deepEqual(sockets[0].sent, [["sys.ping", { type: "checkConnection" }]]);
  sockets[0].message({ service: "hello.push", data: { message: "Hello over WebSocket" }, options: { source: "test" }, model: { id: 1 } });
  assert.deepEqual(received, [{
    data: { message: "Hello over WebSocket" }, options: { source: "test" }, model: { id: 1 }
  }]);
  off();
  sockets[0].message({ service: "hello.push", data: { message: "ignored" } });
  assert.equal(received.length, 1);
  websocket.bindEvent("hello.push", listener);
  websocket.unbindEvent("hello.push", listener);
  sockets[0].message({ service: "hello.push", data: { message: "also ignored" } });
  assert.equal(received.length, 1);

  now = 121000;
  intervals[0]();
  assert.deepEqual(sockets[0].sent.at(-1), ["sys.ping", { type: "checkConnection" }]);
  sockets[0].onclose({ code: 1006 });
  assert.equal(websocket.state, "reconnecting");
  timers.at(-1)();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sockets.length, 2);
  assert.equal(sockets[1].url, "ws://kernel.test/-/websocket/?otak=token-2");
  sockets[1].open();
  sockets[1].message({ service: "sys.hello", data: { socket_id: "socket-b" } });
  assert.equal(websocket.state, "connected");
  assert.equal(websocket.socketId, "socket-b");
  websocket.close();
  assert.equal(websocket.state, "closed");
  assert.deepEqual(authnCalls, ["bootstrap.authn", "bootstrap.authn"]);
  assert.equal(timers.length >= 1, true);
});

test("every exposed non-MFS Skeleton builder emits a pre-registered extracted Widget kind", async () => {
  const target = createBootstrapTarget();
  const runtime = await bootstrap({ global: target, document: target.document });
  for (const [pathName, entry] of Object.entries(retainedSkeletonCatalog)) {
    const descriptor = entry.build();
    assert.ok(entry.kinds.includes(descriptor.kind), `${pathName} emitted ${descriptor.kind}`);
    const Widget = runtime.Kind.get(descriptor.kind);
    assert.equal(typeof Widget, "function", `${pathName} has no Widget for ${descriptor.kind}`);
    assert.notEqual(Widget.name, "", `${pathName} must resolve a real Widget class`);
    assert.ok(Widget.prototype instanceof Marionette.View || Widget.prototype instanceof Marionette.CollectionView, `${pathName} must preserve Marionette lineage`);
  }
  assert.equal(Skeletons.Note("LETC ready").kind, "note");
  assert.equal(runtime.Kind.get("note"), runtime.LetcText);
  assert.equal(Skeletons.Profile({ firstname: "Kernel" }).kind, "profile");
  assert.equal(Skeletons.UserProfile, Skeletons.Profile);
  assert.equal(Skeletons.Progress({ name: "Kernel" }).kind, "progress");
  assert.equal(Object.keys(retainedSkeletonCatalog).length, 26);
  for (const [name, record] of Object.entries(excludedSkeletonCatalog)) {
    assert.notEqual(record.classification, "INVESTIGATE", `${name} must have a final classification`);
  }
});

test("canonical Widget classes retain real historical Marionette ancestry", () => {
  assert.ok(LetcBlank.prototype instanceof Marionette.View);
  assert.ok(LetcBox.prototype instanceof Marionette.CollectionView);
  assert.ok(LetcList.prototype instanceof LetcBox);
  assert.ok(LetcProfile.prototype instanceof LetcBox);
  assert.ok(LetcProgress.prototype instanceof LetcBox);
  assert.ok(LetcText.prototype instanceof Marionette.View);
  assert.equal(sourceIdentity.LetcBox, "sources/ui-core/letc/widgets/box/index.js");
  assert.equal(sourceIdentity.LetcText, "sources/ui-core/letc/widgets/text/index.js");
  assert.match(sourceIdentity.LetcProfile, /widgets\/profile/);
  assert.match(sourceIdentity.LetcProgress, /widgets\/progress\/media/);
});

test("Context does not expose an unsupported reset API; valid Backbone clear/set preserve replacement semantics", () => {
  const context = new Context({ stale: true, retained: "old" });
  assert.equal(typeof context.reset, "undefined");
  const events = [];
  context.on("change", () => events.push(context.toJSON()));
  context.clear();
  context.set({ retained: "new", fresh: true });
  assert.deepEqual(context.toJSON(), { retained: "new", fresh: true });
  assert.equal(events.length, 2);
});

test("Host, Visitor and Organization retain only minimal identity context", () => {
  const host = new Host({ protocol: "http", domain: "kernel.test" });
  const visitor = new Visitor({ signed_in: 1 });
  const organization = new Organization({ name: "Kernel", link: "kernel.test", metadata: { locale: "en" } });
  assert.equal(host.makeUrl("/-/app/main.js"), "http://kernel.test/-/app/main.js");
  assert.equal(visitor.isOnline(), true);
  assert.equal(organization.name(), "Kernel");
  assert.deepEqual(organization.metadata(), { locale: "en" });
});

test("ui-runtime production code has no legacy kind namespace, Team or MFS imports", () => {
  const root = path.join(__dirname, "..", "src");
  const source = fs.readdirSync(root, { recursive: true })
    .filter((file) => file.endsWith(".js"))
    .map((file) => fs.readFileSync(path.join(root, file), "utf8"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(source, /(?:window\.|global\.)KIND|KIND\s*\./);
  assert.doesNotMatch(source, /require\([^)]*(?:ui-team|server-team|DrumeeMFS|Finder|WindowManager)/);
});
