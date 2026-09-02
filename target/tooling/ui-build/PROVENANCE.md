# Provenance — ui-build

| New responsibility | Source evidence | Source SHA | Intentional Phase 2 boundary/difference |
|---|---|---|---|
| Webpack configuration shape | `sources/signin/webpack.js::{makeOptions,normalize}` | `1ea5f31c3f08a245073e7452bf8239cfca2988f9` | Retains `target: web`, CommonJS/Webpack output and `[name]-[fullhash].js`; replaces application environment globals with explicit options. |
| SCSS/CSS/assets rules | `sources/signin/webpack/module.js` | `1ea5f31c3f08a245073e7452bf8239cfca2988f9` | Retains style, CSS, PostCSS, Sass, font/image intent with current Webpack 5 asset modules; CoffeeScript, TypeScript, templates and application-only rules are not first-runtime requirements. |
| Build metadata/hash | `sources/signin/webpack/sync.js::DrumeeSyncer.{apply,get_hash}` | `1ea5f31c3f08a245073e7452bf8239cfca2988f9` | Retains `index.json` fields `hash`, `timestamp`, `head`, `rev`, `entry`, `version`, `no_hash`; makes generation a first-class plugin and removes rsync/UI_RUNTIME_HOST deployment side effects. |
| Runtime consumer characterization | `sources/server-essentials/lib/sysEnv.js::{loadUiinfo,getUiInfo}` and `sources/server-core/lib/runtimeEnv.js::{loadManifest,RuntimeEnv.getAppInfo}` | `b9460ba442c9962471a592c49ce36b01e0327ff5`, `bf7c396b14614f247507f771f72e98184ed931b4` | `index.json` is build metadata read as UI info; `app/manifest.json` is a distinct application manifest. The test helper reproduces only the observed `app.hash`/bundle-name derivation and does not replace `RuntimeEnv`. |

The extensive shortcut sets in `sources/signin/webpack/shortcut.js` are
application/legacy aliases and are intentionally excluded. `ui-dev-tools` is
not imported in the pinned source tree, so a future developer-workflow
integration remains a provenance gap rather than an implicit dependency.
