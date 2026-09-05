# Phase 2.6 — LETC Bootstrap Completeness (Corrective Consolidation)

## Result and scope

The corrective implementation replaces the former local descriptor renderer
with a selective extraction of the historical LETC runtime model:

~~~text
Backbone.Model
  → Marionette.View / Marionette.CollectionView
  → extracted LETC lifecycle methods
  → extracted static Widget catalog
  → READY
  → Kind.loadPlugin(...)
~~~

The kernel remains CommonJS, Webpack-built, no-MFS and no-Team at runtime. It
does not implement hello, a dynamic application module, schemas, MariaDB,
DrumeeMFS, Finder, Desktop or Window Manager.

## Historical bootstrap and corrective order

The historical reference is sources/ui-core/letc/index.js, especially
load, _load and export_globals. Its observed order is locale event; lodash;
jQuery; Marionette; jquery-ui; LETC addons; Preset, Template, Skeletons,
Websocket, Validator, Kind, pointerDragged, LetcBlank/Box/List/Text, Platform,
Env, Host, Visitor, Organization and DrumeeMFS; then drumee:bootstraping.

The corrected kernel order is:

~~~text
Backbone + jQuery + Marionette + lodash + DOMPurify
  → real Context, Host, Visitor and Organization Backbone Models
  → real Preset, Template and Validator adaptations
  → PointerDragState and legacy-compatible pointerDragged property
  → actual Skeleton builder adaptation and Marionette static Widget catalog
  → static Kind registration
  → publish globals except KIND and deferred Websocket
  → drumee:bootstraping (name: core)
  → READY
~~~

The runtime singleton remains one UiRuntime per browser global through the
WeakMap in target/foundation/ui-runtime/src/bootstrap.js. Multiple bootstrap
calls return the same ready promise. Kind.loadPlugin waits for that promise
before even its existing-kind shortcut.

## Prerequisite decisions

| Historical prerequisite | Decision | Evidence and resulting owner |
|---|---|---|
| Backbone, Marionette, lodash and jQuery | REUSE_REAL_DEPENDENCY | Direct dependencies of genuine ui-core Widget ancestry; pinned in the private ui-runtime lockfile. |
| Preset | EXTRACT_REAL | Selective source adaptation from ui-core/letc/preset/{button,confirm-buttons,list-stream,utils}.js in src/preset.js. |
| Template | EXTRACT_REAL | Template.Xmlns and Template.SvgText from ui-core/letc/preset/template.js in src/preset.js. |
| Skeletons | EXTRACT_REAL | Actual core/builder responsibility and every non-MFS public builder in src/skeletons.js. |
| Validator | EXTRACT_REAL adapter | Exact ui-essentials Validator contract is adapted in src/validator.js. The historical generic module uses ESM exports and String prototype extensions, neither suitable as an implicit CJS bootstrap global. The adapter preserves public methods without mutating String. |
| Kind | EXTRACT_REAL | Existing registry protocol remains in src/kind.js with READY gating. |
| pointerDragged | EXTRACT_REAL | PointerDragState backs a readable/writable legacy boolean global; no false placeholder is published as a service. |
| LetcBlank/Box/List/Text | EXTRACT_REAL | Genuine Marionette hierarchy, extracted from ui-core source paths recorded in provenance. |
| Platform and Env | REUSE_REAL_DEPENDENCY | Actual Backbone.Model contexts, rather than custom dictionaries. |
| Host, Visitor, Organization | EXTRACT_REAL | Actual Backbone.Model singleton class boundary from ui-core, reduced only to non-MFS, non-Team methods. |
| Websocket | DEFER_WITH_PROOF | Historical bootstrap sets it to null; no retained static Widget or ui-dev-tools Widget pattern consumes it. It is not published as a false ready service. |
| jquery-ui interactions | DEFER_MFS | The historical droppable/resizable consumers are desktop/DnD/MFS workflows. |
| LETC addons not required by retained closure | DEFER_WITH_PROOF | Explicit local extraction of mget, mset, model.atLeast, feed, childView resolution and part registration replaces only the needed source blocks. |
| DrumeeMFS | DEFER_MFS | Explicit exclusion. |

