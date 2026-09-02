const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");
const {
  Host,
  KindRegistry,
  Organization,
  Visitor,
  createRuntime
} = require("../src");

test("Kind registry registers, finds and reports missing kinds", () => {
  const kind = new KindRegistry();
  const Widget = () => "widget";
  assert.equal(kind.register("probe_widget", Widget), Widget);
  assert.equal(kind.exists("probe_widget"), true);
  assert.equal(kind.get("probe_widget"), Widget);
  assert.equal(kind.get("missing"), null);
  assert.equal(kind.register("probe_widget", () => "ignored"), undefined);
});

test("addon registration emits the historical addons:registered handshake", () => {
  const kind = new KindRegistry();
  let events = 0;
  kind.on("addons:registered", () => events++);
  const Widget = () => "addon";
  kind.registerAddons({ addon_widget: Widget });
  assert.equal(kind.exists("addon_widget"), true);
  assert.equal(kind.get("addon_widget"), Widget);
  assert.equal(events, 1);
});

test("plugin loading skips an existing kind", async () => {
  let calls = 0;
  const Existing = () => "existing";
  const kind = new KindRegistry({ bootstrapPlugin: async () => { calls++; return { path: "/ignored" }; } });
  kind.register("existing", Existing);
  assert.equal(await kind.loadPlugin({ name: "ignored", kind: "existing" }), Existing);
  assert.equal(calls, 0);
});

test("plugin loading preserves bootstrap.plugin → loadJS → registerAddons", async () => {
  const paths = [];
  let kind;
  const Widget = (props) => ({ kind: "probe_widget", props });
  kind = new KindRegistry({
    bootstrapPlugin: async (name) => ({ path: `/-/plugins/${name}/main.js` }),
    loadJS: async (loadedPath) => {
      paths.push(loadedPath);
      kind.registerAddons({ probe_widget: Widget });
    }
  });
  assert.equal(await kind.loadPlugin({ name: "probe", kind: "probe_widget" }), Widget);
  assert.deepEqual(paths, ["/-/plugins/probe/main.js"]);
  assert.equal(await kind.loadPlugin({ name: "probe", kind: "probe_widget" }), Widget);
  assert.deepEqual(paths, ["/-/plugins/probe/main.js"]);
});

test("plugin transport and bundle failures reject cleanly", async () => {
  const rejectedTransport = new KindRegistry({ bootstrapPlugin: async () => { throw new Error("transport failed"); } });
  await assert.rejects(rejectedTransport.loadPlugin({ name: "probe", kind: "probe_widget" }), /transport failed/);
  const rejectedBundle = new KindRegistry({
    bootstrapPlugin: async () => ({ path: "/broken.js" }),
    loadJS: async () => { throw new Error("bundle failed"); }
  });
  await assert.rejects(rejectedBundle.loadPlugin({ name: "probe", kind: "probe_widget" }), /bundle failed/);
});

test("Host, Visitor and Organization retain only minimal identity context", () => {
  const host = new Host({ protocol: "http", domain: "kernel.test" });
  const visitor = new Visitor({ signed_in: 1 });
  const organization = new Organization({ name: "Kernel", link: "kernel.test", metadata: { locale: "en" } });
  assert.equal(host.makeUrl("/-/app/main.js"), "http://kernel.test/-/app/main.js");
  assert.equal(visitor.isOnline(), true);
  assert.equal(organization.name(), "Kernel");
  assert.deepEqual(organization.metadata(), { locale: "en" });
  const runtime = createRuntime({ host: host.toJSON(), visitor: visitor.toJSON(), organization: organization.toJSON() });
  runtime.Kind.register("renderable", (props) => ({ rendered: props.message }));
  assert.deepEqual(runtime.render("renderable", { message: "ok" }), { rendered: "ok" });
});

test("ui-runtime has no Team, MFS, Finder or Window Manager imports", () => {
  const source = ["kind.js", "context.js", "runtime.js", "index.js"]
    .map((file) => fs.readFileSync(path.join(__dirname, "..", "src", file), "utf8"))
    .join("\n");
  assert.doesNotMatch(source, /DrumeeMFS|ui-team|Finder|Window Manager|WindowManager/);
});
