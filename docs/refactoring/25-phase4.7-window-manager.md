# Phase 4.7 — standalone Window Manager UI capability

Status: **IMPLEMENTED / VALIDATION IN PROGRESS**

Phase 4.7 was authorized from transient commit
`af553f0770a0ce14b5b930bac928f9621bcc81e4`. The pinned historical source is
`drumee/ui-team` `main` at `0fb6fe4953281cf9f53b87b4d0712bd41c8cf4c3`.

## Historical evidence inspected

Primary paths:

```text
sources/ui-team/src/drumee/builtins/window/core.js
sources/ui-team/src/drumee/builtins/window/interact/index.js
sources/ui-team/src/drumee/builtins/window/manager.js
sources/ui-team/src/drumee/builtins/window/snap.js
sources/ui-team/src/drumee/builtins/window/utils.js
sources/ui-team/src/drumee/builtins/window/skeleton/**
sources/ui-team/src/drumee/builtins/window/skin/**
sources/ui-team/src/drumee/modules/desk/wm/index.js
sources/ui-team/src/drumee/modules/desk/wm/skeleton/**
sources/ui-team/src/drumee/modules/desk/wm/skin/**
sources/ui-team/src/drumee/modules/desk/wm/dock/**
sources/ui-core/letc/index.js
sources/ui-core/package.json
sources/ui-team/package.json
```

The requested `src/drumee/builtins/window/frame.js` does not exist in the
pinned tree. Frame/chrome evidence is distributed across the window skeleton,
topbar controls, skin and individual window implementations.

## Discovered inheritance and dependency graph

```text
historical Desk WM
  -> builtins/window/manager
     -> builtins/window/interact
        -> builtins/window/core
           -> builtins/window/utils
              -> DrumeeMFS

historical interactions
  -> canonical browser jQuery
  -> jQuery UI mouse/draggable/resizable
  -> optional jquery-ui-touch-punch
  -> global Wm workspace containment

extracted Window Manager
  -> ui-runtime READY contract (injected)
  -> canonical browser jQuery
  -> declared jquery-ui draggable/resizable/droppable
  -> injected workspace element
  -> application windows
```

The historical inheritance chain is unsuitable as an extraction boundary:
`utils.js` directly extends `DrumeeMFS`, and `core.js`, `interact/index.js` and
`manager.js` then accumulate media listing, file ordering, upload, clipboard,
identity, service, push and Desk policy. Phase 4.7 therefore retains observed
interaction and lifecycle semantics without copying that inheritance chain.

## Dependency classification

| Dependency or responsibility | Classification | Phase 4.7 decision |
| --- | --- | --- |
| unique window identity and registry | Window Manager intrinsic | retained with an explicit `Map` registry |
| open, mount, activate, close | Window Manager intrinsic | retained |
| active/inactive state and z-order | Window Manager intrinsic | retained; activation monotonically raises z-index |
| header-handle drag, distance 5, start/move/stop | Window Manager intrinsic | retained through one interaction controller |
| all-edge resize, start/live/stop, minimums and bounds | Window Manager intrinsic | retained through one interaction controller |
| optional generic `accept`, `tolerance`, `activate`, `deactivate`, `over`, `out`, `drop` | Window Manager intrinsic | added as the generic form of the historical jQuery UI drop surface |
| interaction destruction | Window Manager intrinsic | explicit draggable/resizable/droppable teardown before DOM removal |
| minimize/restore | Window Manager intrinsic | retained as generic visibility and focus transfer |
| maximize and left/right snap | Window Manager intrinsic | retained from generic geometry evidence in `snap.js` |
| workspace containment | generic injected dependency | the manager workspace replaces global `Wm`/Desk lookup |
| application minimum/default dimensions | generic injected dependency | per-window options; no application dimensions in core |
| LETC bootstrap readiness | ui-runtime contract | READY runtime may be injected and is validated before manager creation |
| Widget content | ui-runtime/application contract | applications mount their own LETC widgets into the generic body region |
| jQuery | ui-runtime/browser contract plus declared dependency | one canonical bundled instance; no hidden parent resolution |
| jquery-ui draggable/resizable/droppable | optional interaction dependency | direct declared dependency, lazily loaded only in a browser DOM |
| jquery-ui mouse | transitive jQuery UI primitive | loaded by the three declared widget modules |
| jquery-ui-touch-punch | historical/optional | audited but excluded; desktop pointer behavior is validated, touch emulation is not claimed |
| `rectangle-node` | MFS-specific interaction geometry | excluded; it computes media insertion rectangles, not window geometry |
| GSAP/Tween classes | historical animation implementation | excluded; not required for correct lifecycle/geometry |
| `Visitor` identity/device state | application/legacy coupling | excluded |
| `Kind`, `_K`, `_a`, `_e`, radios | mixed runtime globals and legacy component vocabulary | no new hidden dependency; package API uses explicit data/options/events |
| `window.Wm`, `window.Desk` | legacy Desk coupling | excluded |
| native file drag/upload | MFS/Desk-specific | excluded |
| media/folder selection and insertion | Finder/MFS-specific | excluded |
| clipboard and file operations | MFS/Desk-specific | excluded |
| workspace/hub navigation and deep links | Desk-specific | excluded |
| chat, conference, tasks and contacts | Team-specific | excluded |
| notification and WebSocket interpretation | Desk/application-specific | excluded |
| backend APIs and capability availability | out of scope | no backend dependency or call |

