const assert = require("assert/strict");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");

function dependencyRoot() {
  const candidates = [
    process.env.DRUMEE_UI_BUILD_NODE_MODULES,
    path.join(root, "target/tooling/ui-build/node_modules"),
    path.join(root, ".tmp/test-env/build-src/ui-team/node_modules")
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, "webpack")));
  if (!found) throw new Error("Webpack is required: set DRUMEE_UI_BUILD_NODE_MODULES or prepare the disposable build staging tree");
  return found;
}

function chrome() {
  const candidates = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("A Chromium-compatible browser is required for the Phase 2.6 browser test");
  return found;
}

function compile(config) {
  const webpack = require(path.join(dependencyRoot(), "webpack"));
  return new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error) return reject(error);
    if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
    resolve();
  }));
}

test("browser loads the core, reaches READY and renders Skeletons.Note through a real Widget", async () => {
  const { createConfig } = require(path.join(root, "target/tooling/ui-build/lib"));
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-letc-browser-"));
  const runtimeRoot = path.join(root, "target/foundation/ui-runtime");
  const config = createConfig({
    root: runtimeRoot,
    name: "letc-core",
    type: "runtime",
    entry: "./src/browser.js",
    outputPath,
    publicPath: "./",
    version: "0.0.0-phase2.6",
    rev: "phase2.6",
    loaderRoots: [dependencyRoot()]
  });
  await compile(config);
  const metadata = JSON.parse(fs.readFileSync(path.join(outputPath, "index.json"), "utf8"));
  const page = path.join(outputPath, "probe.html");
  fs.writeFileSync(page, `<!doctype html><html><body><main id="root"></main><script src="${metadata.entry}"></script><script>window.DrumeeUiRuntime.bootstrap().then(function (runtime) { var note = window.Skeletons.Note({ content: "LETC ready" }); var widget = runtime.mount(note, document.getElementById("root")); document.body.dataset.ready = String(runtime.isReady); document.body.dataset.kind = widget.model.get("kind"); document.body.dataset.kindNamespace = String(typeof window.KIND); });</script></body></html>`);
  const result = childProcess.spawnSync(chrome(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=3000", "--dump-dom", `file://${page}`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /data-ready="true"/);
  assert.match(result.stdout, /data-kind="note"/);
  assert.match(result.stdout, /data-kind-namespace="undefined"/);
  assert.match(result.stdout, /LETC ready/);
});

test("the canonical ui-dev-tools Widget pattern compiles and renders after core READY", async () => {
  const { createConfig } = require(path.join(root, "target/tooling/ui-build/lib"));
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-letc-widget-"));
  const config = createConfig({
    root,
    name: "phase26-widget",
    type: "test-fixture",
    entry: "./tests/integration/kernel/fixtures/letc-widget/browser-entry.js",
    outputPath,
    publicPath: "./",
    version: "0.0.0-phase2.6",
    rev: "phase2.6",
    loaderRoots: [dependencyRoot()]
  });
  await compile(config);
  const metadata = JSON.parse(fs.readFileSync(path.join(outputPath, "index.json"), "utf8"));
  const page = path.join(outputPath, "widget.html");
  fs.writeFileSync(page, `<!doctype html><html><body><main id="widget-root"></main><script src="${metadata.entry}"></script><script>window.Phase26WidgetReady.then(function () { document.body.dataset.widgetReady = "true"; });</script></body></html>`);
  const result = childProcess.spawnSync(chrome(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--allow-file-access-from-files", "--virtual-time-budget=3000", "--dump-dom", `file://${page}`], { encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /data-widget-ready="true"/);
  assert.match(result.stdout, /Widget pattern ready/);
  assert.match(result.stdout, /phase26-widget__main/);
});
