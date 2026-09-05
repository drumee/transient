# Provenance — ui-runtime

This private CommonJS extraction workspace contains the non-MFS LETC bootstrap
closure required before an independent plugin loads. It is not a public package
or final repository boundary. All source revisions below are pinned in
`SOURCE_MANIFEST.md`.

| New path / responsibility | Historical source evidence | Source SHA | Intentional difference and proof |
|---|---|---|---|
| `src/letc.js::{LetcView,LetcBox,normalizeKids}` | `sources/ui-core/letc/widgets/box/index.js::{initialize,feed,append,clear}` and its LETC addon dependencies | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Keeps actual Backbone + Marionette View/CollectionView ancestry, model/collection children, `feed`, parts and lifecycle dispatch. Removes form/service/MFS helpers and legacy global constants. Unit and Chrome tests assert Marionette lineage and real collection rendering. |
| `src/widgets.js::LetcBlank` | `sources/ui-core/letc/widgets/blank/index.js::{initialize,onDomRefresh}` | same | Preserves the source renderer/content lifecycle in a real Marionette View; literal `flow` replaces `_a.x`. |
| `src/widgets.js::LetcText` | `sources/ui-core/letc/widgets/text/index.js::{initialize,onDomRefresh,cleanText,draw,getText,set,mould}` | same | Preserves DOMPurify-backed text lifecycle and real View ancestry. Locale/global constant and unrelated update/service paths are deferred. Chrome proves `Skeletons.Note → note → LetcText → DOM`. |
| `src/widgets.js::{LetcList,LetcTable}` | `sources/ui-core/letc/widgets/list/{index.js,smart/index.js,table/index.js}` | same | Keeps the actual `LetcBox` collection hierarchy and static kinds. Scroll/API/radio/media behaviour is not a pre-plugin requirement and is deferred. |
| `src/widgets.js::{LetcSvgImage,LetcImageSmart}` | `sources/ui-core/letc/widgets/image/{svg,smart}/index.js` | same | Retains generic inline-SVG and `src`/low/high browser-image behaviour. Vector-node, `nid`, `actualNode` and media/MFS paths are removed. |
| `src/widgets.js::{LetcEntry,LetcEntryReminder,LetcFileSelector,LetcMenuTopic,LetcRichText}` | `sources/ui-core/letc/widgets/{entry/input,entry/reminder,file-selector,menu,text/editable}/index.js` | same | Selective non-MFS Marionette adaptations. Form/service policy, routing, radios, desktop geometry and file-storage operations remain outside the kernel. Their builders are covered by the static-catalog test. |
| `src/skeletons.js::{CoreSkeleton,SkeletonBuilder,Skeletons,staticKinds}` | `sources/ui-core/letc/toolkit/{core,builder,skeletons}.js`, `toolkit/skeleton/**`, `toolkit/builder/{avatar,button,list}/**` | same | All 23 non-MFS public builder paths use exact literal kind strings and resolve to static real Widget classes. `KIND.*` adaptations are exhaustively listed in `docs/refactoring/letc-static-widget-catalog.md`; `Messenger` is Team product behaviour and Profile/Progress paths are MFS-deferred. |
| `src/context.js::{Context,Host,Visitor,Organization}` | `sources/ui-core/letc/{host,user,organization}.js` | same | Uses actual Backbone.Model context ownership and retains identity/data methods. Browser storage, media radios, routing, wallpapers and MFS effects are deliberately excluded. |
| `src/preset.js::{createPreset,Template}` | `sources/ui-core/letc/preset/{button,confirm-buttons,list-stream,utils,template}.js` | same | Selective real preset/template behaviours that the retained skeleton closure consumes. No empty global facade is published. |
| `src/validator.js::Validator` | `sources/ui-essentials/utils/validator.js::validator` | `f076a0312273f429b86e60156ecf261dfd7804d1` | A local CJS adapter preserves the retained public checks without the historical ESM import and `String` prototype extension. The generic Validator remains owned by ui-essentials; this workspace does not declare an unused Essentials dependency. |
| `src/bootstrap.js::{UiRuntime,PointerDragState,bootstrap}` | `sources/ui-core/letc/index.js::{load,_load,export_globals}` | `ea007c63fe1676f75e2cf9e3490a467987eae298` | Preserves core ordering, `drumee:bootstraping`, singleton lifetime and globals, but replaces document-readiness coupling with an idempotent explicit READY promise. It intentionally does not publish `KIND`, `DrumeeMFS` or a null Websocket placeholder. |
| `src/kind.js::{setReady,registerStatic,loadPlugin}` | `sources/ui-core/letc/kind/index.js::{exists,get,register,registerAddons,loadPlugin}` | same | Preserves the logical bootstrap-plugin/loadJS/addons flow. Static registration precedes READY and all loads wait for READY. |
| `src/loader.js::loadBrowserScript` | `sources/ui-essentials/utils/index.js::loadJS` | `f076a0312273f429b86e60156ecf261dfd7804d1` | Retains script-tag loading rather than native ESM loading. |
| `src/browser.js` and `src/letc/skin/index.scss` | `sources/ui-core/letc/index.js`; `sources/ui-dev-tools/widget/template/{index.js.tpl,skeleton/index.js.tpl,skin/index.scss.tpl}` | `ea007c63fe1676f75e2cf9e3490a467987eae298` / `a5df686148dea1be09639946d70276b2fa62cf9b` | CommonJS/Webpack browser entry and minimal skin. The browser fixture proves the normal developer Widget shape, not an application module. |

## Team-source inspection

No production primitive was extracted from `ui-team` or `server-team` in this
correction. This is evidence-based rather than a repository-location rule:
`sources/ui-team/src/drumee/builtins/messenger/index.js` is intrinsically Team
chat, attachment/MFS and Team-state behaviour, so `Skeletons.Messenger` is
`DEFER_TEAM`. The required generic implementations were available in ui-core
or ui-essentials. The runtime has no `ui-team` or `server-team` runtime import;
the unit source scan enforces that boundary.

## Dependency ownership

`backbone`, `backbone.marionette`, `jquery`, `lodash` and `dompurify` are
private runtime dependencies because real historical LETC classes consume them.
`@drumee/ui-essentials` is intentionally not declared: no production file
imports it. The Validator adapter is a documented transitional CJS boundary,
not a duplicate generic package. A future runtime feature that directly uses
an Essentials export must add and test the pinned dependency explicitly.
