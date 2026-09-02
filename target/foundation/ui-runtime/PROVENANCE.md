# Provenance — ui-runtime

This workspace takes only narrow responsibilities from the immutable source
baseline. Source SHAs are recorded in `SOURCE_MANIFEST.md`.

| New responsibility | Source evidence | Source SHA | Intentional Phase 2 boundary/difference |
|---|---|---|---|
| Kind registry and logical plugin handshake | `sources/ui-core/letc/kind/index.js::{exists,get,register,registerAddons,loadPlugin}` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Preserves existing-kind short circuit, `{path}` bootstrap response, `loadJS`, addon event, and kind lookup; makes transport/loader injected rather than global. |
| Addon registry | `sources/ui-core/letc/kind/seeds/addons.js::{register,get}` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Retains one registration per kind and supports direct or promise-like addon values without Backbone globals. |
| Browser script loading seam | `sources/ui-essentials/utils/index.js::loadJS` | `f076a0312273f429b86e60156ecf261dfd7804d1` | Keeps a traditional script-injection loader as the default browser option; does not introduce native ESM `import()`. |
| Runtime identity contexts | `sources/ui-core/letc/{host,user,organization}.js` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Keeps only data/context methods needed before MFS and routing: attributes, host URL/name, visitor signed-in state, organization metadata/name/host. Browser globals, routes, storage side effects and MFS behavior are excluded. |
| Minimal render host | `sources/ui-core/letc/index.js::export_globals` and generic widget loading | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Provides a callable host for a future independent widget without copying Backbone, Marionette, static widgets, or `DrumeeMFS`. |

The current static seed file (`sources/ui-core/letc/kind/seeds/static.js`) is
not copied. Even otherwise generic-looking widget implementations have
Backbone/Marionette and historical global dependencies; their minimum is a
Phase 3 acceptance question.
