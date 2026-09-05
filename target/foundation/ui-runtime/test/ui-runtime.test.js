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
  Skeletons,
  UiRuntime,
  Visitor,
  bootstrap,
  retainedSkeletonCatalog,
  excludedSkeletonCatalog,
  sourceIdentity
} = require("../src");

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
  assert.equal(Object.hasOwn(first, "Websocket"), false);
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
