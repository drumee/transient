const fs = require("fs");
const path = require("path");

function loadBuildInfo(uiHome) {
  return JSON.parse(fs.readFileSync(path.join(uiHome, "app", "index.json"), "utf8"));
}

function loadApplicationManifest(uiHome) {
  const file = path.join(uiHome, "app", "manifest.json");
  return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, "utf8")) : undefined;
}

function deriveRuntimeAppInfo(buildInfo, applicationManifest) {
  const app = { ...buildInfo };
  const suffix = app.no_hash ? ".js" : `-${app.hash}.js`;
  app.entry = app.no_hash ? "main.js" : `main${suffix}`;
  app.vendor = app.no_hash ? "vendor.js" : `vendor${suffix}`;
  app.sprite = app.no_hash ? "sprite.js" : `sprite${suffix}`;
  app.locale = app.no_hash ? "locale.js" : `locale${suffix}`;
  app.core = app.no_hash ? "core.js" : `core${suffix}`;
  app.manifest = applicationManifest;
  return app;
}

module.exports = { deriveRuntimeAppInfo, loadApplicationManifest, loadBuildInfo };