The generic Validator remains conceptually owned by ui-essentials. The
temporary local CJS adapter has precise provenance and is not presented as a
replacement Essentials package. ui-runtime has no declarative
@drumee/ui-essentials dependency because it does not execute an Essentials
module at runtime.

## Genuine Widget implementation

The production Widget path is no longer a function registry or direct
document.createElement renderer. src/letc.js imports Backbone and Marionette,
preserves real View/CollectionView ancestry, child model/collection behaviour,
mget/mset, model.atLeast, feed, part registration and lifecycle dispatch.
UiRuntime.mount uses Marionette.Region.

| Kernel class | Historical source | Parent chain | Retained lifecycle / intentional reduction |
|---|---|---|---|
| LetcBlank | ui-core/letc/widgets/blank/index.js | Marionette.View | initialize and onDomRefresh renderer/content contract. |
| LetcBox | ui-core/letc/widgets/box/index.js | Marionette.CollectionView | initialize, child kind resolution, feed, append/prepend/clear, parts and nested Widget creation. Generic service/form/MFS methods not needed before plugins are deferred. |
| LetcList | ui-core/letc/widgets/list/{index,smart}/index.js | LetcBox | Collection hierarchy and smart-list lifecycle. |
| LetcTable | ui-core/letc/widgets/list/{index,table}/index.js | LetcList | Distinct table-kind lineage. |
| LetcText | ui-core/letc/widgets/text/index.js | Marionette.View | initialize, DOM refresh, cleanText, draw, getText, set and mould with DOMPurify. |
| LetcSvgImage | ui-core/letc/widgets/image/svg/index.js | Marionette.View | Generic inline SVG branch; MFS vector/node fetch is deferred. |
| LetcEntry | ui-core/letc/widgets/entry/input/index.js | LetcBox | Generic input/textarea lifecycle and model value synchronization; application validation/services are deferred. |
| LetcEntryReminder | ui-core/letc/widgets/entry/reminder/index.js | LetcBox | Actual composed entry lifecycle and focus/value boundary; Team service dispatch is deferred. |
| LetcFileSelector | ui-core/letc/widgets/file-selector/index.js | Marionette.View | Generic browser file-select contract; no storage/MFS action. |
| LetcImageSmart | ui-core/letc/widgets/image/smart/index.js | Marionette.View | Generic src/low/high image loading and events; nid/actualNode MFS branch removed. |
| LetcMenuTopic | ui-core/letc/widgets/menu/index.js | LetcBox | Generic menu state/lifecycle; Team navigation, global radio channels and desktop geometry removed. |
| LetcRichText | ui-core/letc/widgets/text/editable/index.js | LetcText | Generic contenteditable lifecycle; MFS paste-file and app service policy removed. |

No generic primitive was extracted from ui-team in this correction. The
required lower-layer implementations exist in ui-core or ui-essentials.
ui-team was nevertheless inspected: its messenger implementation is a
conclusive Team product exclusion, not a reason to leave a generic primitive
missing.

## Skeleton closure and KIND removal

The complete inventory is maintained in
docs/refactoring/letc-static-widget-catalog.md. Twenty-three public,
non-MFS builders are KEEP_KERNEL. Their twelve emitted kind strings are
registered before READY. Four historical public paths are final exclusions:
Messenger is DEFER_TEAM; Profile, UserProfile and Progress are DEFER_MFS.
No public entry remains INVESTIGATE.

All historical pseudo-constant expressions are replaced by exact literals:

| Historical expression | Kernel literal |
|---|---|
| KIND.image.svg | image_svg |
| KIND.image.smart | image_smart |
| KIND.entry | entry |
| KIND.entry_reminder | entry_reminder |
| KIND.rich_text | rich_text |
| KIND.messenger | messenger (documentation-only deferred kind) |

