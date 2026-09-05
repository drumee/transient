const fs = require("fs");
const path = require("path");
const { DrumeeBuildManifestPlugin } = require("./manifest");

function packageVersion(root) {
  try {
    return JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).version;
  } catch (_) {
    return "0.0.0";
  }
}

function createRules() {
  return [
    {
      test: /\.(sa|sc|c)ss$/,
      use: ["style-loader", { loader: "css-loader", options: { importLoaders: 1 } }, "postcss-loader", "sass-loader"]
    },
    { test: /\.(png|jpe?g|gif|webp|avif)$/i, type: "asset/resource" },
    { test: /\.(woff2?|ttf|eot|svg)$/i, type: "asset/resource" },
    { test: /\.(txt|text)$/i, type: "asset/source" },
    { test: /\.wasm$/, type: "webassembly/async" }
  ];
}

function createConfig({ root, name = "main", type = "runtime", entry, outputPath, publicPath = "/-/app/", mode = "production", version, rev, head, noHash = false, loaderRoots = [], moduleRoots = [] } = {}) {
  if (!root || !entry || !outputPath) throw new Error("ui-build requires root, entry and outputPath");
  const target = name;
  return {
    name: `drumee-${type}-${name}`,
    context: root,
    mode,
    target: "web",
    entry: { [target]: entry },
    output: {
      path: outputPath,
      publicPath,
      filename: noHash ? "[name].js" : "[name]-[fullhash].js",
      clean: true
    },
    resolve: {
      extensions: [".js", ".json", ".scss", ".css"],
      modules: moduleRoots.length ? [...moduleRoots, "node_modules"] : ["node_modules"]
    },
    resolveLoader: loaderRoots.length ? { modules: [...loaderRoots, "node_modules"] } : undefined,
    experiments: { asyncWebAssembly: true },
    module: { rules: createRules() },
    plugins: [new DrumeeBuildManifestPlugin({ outputPath, target, version: version || packageVersion(root), rev, head, noHash })],
    optimization: { moduleIds: "deterministic", chunkIds: "deterministic" },
    stats: { assets: true, modules: true, orphanModules: true }
  };
}

module.exports = { createConfig, createRules };
