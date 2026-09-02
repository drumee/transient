# Phase 2.6 — LETC Bootstrap Completeness

## Scope and result

Phase 2.6 makes `target/foundation/ui-runtime/` a deterministic, no-Team,
non-MFS LETC environment before any application bundle is requested. It does
not implement `hello`, a module descriptor, MFS, schemas, MariaDB or a Team
migration.

The resulting contract is:

```text
generic browser prerequisites
  → LETC runtime singleton/context
  → retained Skeletons API
  → static Kind catalog
  → READY
  → Kind.loadPlugin(...)
```

The browser validates the core with `Skeletons.Note({ content: "LETC ready" })`;
this is a kernel-only probe, not the Phase 3 `hello` module.

## Historical bootstrap sequence

`sources/ui-core/letc/index.js::{load,_load,export_globals}` is the canonical
historical reference (source SHA
`ea007c63fe1676f75e2cf9e3490a467987eae298`). Its sequence is:

```text
locale drumee:bootstraping event
  → lodash
  → jQuery / $
  → Backbone.Marionette
  → jquery-ui droppable + resizable
  → LETC addons
  → document complete
  → Preset, Template, Skeletons, Websocket, Validator, Kind
  → pointerDragged, LetcBlank/Box/List/Text
  → Platform, Env, Host, Visitor, Organization, DrumeeMFS
  → drumee:bootstraping { name: core }
```

The old source also creates `window.KIND` from `builtin_kinds`. That namespace
is deliberately not retained. It is a historical pseudo-constant encoder, not
a kernel contract.

## New kernel bootstrap sequence

`target/foundation/ui-runtime/src/bootstrap.js::{UiRuntime,bootstrap}` creates
a single `UiRuntime` per browser global through a `WeakMap`. Its `ready` promise
is idempotent:

```text
UiRuntime.bootstrap()
  → construct Context / Host / Visitor / Organization
  → construct Platform and Env Contexts
  → construct Preset, Template, Websocket and Validator globals
  → register static elementary kinds
  → publish LETC globals except KIND
  → dispatch drumee:bootstraping { name: core, detail: { runtime: ui-runtime } }
  → resolve READY
```

`KindRegistry.loadPlugin()` now awaits this promise before checking even an
already-static kind. Therefore a plugin request cannot observe a partially
constructed environment. The deferred-bootstrap test proves that behaviour.

The event is retained with the smallest observed semantic contract:

| Field | Historical producer | Phase 2.6 value | Consumers / boundary |
|---|---|---|---|
| event name | `letc/index.js::export_globals` | `drumee:bootstraping` | Historical Team preload listens for it in `sources/ui-team/src/drumee/index.web.js`; Team does not run in this environment. |
| `event.name` | same | `core` | Preserved for non-MFS consumers. |
| structured payload | none | `{ name: "core", runtime: "ui-runtime" }` in `detail` | additive diagnostic context; not a Team API claim. |

## Prerequisite classification

