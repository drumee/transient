# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

`@drumee/ui-core` is the Drumee Rendering Engine Core Library — a client-side MVC framework built on top of Backbone.js and Backbone.Marionette. It provides a JSON-based UI description system called **LETC** (along with a kind registry, skeleton builders, and widget implementations) that the consuming Drumee application bundles with webpack/rollup. This package has no build step of its own.

## Release

```bash
npm run release   # git push + npm publish --access public + npm version patch
```

There is no lint, test, or build script in this repo. Bundling is handled by the consuming application.

## Architecture

### Bootstrap sequence (`letc/index.js`)

The library is loaded as a side-effect. It listens for a `drumee:bootstraping` DOM event fired with `name = 'locale'`, then:
1. Loads jQuery, Lodash, Backbone.Marionette, and jQuery-UI draggable/resizable.
2. Patches Backbone and Marionette prototypes via `letc/addons/`.
3. Exports globals onto `window`: `Kind`, `Skeletons`, `Preset`, `Template`, `Host`, `Visitor`, `Organization`, `DrumeeMFS`, `LetcBox`, `LetcList`, `LetcText`, `LetcBlank`.
4. Dispatches `drumee:bootstraping` with `name = 'core'` to signal readiness.

### LETC descriptor format

All UI is described as plain JSON objects called **LETC descriptors**:

```js
{
  kind: "box",           // required — maps to a widget class via Kind.get()
  kids: [...],           // child descriptors (immediate children)
  items: [...],          // data items (used by menu, list widgets — not direct children)
  styleOpt: {...},       // CSS applied via jQuery .css()
  className: "...",      // extra CSS classes
  uiHandler: [view],     // views that receive ui:event on click
  partHandler: [view],   // views that receive part:ready registration
  sys_pn: "partName",    // registers self as a named part on partHandler
  volatility: 1,         // 0=permanent 1=click-outside 2=click-anywhere 4=pointer-down+timeout
  flow: "x"|"y",         // layout axis (data-flow attribute)
  active: 0|1,           // 0=no event handlers wired
  kidsOpt: {...},        // object merged into every child descriptor
  kidsMap: {...},        // remap child attribute keys { from: to }
  populate: [...],       // builder: first element is template, rest are merged into it as kids
  signal: "event:name",  // custom event emitted to uiHandler instead of default ui:event
  bubble: false|"sig",   // false stops propagation; string triggers that signal up the tree
  tooltips: "text"|{...},// tooltip on hover
  contextmenuSkeleton: fn|array, // right-click context menu
}
```

`view.feed(descriptor)` / `view.append(descriptor)` / `view.prepend(descriptor)` add children at runtime. `view.toLETC()` serializes the live view tree back to a descriptor.

### Kind system (`letc/kind/`)

`window.Kind` is a singleton registry (`letc/kind/index.js`) mapping string keys to widget constructors.

- `Kind.get("box")` — returns the constructor synchronously, or a lazy-loading placeholder class for add-on kinds.
- `Kind.waitFor("some_addon")` — returns a Promise that resolves to the constructor after async loading.
- `Kind.register(key, WidgetClass)` — registers an app-level kind (cannot override system kinds).
- `Kind.replace(key, WidgetClass)` — replaces an existing app-level kind (cannot replace system kinds).
- `Kind.registerAddons(map)` — registers dynamic imports `{ kind: () => import('./widget') }`.
- `Kind.loadPlugin({ name, kind })` — fetches a remote JS plugin and registers it as a kind.

Static (built-in) kinds live in `letc/kind/seeds/static.js`. Key static kind names: `box`, `blank`, `wrapper`, `menu_topic`, `text`, `note`, `rich_text`, `list_smart`, `list_table`, `profile`, `spinner`, `entry`, `entry_input`, `entry_reminder`, `entry_search`, `entry_text`, `fileselector`, `iframe`, `image_smart`, `image_svg`, `svg`, `progress`.

`window.KIND` is a **nested** frozen object of built-in kind name groups (e.g. `KIND.menu.base` → `"menu"`, `KIND.image.smart` → `"image_smart"`). It is distinct from the flat string keys used with `Kind.get()`.

### View model architecture (`letc/addons/letc.js`)

Every view has multiple `Backbone.Model` instances initialized in `View.prototype.initialize`:

| Property | Populated from | Purpose |
|---|---|---|
| `this.model` | descriptor (all fields) | primary model; `mget(k)` / `mset(k,v)` shortcuts |
| `this.style` | `styleOpt` / `style` | CSS properties applied via `$el.css()` on `refresh()` |
| `this.attribute` | `attrOpt` / `attribute` + `dataset` | HTML attributes set with `setAttribute()` |
| `this.icon` | `styleIcon` | icon dimensions/style |
| `this.pseudo` | `stylePseudo` | CSS pseudo-element styles |
| `this.mobile` | `styleMob` | mobile-screen CSS overrides |

`this.fig` is computed from the constructor name and gives `{ group, family, name }` used for BEM CSS classes on the element.

### Addons (`letc/addons/`)

Prototype patches loaded in order:
- **Native types** (`array.js`, `map.js`, `number.js`, `string.js`): utility methods — `.bem()` for BEM class names, `.px()` for pixel strings, etc.
- **Backbone.Model** (`backbone/model.js`): `.atLeast(defaults)`, `.extend(key, obj)`, `.mget(k)` / `.mset(k,v)` convenience methods.
- **Backbone.View** sub-addons (`backbone/view/`):
  - `utils.js` — `mget`, `mset`, `get`, `softDestroy`, `goodbye`, `selfDestroy`, `anim`, `spinner`, `renderVector`
  - `state.js` — `setState`, `getState`, `toggleState`
  - `style.js` — `getActualStyle`, CSS utilities
  - `tree.js` — `contains`, `getIndex`, `getRoot` tree traversal
  - `event.js` — `fireEvent` (bubbles through `parent` chain)
  - `viewport.js` — viewport detection helpers
  - `behavior/` — reusable behaviors: `flyover`, `radio`, `radio-toggle`, `toggle`, `wrapper`
- **Backbone.View** (`letc/addons/letc.js`): the heaviest patch — adds `initialize`, `onRender`, `onBeforeRender`, `triggerHandlers`, `getHandlers`, `registerPart`, `refresh`, `declareHandlers`, `toLETC`, `renew`, `waitElement`, `ensureElement`, `actualNode`, `getData`
- **Marionette.View** (`marionette/view.js`): `.cut()` / `.suppress()` remove self from parent collection
- **Marionette.CollectionView** (`marionette/collection-view.js`): `childView`, `childViewOptions`, `buildChildView`, `emptyView`, `getPart`, `ensurePart`, `respawn`, `suppress`, `removePart`, `fireEvent`

### Creator module (`letc/creator/`)

Mixes additional methods into Marionette.View prototypes loaded after addons:
- `creator/respawn.js` — `respawn(data)` on `Marionette.View`: in-place re-render by diff-updating the view's sub-models (`style`, `icon`, `attribute`, `data`, `schema`) from a new descriptor without destroying and recreating the view.
- `creator/behavior.js` — wires shared behaviors.
- `creator/serialize.js` — serialization helpers.

### Skeleton builders (`letc/toolkit/`)

Skeletons are **factory functions** that accept `(props, style)` and return a LETC descriptor. They do not create DOM.

Builder pipeline: `props` → `letc/toolkit/core.js` (field normalization: `cn`→`className`, `ui`→`uiHandler`, `part`→`partHandler`, `item`→`itemsOpt`) → `letc/toolkit/builder.js` (applies `kidsOpt` merge into `kids`, expands `populate` array into `kids`).

`window.Skeletons` (from `letc/toolkit/skeletons.js`) exposes:
- `Skeletons.Box.X(props)` / `.Y(props)` / `.Z(props)` / `.G(props)` — flex containers on x/y/z/grid axis
- `Skeletons.Wrapper.X` / `.Y` — wrapper containers
- `Skeletons.Button.Icon` / `.Label` / `.Svg` — button variants
- `Skeletons.Entry(props)`, `Skeletons.EntryBox(props)`, `Skeletons.Textarea(props)` — form inputs
- `Skeletons.Image.Smart` / `.Svg` — image widgets
- `Skeletons.List.Scroll` / `.Smart` / `.Table` — list widgets
- `Skeletons.Menu(props)`, `Skeletons.Avatar(props)`, `Skeletons.Profile(props)`, `Skeletons.Note(props)`, `Skeletons.RichText(props)`, `Skeletons.Progress(props)`, `Skeletons.Messenger(props)` etc.

### Widgets (`letc/widgets/`)

Concrete Marionette view classes. Each `index.js` exports a class that corresponds to a kind key. Key widget:

- **`LetcBox`** (`widgets/box/index.js`) — extends `Marionette.CollectionView`. The primary container widget. Provides `feed`, `append`, `prepend`, `clear`, `reload`, `replace`, `carry`, `findPart`, `getItemsByAttr`, `getData` (form data collection), `validateData`.

