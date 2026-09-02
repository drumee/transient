const fs = require("fs");
const path = require("path");

function buildMetadata({ hash, entry, version, rev, head, timestamp = Date.now(), no_hash = 0 } = {}) {
  if (!hash) throw new Error("Webpack stats.hash is required for Drumee build metadata");
  if (!entry) throw new Error("An emitted JavaScript entry is required for Drumee build metadata");
  return { hash, timestamp, head: head || rev || "unknown", rev: rev || head || "unknown", entry, version: version || "0.0.0", no_hash: no_hash ? 1 : 0 };
}

function emittedEntry(stats, target) {
  const assets = stats.toJson({ all: false, assets: true }).assets || [];
  const named = assets.find((asset) => asset.name === `${target}-${stats.hash}.js`)
    || assets.find((asset) => asset.name.startsWith(`${target}-`) && asset.name.endsWith(".js"))
    || assets.find((asset) => asset.name.endsWith(".js"));
  if (!named) throw new Error(`No JavaScript entry was emitted for ${target}`);
  return named.name;
}

class DrumeeBuildManifestPlugin {
  constructor({ outputPath, target = "main", version, rev, head, noHash = false } = {}) {
    this.outputPath = outputPath;
    this.target = target;
    this.version = version;
    this.rev = rev;
    this.head = head;
    this.noHash = noHash;
  }

  apply(compiler) {
    compiler.hooks.done.tap("DrumeeBuildManifestPlugin", (stats) => {
      const entry = this.noHash ? `${this.target}.js` : emittedEntry(stats, this.target);
      const metadata = buildMetadata({
        hash: stats.hash,
        entry,
        version: this.version,
        rev: this.rev,
        head: this.head,
        no_hash: this.noHash
      });
      const destination = path.join(this.outputPath || compiler.options.output.path, "index.json");
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, `${JSON.stringify(metadata, null, 2)}\n`);
    });
  }
}

module.exports = { DrumeeBuildManifestPlugin, buildMetadata, emittedEntry };
