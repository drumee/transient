# Provenance — ui-runtime

This private extraction workspace takes only the non-MFS LETC responsibilities
proved by Phase 2.6. Source revisions are pinned in `SOURCE_MANIFEST.md`.

| New path / responsibility | Historical source evidence | Source SHA | Intentional reduction / difference |
|---|---|---|---|
| `src/bootstrap.js::{UiRuntime,bootstrap}` | `sources/ui-core/letc/index.js::{load,_load,export_globals}` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Preserves deterministic bootstrap ordering, core event and singleton publication; replaces document-readiness/locale coupling with an explicit idempotent `ready` promise. Excludes `DrumeeMFS`, jQuery, Marionette and jquery-ui. |
| `src/bootstrap.js::dispatchBootstrapEvent` | `sources/ui-core/letc/index.js::export_globals` | same | Retains `drumee:bootstraping` and `event.name = "core"`; adds diagnostic `detail.runtime` without claiming a Team contract. |
| `src/kind.js::{KindRegistry.setReady,registerStatic,loadPlugin}` | `sources/ui-core/letc/kind/index.js::{exists,get,register,registerAddons,loadPlugin}` | same | Retains logical bootstrap-plugin/loadJS/addons flow; static registration now precedes READY and requests wait for it. |
| `src/skeletons.js::Skeletons` | `sources/ui-core/letc/toolkit/skeletons.js` and retained `toolkit/skeleton/**` builders | same | Exposes only the 19 catalogued builders whose literal kind resolves statically. Historical pseudo-constant expressions are adapted to strings: `image_svg`, `entry`, `wrapper`. Exclusions are documented in `docs/refactoring/letc-static-widget-catalog.md`. |
| `src/widgets.js::{LetcWidget,LetcBlank,LetcBox,LetcList,LetcText,LetcSvgImage,LetcEntry,LetcFileSelector}` | `sources/ui-core/letc/widgets/{blank,box,list/smart,list/table,text,image/svg,entry/input,file-selector}/**` | same | A complete class-based minimum rendering closure for retained Skeleton descriptors. No Marionette/Backbone prototype mutation, global constants, service/MFS/media/workflow logic, Team routing or desktop state is copied. |
| `src/browser.js` and `src/letc/skin/index.scss` | `sources/ui-core/letc/index.js`; Widget skin convention in `sources/ui-dev-tools/widget/template/skin/index.scss.tpl` | `ea007c63fe1676f75e2cf9e3490a467987eae298` / `a5df686148dea1be09639946d70276b2fa62cf9b` | CommonJS/Webpack browser entry and minimal kernel styling. It has no legacy aliases or ui-team/ui-styles coupling. |
| test Widget fixture pattern | `sources/ui-dev-tools/widget/template/{index.js.tpl,skeleton/index.js.tpl,skin/index.scss.tpl}` | `a5df686148dea1be09639946d70276b2fa62cf9b` | Test-only CommonJS `LetcBox` class with `initialize`, `require("./skin")`, `super.initialize`, handlers and `onDomRefresh → feed`. It is not a module or `hello`. |
| `src/context.js::{Host,Visitor,Organization}` | `sources/ui-core/letc/{host,user,organization}.js` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Keeps only data/identity accessors. Removes local storage, browser detection, routing, media events, wallpaper and MFS side effects. |
| `src/bootstrap.js::createValidator` | `sources/ui-essentials/utils/validator.js::validator` | `f076a0312273f429b86e60156ecf261dfd7804d1` | Reduced bootstrap facade (`require`, `ident`) only. The package peer declaration was removed because this runtime currently consumes no Essentials module. A later full generic validation consumer must use the pinned Essentials package rather than expand this facade. |
| `src/loader.js::loadBrowserScript` | `sources/ui-essentials/utils/index.js::loadJS` | same | Keeps traditional script injection and avoids native ESM loading; runtime transport/loader remains injected. |

The legacy kind namespace is intentionally absent from production code. A later
Team-only compatibility layer may restore it above this workspace, never as a
dependency of the kernel.