| Historical prerequisite | Classification | Phase 2.6 decision and evidence |
|---|---|---|
| `Preset` | `KEEP_KERNEL` namespace | An immutable empty namespace is published because core bootstrap owns the global; button presets are not needed by the retained static catalog. Source: `letc/index.js`. |
| `Template` | `KEEP_KERNEL` namespace | Published as an immutable empty namespace. SVG/template helpers are not required by the extracted SVG Widget boundary. |
| `Skeletons` | `KEEP_KERNEL` | `src/skeletons.js` exposes only 19 proven, complete entries. |
| `Websocket` | `KEEP_KERNEL` placeholder | `null`, matching the historical pre-router initial value; websocket transport remains later capability work. |
| `Validator` | `KEEP_KERNEL` reduced facade | Only `require` and `ident` are present for core global stability. Historical source is `sources/ui-essentials/utils/validator.js`; no retained core Widget invokes it. Full generic validation remains owned by `ui-essentials` when a consuming feature requires it. |
| `Kind` | `KEEP_KERNEL` | `KindRegistry` owns static/application/addon lookup and the existing plugin handshake. |
| `pointerDragged` | `KEEP_KERNEL` state | Initialized to `false`, without Desktop/DnD consumers. |
| `LetcBlank`, `LetcBox`, `LetcList`, `LetcText` | `KEEP_KERNEL` | Actual class-based Widgets, not descriptor callbacks. |
| `Platform`, `Env` | `KEEP_KERNEL` | Small `Context` instances with `get`, `set`, `reset` and `toJSON`; historical Backbone models are not necessary for the retained closure. |
| `Host`, `Visitor`, `Organization` | `KEEP_KERNEL` reduced context | Retain identity/context accessors only; see below. |
| lodash | `LEGACY_COMPAT` | Historical skeleton builders depend on global lodash. Extracted builders use local, immutable-object operations instead. |
| jQuery / `$` | `LEGACY_COMPAT` | Needed by historical Marionette Widgets, not by the retained class renderer. No global is published. |
| Marionette / Backbone | `LEGACY_COMPAT` | Historical Widget parents depend on it. The Phase 2.6 non-MFS closure has explicit `LetcWidget` classes and does not load a parallel historical framework. |
| jquery-ui droppable/resizable | `DEFER_MFS` | Required for historical interaction/desktop flows, absent from elementary static rendering. |
| `letc/addons/**` | `LEGACY_COMPAT` | Extends historical prototype globals. The retained explicit classes do not need those mutations. |
| locale / `LOCALE` | `UNUSED` | Required by historical text/entry default labels, not by the retained no-locale descriptors. |
| `DrumeeMFS` | `DEFER_MFS` | Explicitly excluded; boot reaches READY without it. |

## Globals and singleton ownership

| Singleton | Construction | Lifetime / owner | Reduced behaviour |
|---|---|---|---|
| `Kind` | `new KindRegistry()` | one per `UiRuntime` | Static kinds are registered before READY; addon/plugin state stays on this registry. |
| `Platform`, `Env` | `new Context()` | one per `UiRuntime` | Generic attribute maps only. |
| `Host` | `new Host()` | one per `UiRuntime` | URL/domain/name only; no title or local-storage side effects from `sources/ui-core/letc/host.js`. |
| `Visitor` | `new Visitor()` | one per `UiRuntime` | Signed-in/online flags only; no media radio, profile, browser or routing behaviour from `letc/user.js`. |
| `Organization` | `new Organization()` | one per `UiRuntime` | Metadata/name/host only; no wallpaper, routing or bootstrap state from `letc/organization.js`. |
| `Preset`, `Template` | frozen empty objects | one per `UiRuntime` | Namespaces are available before plugins, but Team preset/template behaviour is excluded. |
| `Websocket` | `null` | one per `UiRuntime` | Matches pre-router bootstrap state. |

Plugins receive these published globals but do not create parallel contexts.
Backend ACL remains the authorization authority.

## Legacy `KIND` removal

No production file under `target/foundation/ui-runtime/src/` initializes or
dereferences the legacy global. Retained historical expressions were adapted
to their exact source values:

| Historical expression | Kernel string |
|---|---|
| `KIND.image.svg` | `"image_svg"` |
| `KIND.entry` | `"entry"` |
| `KIND.wrapper` | `"wrapper"` |

Other historical expressions are not exposed until their Widget closure is
approved; the detailed treatment is in
[`letc-static-widget-catalog.md`](letc-static-widget-catalog.md).

The static scan and Chrome test both prove a bootstrap with `window.KIND`
absent. A future Team compatibility layer may create it above `ui-runtime`;
the kernel may not depend on that adapter.

## Real Widget and Skeleton boundary

`target/foundation/ui-runtime/src/widgets.js` defines real classes:

