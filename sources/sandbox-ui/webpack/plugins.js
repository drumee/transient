const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const { DuplicatesPlugin } = require("inspectpack/plugin");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const { StatsWriterPlugin } = require("webpack-stats-plugin");
const webpack = require('webpack');
const Sync = require("./sync");
const { readFileSync } = require("jsonfile");
const { resolve } = require("path");


module.exports = function (opt) {
  const { UnoCSS } = opt;
  const { version } = readFileSync(resolve(__dirname, "../package.json"));
  const pluginsOptsion = {
    __VERSION__: JSON.stringify(version),
  };
  const cssExtract = new MiniCssExtractPlugin({
    ignoreOrder: false, // Enable to remove warnings about conflicting order
    filename: "[name].[fullhash].css",
    chunkFilename: "[id].[fullhash].css",
  });


  a = [
    new CleanWebpackPlugin(),
    new webpack.ProgressPlugin(),
    new StatsWriterPlugin({
      fields: ["assets", "modules"],
      stats: {
        source: true, // Needed for webpack5+
      },
    }),
    new DuplicatesPlugin({
      // Emit compilation warning or error? (Default: `false`)
      emitErrors: false,
      // Display full duplicates information? (Default: `false`)
      verbose: true,
    }),
    UnoCSS(), //
    cssExtract,
    new webpack.DefinePlugin(pluginsOptsion),
    new Sync(opt),
  ];
  return a;
};
