const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");
const {
  buildMetadata,
  createConfig,
  deriveRuntimeAppInfo,
  loadApplicationManifest,
  loadBuildInfo
} = require("../lib");
const repositoryRoot = path.resolve(__dirname, "../../../..");

function runWebpack(config) {
  const dependencyRoot = process.env.DRUMEE_UI_BUILD_NODE_MODULES || path.join(__dirname, "..", "node_modules");
  const webpack = require(path.join(dependencyRoot, "webpack"));
  return new Promise((resolve, reject) => {
    webpack(config, (error, stats) => {
      if (error) return reject(error);
      if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
      resolve(stats);
    });
  });
}

test("build metadata keeps the observed sync.js fields distinct from application manifest", () => {
  const metadata = buildMetadata({ hash: "hash-a", entry: "main-hash-a.js", version: "0.0.0-phase2", rev: "abc", timestamp: 1 });
  assert.deepEqual(metadata, {
    hash: "hash-a", timestamp: 1, head: "abc", rev: "abc", entry: "main-hash-a.js", version: "0.0.0-phase2", no_hash: 0
  });
  const app = deriveRuntimeAppInfo(metadata, { "main.js": "main-application.js" });
  assert.equal(app.hash, "hash-a");
  assert.equal(app.entry, "main-hash-a.js");
  assert.deepEqual(app.manifest, { "main.js": "main-application.js" });
});

test("RuntimeEnv consumer model reads index.json and manifest.json independently", () => {
  const uiHome = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-ui-build-"));
  const appDir = path.join(uiHome, "app");
  fs.mkdirSync(appDir, { recursive: true });
  fs.writeFileSync(path.join(appDir, "index.json"), JSON.stringify(buildMetadata({ hash: "contract", entry: "main-contract.js", version: "1.0.0" })));
  fs.writeFileSync(path.join(appDir, "manifest.json"), JSON.stringify({ "main.js": "main-contract.js" }));
  const derived = deriveRuntimeAppInfo(loadBuildInfo(uiHome), loadApplicationManifest(uiHome));
  assert.equal(derived.entry, "main-contract.js");
  assert.deepEqual(derived.manifest, { "main.js": "main-contract.js" });
});

test("shared config is CommonJS/Webpack and excludes historical aliases", () => {
  const root = path.resolve(__dirname, "../../../foundation/ui-runtime");
  const config = createConfig({ root, name: "runtime", entry: "./src/index.js", outputPath: path.join(os.tmpdir(), "ui-build-output") });
  assert.equal(config.target, "web");
  assert.equal(config.output.filename, "[name]-[fullhash].js");
  assert.equal(config.plugins[0].constructor.name, "DrumeeBuildManifestPlugin");
  assert.equal(config.resolve.alias, undefined);
  assert.match(config.module.rules[0].test.toString(), /sa/);
});

test("Webpack emits a content-sensitive bundle and Drumee build metadata with styles and assets", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-ui-build-webpack-"));
  const outputPath = path.join(root, "dist");
  fs.writeFileSync(path.join(root, "entry.js"), "require('./style.scss'); module.exports = require('./asset.svg');\n");
  fs.writeFileSync(path.join(root, "style.scss"), "$accent: #123456; .probe { color: $accent; }\n");
  fs.writeFileSync(path.join(root, "asset.svg"), "<svg xmlns=\"http://www.w3.org/2000/svg\"></svg>\n");
  const config = createConfig({
    root,
    name: "runtime",
    entry: "./entry.js",
    outputPath,
    version: "0.0.0-phase2",
    rev: "fixture",
    loaderRoots: [process.env.DRUMEE_UI_BUILD_NODE_MODULES || path.join(__dirname, "..", "node_modules")]
  });
  await runWebpack(config);
  const first = JSON.parse(fs.readFileSync(path.join(outputPath, "index.json"), "utf8"));
  assert.ok(first.hash);
  assert.ok(first.entry.startsWith("runtime-"));
  assert.equal(fs.existsSync(path.join(outputPath, first.entry)), true);
  assert.equal(fs.readdirSync(outputPath).some((file) => file.endsWith(".svg")), true);
  fs.writeFileSync(path.join(root, "entry.js"), "require('./style.scss'); module.exports = 'changed';\n");
  await runWebpack(config);
  const second = JSON.parse(fs.readFileSync(path.join(outputPath, "index.json"), "utf8"));
  assert.notEqual(first.hash, second.hash);
});

test("ui-runtime itself builds through the shared Webpack configuration", async () => {
  const root = path.resolve(__dirname, "../../../foundation/ui-runtime");
  const outputPath = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-ui-runtime-build-"));
  const config = createConfig({
    root,
    name: "runtime",
    entry: "./src/browser.js",
    outputPath,
    version: "0.0.0-phase2",
    rev: "phase2",
    loaderRoots: [process.env.DRUMEE_UI_BUILD_NODE_MODULES || path.join(__dirname, "..", "node_modules")]
  });
  await runWebpack(config);
  const metadata = JSON.parse(fs.readFileSync(path.join(outputPath, "index.json"), "utf8"));
  assert.ok(metadata.hash);
  assert.equal(fs.existsSync(path.join(outputPath, metadata.entry)), true);
});

test("the recorded RuntimeEnv and bootstrap appHash consumers remain separate from build metadata production", () => {
  const runtimeEnv = fs.readFileSync(path.join(repositoryRoot, "sources/server-core/lib/runtimeEnv.js"), "utf8");
  const sysEnv = fs.readFileSync(path.join(repositoryRoot, "sources/server-essentials/lib/sysEnv.js"), "utf8");
  const template = fs.readFileSync(path.join(repositoryRoot, "sources/server-team/client/templates/scripts.tpl"), "utf8");
  const buildSource = fs.readFileSync(path.join(__dirname, "..", "lib", "manifest.js"), "utf8");
  assert.match(sysEnv, /loadUiinfo\('app'\)/);
  assert.match(runtimeEnv, /conf\.entry = `main-\$\{conf\.hash\}\.js`/);
  assert.match(runtimeEnv, /conf\.manifest = loadManifest\(\)/);
  assert.match(template, /appHash\s*:\s*"<%= app\.hash %>"/);
  assert.doesNotMatch(buildSource, /UI_RUNTIME_HOST|rsync/);
});