## Historical behavior retained and adapted

`builtins/window/interact/index.js::setupInteract` establishes the authoritative
interaction shape: drag begins only from the explicit header, uses a five-pixel
threshold, does not scroll, fires start/stop lifecycle hooks and synchronizes
geometry. Resize uses all handles, application/window minimums, live resize,
stop synchronization and viewport maximums. The extraction preserves those
semantics, derives maximums and containment from the explicit workspace, and
adds matching cleanup.

Generic drop targeting uses the same jQuery UI family but remains independent
from movement of the window itself. It is disabled by default. Callbacks receive
the target window, DOM event, jQuery UI object, draggable DOM element and opaque
application payload. Core never assigns meaning to that payload.

`builtins/window/snap.js` contains separable clamping, maximize/restore and side
tile ideas. Phase 4.7 keeps those useful generic states with workspace-relative
geometry. Browser native fullscreen is not required for the minimum capability
and remains out of the stable public surface.

The historical Desk manager demonstrates a windows pool, active-window lookup,
launch/append and focus transfer. Its remaining responsibilities—workspace and
hub routing, deep links, notifications, media, uploads, clipboard file actions,
push handling, checkout, Visitor state, context menus and application launch
policy—are not Window Manager core and are excluded.

## Extracted boundary and public API

The transitional implementation is `target/modules/window-manager/`, structured
as the package `@drumee/window-manager@0.1.0-alpha.1`. Its stable surface is:

```text
createWindowManager(options)
WindowManager
  create / register / open
  get / windows
  activate
  close / destroy

ManagedWindow
  open / close / destroy
  geometry / applyGeometry
  minimize / restore
  toggleMaximize / snap
  on
```

Window options configure `draggable`, `resizable`, `droppable`, `min_width`,
`min_height`, initial `geometry`, title and content. Internal registry mutation
and interaction bookkeeping are not presented as application API.

## Validation contract

The package browser test builds through CommonJS/Webpack and uses Chrome
DevTools mouse input against real jQuery UI handles. It proves three distinct
windows, focus/z-order, header-only dragging, geometry containment, all-edge
resizing with minimum enforcement, a generic draggable token accepted by only
one configured drop target, `over`/`out`/single `drop`, unaffected sibling
windows, close/focus transfer and destruction of all three interactions.

The transient integration test additionally boots the real `ui-runtime`, mounts
real LETC content into the windows and repeats physical browser interaction. No
backend service or optional system module participates.

Production static checks exclude hidden application, Desk, backend, historical
source and global-manager dependencies. Standalone extraction, artifact
isolation, synchronization and complete regression results are recorded below
when Phase 4.7 validation closes.

## Touch support level

Desktop mouse/pointer behavior is supported and validated in Chromium. The
window header uses `touch-action: none` as a safe CSS prerequisite, but no touch
device/emulation proof is part of Phase 4.7. `jquery-ui-touch-punch` historically
patched the mouse widget and was loaded conditionally by Desk; it is not needed
for the validated desktop contract and is not declared. Phase 4.7 therefore
does not claim touch drag/resize support.

## Closure evidence

Pending final standalone repository extraction, artifact-isolation results,
synchronization result, full regression matrix and final commit identities.

Phase 4.8 Finder remains **NOT AUTHORIZED**.
