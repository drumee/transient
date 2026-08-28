const TerserPlugin = require('terser-webpack-plugin');
const { join, resolve } = require('path');
const Module = require('./webpack/module');
const Plugins = require('./webpack/plugins');
const Resolve = require('./webpack/resolve');

const {
  UI_BUILD_PATH,
  BUILD_MODE,
  BUILD_TARGET,
  UI_SRC_PATH,
  OUTPUT_FILENAME,
  STYLE_DIRS,
  PUBLIC_PATH,
  ENTRY_PAGE
} = process.env;

/**
 * 
 * @param {*} entry 
 * @param {*} opt 
 * @returns 
 */
function makeOptions(entry, opt) {
  let output = {
    path: opt.bundle_path,
    publicPath: opt.public_path,
    filename: OUTPUT_FILENAME || "[name]-[fullhash].js",
  };
  let style_dirs = [resolve(__dirname, '..', 'skin')];
  if (STYLE_DIRS) {
    style_dirs = STYLE_DIRS.split(/[,:;]+/)
  }
  console.group(`BUNDLING target **${opt.target}**`);
  console.log(`::::: WITH :::: `, { entry, output, opt });

  const res = {
    mode: opt.mode || 'development',
    entry,
    output,
    resolve: Resolve(),
    plugins: Plugins(opt),
    module: Module(style_dirs, opt.mode),
    node: {
      __filename: true
    },
    stats: {
      assets: true,
      modules: true,
      orphanModules: true,
    },
    context: __dirname,
    optimization: {
    }
  };

  if (['production'].includes(opt.mode)) {
    res.optimization.minimize = true;
    res.optimization.minimizer = [
      new TerserPlugin({
        test: /\.js(\?.*)?$/i,
        terserOptions: {
          ecma: undefined,
          warnings: false,
          parse: {},
          compress: {},
          mangle: true, // Note `mangle.properties` is `false` by default.
          module: false,
          output: null,
          toplevel: false,
          nameCache: null,
          ie8: false,
          keep_classnames: true,
          keep_fnames: true,
          safari10: false,
        },
      })
    ]
  }
  return res;
}

/**
 * 
 * @returns 
 */
function normalize() {

  let bundle_base = UI_BUILD_PATH;
  if (!bundle_base) {
    bundle_base = UI_RUNTIME_PATH;
  }

  if (!bundle_base) {
    throw "Either UI_RUNTIME_PATH or UI_BUILD_PATH must be set";
  }

  let public_path = PUBLIC_PATH || '/';

  const mode = BUILD_MODE || 'development';
  let target = BUILD_TARGET || 'app';
  let bundle_path = join(bundle_base, target);
  let opt = {
    bundle_base,
    bundle_path,
    public_path,
    src_path: UI_SRC_PATH,
    target,
    mode,
    entry_page: ENTRY_PAGE
    //statics: ["index.html"]
  };
  if (OUTPUT_FILENAME == "[name].js") {
    opt.no_hash = 1;
  }
  return opt;
}


module.exports = function () {
  return import('@unocss/webpack').then(({ default: UnoCSS }) => {
    const opt = normalize();
    opt.UnoCSS = UnoCSS;
    const bootstrap = join(UI_SRC_PATH, 'app', 'bootstrap.js');
    let res = makeOptions({ bootstrap }, opt);
    if (res.optimization) {
      res.optimization.realContentHash = true
    } else {
      res.optimization = {
        realContentHash: true
      }
    }
    return res;
  })

}
