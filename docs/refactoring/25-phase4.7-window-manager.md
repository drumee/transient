# Phase 4.7 — standalone Window Manager UI capability

Status: **CLOSED / VALIDATED / NOT PUBLISHED**

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
source and global-manager dependencies.

## Touch support level

Desktop mouse/pointer behavior is supported and validated in Chromium. The
window header uses `touch-action: none` as a safe CSS prerequisite, but no touch
device/emulation proof is part of Phase 4.7. `jquery-ui-touch-punch` historically
patched the mouse widget and was loaded conditionally by Desk; it is not needed
for the validated desktop contract and is not declared. Phase 4.7 therefore
does not claim touch drag/resize support.

## Standalone extraction and authority

```text
repository path:   /home/somanos/github/window-manager
intended remote:   git@github.com:drumee/window-manager.git
branch:            main
package:           @drumee/window-manager@0.1.0-alpha.1
standalone commit: 60eee8b11a787703801b467c8b83e69f5b2cb508
publication:       NOT PUBLISHED
```

The repository was extracted with `git subtree split`, preserving the Phase
4.7 path history. The standalone checkout is authoritative. Transient consumes
its browser entry in the integration proof through an explicit Webpack alias;
`target/modules/window-manager/` remains only a synchronized fixture.
`scripts/check-window-manager-sync.js` compares full inventories and contents,
excluding only repository/generated artifacts, and reports 18 synchronized
files.

Creating the intended GitHub repository was attempted, but the current GitHub
token lacks `createRepository` permission. The local standalone repository and
remote configuration are complete; hosting creation/push remains external
technical debt and does not change package isolation or runtime validation.

## Artifact isolation

`npm pack --json` from the standalone repository produced:

```text
filename:       drumee-window-manager-0.1.0-alpha.1.tgz
files:          11
package size:   7,207 bytes
unpacked size:  24,247 bytes
shasum:         c2474f99f9a56eb786301751465c2d961d7ae400
integrity:      sha512-XPizf3Cmqg4wu2oYedZ19NvyvELNN6ChGLyNy0D8UA7zkr4jOK35GYpI5rEfrL+NrFA9QmYnjPPY3EThDqH+aQ==
```

The archive contains only `LICENSE`, `README.md`, `PROVENANCE.md`, `package.json`,
six `lib/*.js` files and `skin/window-manager.css`. Installation in a clean
temporary directory with empty `NODE_PATH` and no transient/sibling fallback
loaded all six public exports and resolved the CSS inside the installed
package. Runtime dependencies are exactly `jquery@3.7.1` and
`jquery-ui@1.14.2`; `@drumee/ui-runtime` is a documented optional peer because
the embedding application supplies the READY runtime and canonical jQuery.

The publish command, deliberately not run, is:

```bash
npm publish --tag next --access public
```

## Validation results

```text
standalone window-manager:       4/4
Phase 4.7 ui-runtime browser:    1/1
server-runtime package:         32/32
ui-runtime package:             21/21
ui-runtime browser:              2/2
platform-bootstrap package:      7/7
system-mfs package:               9/9
hello package:                    6/6
Phase 3 hello browser:            2/2
Phase 4 authenticated private:    1/1
Phase 4.4 WebSocket/push:          1/1
Phase 4.5 artifact isolation:      1/1
Phase 4.6A platform bootstrap:     1/1
Phase 4.6B system-mfs:             2/2
R2 system-mfs synchronization:   17 files
Phase 4.7 synchronization:       18 files
```

The first Phase 4.5 attempt collided with its own disposable database after an
earlier interrupted parallel invocation. Targeted cleanup showed no remaining
namespace, and the unchanged test passed serially, including its nested Phase 4
and Phase 4.4 clean/upgrade artifact runs. A later direct Phase 4.4 invocation
was user-interrupted; targeted cleanup found no remaining containers, and the
unchanged direct test then passed. These were environmental interruptions, not
product defects.

The Phase 4.7 browser proofs use actual Chrome DevTools mouse input. They do not
assign style geometry as a substitute for interaction. Window A is dragged by
its header and retains its clamped coordinates; dragging its body does not move
it. Window B is resized through its real southeast handle and respects minimums.
The generic token triggers `over`, `out` and exactly one accepted `drop` on A;
B is not a drop target. Closing B destroys all three jQuery UI behaviors,
removes its registry/DOM state and leaves A/C operational. The transient proof
boots real `ui-runtime`, shares its canonical jQuery instance and mounts real
LETC Notes in all three windows. No backend or MFS capability is installed or
called.

All new data fields follow `snake_case`; historical/component method style is
preserved. New engineering documentation and comments are English.

Phase 4.8 Finder remains **NOT AUTHORIZED**.