The kernel never initializes window.KIND or global.KIND. Static scanning and
Chrome validation run with window.KIND absent.

## Context and singleton boundary

Platform and Env are real Backbone.Model contexts. Host retains name,
domain_name, makeUrl, settings and data from letc/host.js. Visitor retains
profile, identity, full name, language and online state from letc/user.js.
Organization retains metadata, host and name from letc/organization.js.

Removed behaviour is documented reduction, not fabricated business behaviour:
Host title/localStorage effects; Visitor media radio, quota, profile media and
routing; Organization wallpapers/routing; and all MFS/desktop/Team state.
Backend authorization remains authoritative.

The historical bootstrap event is preserved as drumee:bootstraping, with
event.name equal to core. The additive detail payload is
{ name: core, runtime: ui-runtime }. The known ui-team consumer remains
evidence only; no Team code runs.

## Build and browser evidence

ui-runtime now declares exact private runtime dependencies on Backbone 1.6.1,
Marionette 4.1.3, DOMPurify 3.4.14, jQuery 3.7.1 and lodash 4.18.1. The
clean kernel Docker image runs npm ci for this private workspace before
Webpack builds the browser artifact. ui-build gained an explicit moduleRoots
option so build consumers can resolve the runtime package's own dependencies
without making ui-build their owner.

The retained kernel skin and the canonical ui-dev-tools Widget fixture compile
through CommonJS/Webpack SCSS handling with no historical Team/MFS alias.
The browser probe declares UTF-8 before loading the bundle: this is required
once the real Lodash bundle includes non-ASCII identifier data.

The Chrome tests prove:

~~~text
ui-runtime bundle
  → bootstrap READY
  → Skeletons.Note
  → note static Kind
  → LetcText instanceof Marionette.View
  → Region mount
  → LETC ready in DOM
~~~

The second probe builds the canonical developer shape from ui-dev-tools:
CommonJS class extends LetcBox; load skin; super.initialize; declareHandlers;
onDomRefresh; feed(Skeleton). Its deliberately minimal fixture does not import
the generator's optional historical mixin alias, so it proves the Widget
contract without making that legacy alias a kernel requirement. It renders
through the real CollectionView path, not a fixture-only renderer.

## Tests run during corrective work

| Test | Result | Meaning |
|---|---|---|
| target/foundation/ui-runtime npm test | PASS | Kind protocol, READY, singleton idempotence, all 23 retained builders, final exclusions, Marionette lineage, context and no-KIND/import scan. |
| tests/integration/kernel/ui-runtime-browser.test.js | PASS | Real Marionette Note render, no KIND, and canonical ui-dev-tools Widget/skin path in Chrome. |
| target/tooling/ui-build/test/ui-build.test.js | PASS | The shared CommonJS/Webpack configuration compiles the real ui-runtime with its own module roots, preserves SCSS/assets and emits the characterized metadata/hash contract. |
| scripts/test-env/kernel/test.sh | PASS | Disposable clean-Debian Node/Nginx image builds ui-runtime, renders pinned setup-infra configuration, passes nginx -t and serves both the no-Team kernel service and ui-runtime static route. |

The image uses the same pinned setup-infra contract as Phase 2 and remains
separate from historical Debian Team images. Generator diagnostics about absent
Team UI metadata and a test DKIM key are expected in this intentionally
no-Team, non-mail slice; no host /etc path is written. No historical Team
Debian E2E is a gate for this isolated no-Team correction.

## Phase 3 assumptions

Phase 3 may rely on a READY-gated static LETC environment with the genuine
Marionette Widget model, complete non-MFS elementary Skeleton closure and the
existing Kind.loadPlugin → bootstrap.plugin → loadJS → registerAddons
protocol. It still must implement exactly one hello module; none of the
browser fixtures is a module or hello substitute.
