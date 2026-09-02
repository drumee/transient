const path = require("path");
const webpack = require("/opt/kernel/ui-build/node_modules/webpack");
const { createConfig } = require("/opt/kernel/ui-build/lib");

const outputPath = "/opt/kernel/ui-artifact";
const config = createConfig({
  root: "/opt/kernel/ui-runtime",
  name: "ui-runtime",
  type: "runtime",
  entry: "./src/index.js",
  outputPath,
  publicPath: "/-/plugins/ui-runtime/",
  version: require("/opt/kernel/ui-runtime/package.json").version,
  rev: process.env.KERNEL_BUILD_REV || "phase2"
});

webpack(config, (error, stats) => {
  if (error) throw error;
  if (stats.hasErrors()) throw new Error(stats.toString({ all: false, errors: true }));
  const metadata = require(path.join(outputPath, "index.json"));
  if (!metadata.hash || !metadata.entry) throw new Error("ui-runtime build metadata is incomplete");
});