```text
LetcWidget
  ├── LetcBlank
  ├── LetcBox
  │     └── LetcList
  ├── LetcText
  ├── LetcSvgImage
  ├── LetcEntry
  │     └── LetcFileSelector
```

They instantiate descriptors via `runtime.createWidget()` and render through
the runtime-owned DOM boundary. `LetcBox.feed()` resolves each child through
the static `Kind` catalog; it is not a direct application HTML-string seam.
`Skeletons.Note → "note" → LetcText` is asserted in the catalog and browser
tests without special-casing `note` in the registry.

The canonical developer shape was taken from the newly pinned
`sources/ui-dev-tools/widget/template/{index.js.tpl,skeleton/index.js.tpl,skin/index.scss.tpl}`
(SHA `a5df686148dea1be09639946d70276b2fa62cf9b`). The test-only fixture at
`tests/integration/kernel/fixtures/letc-widget/` is CommonJS, extends
`LetcBox`, loads `./skin`, calls `super.initialize()`, declares handlers and
feeds a Skeleton in `onDomRefresh()`. It compiles through `ui-build` and
renders after core READY. It is not `hello` and is not installed as a module.

## `ui-essentials` ownership

Phase 2 incorrectly declared `@drumee/ui-essentials` as a peer dependency
without consuming it. Phase 2.6 removes that declaration. The retained CJS
bootstrap does not import an Essentials API: its service transport/loadJS is
injected into `KindRegistry`, and the small Validator facade exists solely to
make the historical bootstrap global deterministic before a real consumer
exists. This avoids a misleading package relationship and avoids copying the
whole Essentials ESM entry plus unrelated style/socket dependencies into the
kernel.

When a future module needs full generic validation, service transport or
loading utilities, it must consume the pinned `ui-essentials` implementation
directly and document the actual API use. This is a deliberate temporary
ownership boundary, not a new replacement Essentials package.

## Webpack and styles

CommonJS and Webpack remain authoritative. `src/browser.js` imports the
retained core skin. `scripts/test-env/kernel/container/build-ui-runtime.js`
now builds that browser entry rather than the Node-only library entry. The
test Widget uses a directory `skin/index.scss` exactly like the
`ui-dev-tools/widget` generator. It compiles through
`target/tooling/ui-build/lib/config.js` using existing SCSS/CSS loaders with
no historical alias, Team alias or MFS alias.

## Tests and evidence

| Command / test | Result | Evidence |
|---|---|---|
| `node --test target/foundation/ui-runtime/test/ui-runtime.test.js` | PASS | bootstrap idempotence, event, READY gating, catalog completeness, contexts, no legacy kind namespace/MFS/Team imports. |
| `node tests/integration/kernel/ui-runtime-browser.test.js` | PASS (Chrome, elevated local browser sandbox) | Webpack bundle loads; `Skeletons.Note` renders `LETC ready`; `window.KIND` is undefined. |
| same browser test, Widget fixture | PASS | CommonJS `LetcBox` Widget/skeleton/skin pattern compiles and renders. |
| `DRUMEE_UI_BUILD_NODE_MODULES=.tmp/test-env/build-src/ui-team/node_modules node target/tooling/ui-build/test/ui-build.test.js` | PASS | Shared Webpack config compiles the new browser entry with SCSS and preserves build metadata behaviour. |

The `ui-runtime` source scan and the clean kernel image checks establish that
this path does not import `server-team`, `ui-team`, `DrumeeMFS`, schemas,
MariaDB, Finder or Window Manager. The browser path itself has no service,
database or plugin request.

## Phase 3 assumptions

Phase 3 may rely on a READY-gated non-MFS browser environment, a complete
retained static catalog, exact string kind identifiers, real class-based
Widget rendering and the existing `Kind.loadPlugin → bootstrap.plugin → loadJS
→ registerAddons` mechanism. It must still implement exactly one `hello`
module to prove dynamic backend/frontend discovery. No Phase 2.6 fixture is a
module or a substitute for that proof.