Most other widgets extend `LetcBox` or `Marionette.View`.

**Widget `skeleton` property**: if a widget class defines `this.skeleton` (function or descriptor), `onRender` calls `this.feed(skeleton)` automatically after the element is attached. This is the standard pattern for self-contained widgets.

### Global singletons

| Global | Source | Description |
|---|---|---|
| `window.Kind` | `letc/kind/index.js` | Widget class registry |
| `window.KIND` | `letc/index.js` | Frozen nested object of built-in kind name constants |
| `window.Skeletons` | `letc/toolkit/skeletons.js` | Skeleton factory namespace |
| `window.Preset` | `letc/preset/` | Pre-built UI patterns (Button, ConfirmButtons, List, Utils) |
| `window.Template` | `letc/preset/template.js` | Template helpers |
| `window.Validator` | `@drumee/ui-essentials` | Input validator |
| `window.Host` | `letc/host.js` | `Backbone.Model` for site/org info |
| `window.Visitor` | `letc/user.js` | `Backbone.Model` for the current user session |
| `window.Organization` | `letc/organization.js` | `Backbone.Model` for organization data |
| `window.Platform` | `letc/index.js` | `Backbone.Model` for platform/device info |
| `window.Env` | `letc/index.js` | `Backbone.Model` for environment config |
| `window.DrumeeMFS` | `letc/mfs.js` | Media filesystem mixin class |

### Event bus globals

The codebase assumes `RADIO_CLICK`, `RADIO_POINTER`, `RADIO_BROADCAST`, `RADIO_MEDIA` Backbone.Radio channels are available (provided by the consuming application), as well as `_a` (attribute constants), `_e` (event constants), `_K` (system constants), `_c`, `SERVICE`, `bootstrap()`, `Dayjs`, and `LOCALE`.

### Part system

Named sub-views: a child with `sys_pn: "name"` registers itself on the nearest ancestor that called `this.declareHandlers({ part: 'single'|'multiple' })`. Access registered parts via `view._branches["name"]` or `view.__camelCaseName`. Wait for async registration with `view.ensurePart("name")` (returns a Promise). `feedPart(name, content)` and `clearPart(name)` are convenience helpers on `LetcBox`.

### Handler / event routing

Click events flow from child → `uiHandler` list via `triggerHandlers`. Views declare themselves as handlers with `this.declareHandlers({ ui: 'single'|'multiple', part: 'single'|'multiple' })`. `getHandlers('ui')` walks up `this.parent` chain to find implicit handlers when no explicit `uiHandler` is set.

Default signal is `ui:event`; override with `signal: "custom:event"` in the descriptor. Set `bubble: false` to stop propagation, or `bubble: "signal:name"` to re-emit with a different signal.

### Animation

Uses **GSAP 3** (`gsap` package) via a thin animejs v4-compatible shim at `letc/vendor/anime.js`. The shim exposes `anime.animate(el, opts)`, `anime.set(el, opts)`, and `anime.createTimeline()` — mapping animejs option names (duration in ms, `easing`, `onBegin`, `translateX`/`translateY`, array `[from,to]` syntax) to their GSAP equivalents. Entry point: `require('letc/vendor/anime')` or the global `window.anime` set in `letc/index.js`. View helpers: `view.selfDestroy(opts, animProps)`, `view.goodbye()`, `view.softDestroy()` all drive animations before destroying the view.

### Authoring a new widget

Minimal widget pattern:

```js
const LetcBox = require('../box');

class __my_widget extends LetcBox {
  static initClass() {
    this.prototype.nativeClassName = 'my-widget'; // base CSS class
  }

  initialize(opt) {
    super.initialize(opt);
    this.declareHandlers({ ui: 'single', part: 'single' });
  }

  // Auto-fed after render if defined
  skeleton(self) {
    return Skeletons.Box.Y({
      kids: [ /* descriptors */ ]
    });
  }

  onUiEvent(source, e) { /* handle clicks from children */ }

  onPartReady(child, partName) { /* respond to sys_pn registration */ }
}
__my_widget.initClass();
module.exports = __my_widget;
```

Register in `letc/kind/seeds/static.js` (built-in) or via `Kind.register('my_widget', require('./my-widget'))` at app startup. Class names use double-underscore prefix by convention (`__widget_name`) — the `fig.family` computed from constructor name drives data-kind attributes and BEM CSS classes.
