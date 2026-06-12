# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

`@drumee/ui-toolkit` is a published npm package (ESM) of reusable Drumee UI widgets — OTP entry, modal dialog, and a password setter/strength meter. It has **no build, test, or lint step of its own**. The source ships as-is and is compiled, bundled, and run by the host Drumee application that consumes it. The webpack/babel/sass/unocss `devDependencies` in `package.json` exist to mirror the consumer's toolchain expectations, not to build anything here.

The only npm script is `release` (`git push && npm publish --access public && npm version patch`).

## Critical context: globals are injected by the host runtime

This is the single most important thing to understand. The code relies on a large set of **implicit globals that are never imported** — they are provided at build/runtime by the consuming Drumee app (via webpack ProvidePlugin / global injection). Do not add imports for these; do not expect to find their definitions in this repo. The main ones:

- `Skeletons` — DOM-builder factory namespace (`Skeletons.Box.X/Y/G`, `Skeletons.Entry`, `Skeletons.EntryBox`, `Skeletons.Element`, `Skeletons.Note`, `Skeletons.Button.Svg`). Almost every skeleton file is built from these.
- `LetcBox` — base UI component class that all widgets ultimately extend.
- `Kind` — the addon registry; `Kind.registerAddons(...)`, `Kind.waitFor(...)`.
- `LOCALE` — i18n string table (`LOCALE.PASSWORD`, `LOCALE.INVALID_CODE`, ...). Strings support `.format(...)`.
- `SERVICE` — backend service endpoint map (e.g. `SERVICE.otp.send`).
- `_a`, `_e`, `_K` — enum/constant namespaces: `_a` = attribute/field names (`_a.email`, `_a.input`, `_a.y`), `_e` = event/status values (`_e.commit`, `_e.click`, `_e.submit`), `_K` = framework constants (`_K.tag.span`).
- `_` (underscore/lodash), `__filename`, `__dirname`.

When editing, reuse the existing constants (`_a.*`, `_e.*`) rather than introducing string literals — that's the established convention.

`@drumee/ui-essentials` (e.g. `arcLength` in `templates/progress.js`) and `@drumee/ui-styles` (SCSS mixins/tokens) are sibling Drumee packages. `ui-essentials` is a peer provided by the host and is **not** present in `node_modules` here.

## Architecture

### Widget anatomy
Every widget lives in `widgets/<name>/` and is composed of three parts:

1. **`index.js`** — the component class. Extends `dtk_common` (which extends `LetcBox`); `dtk_pwsetter` extends `LetcBox` directly. Lifecycle: `initialize(opt)` → `declareHandlers()` + initial `mset(...)`, then `onDomRefresh()` calls `this.feed(require('./skeleton').default(this))` to render. `onUiEvent(cmd, args)` is the event router — it switches on a `service` string and calls `this.triggerHandlers(...)`. The file's first line is typically `require('./skin')` to pull in styles.
2. **`skeleton/index.js`** — a pure function `(ui) => Skeletons.Box.Y({...})` that returns the DOM tree. Reads state via `ui.model.toJSON()` / `ui.mget(...)`. Composes shared pieces from the top-level `skeletons/`.
3. **`skin/index.scss`** — styles. Declares `.dtk-butler-<name>` and `@include`s the shared mixins (`dtk-butler-main`, `dtk-butler-button`) defined in `skin/`.

State flows through the component's model: `mset`/`mget`/`getData`/`model.toJSON`. `sys_pn` names a sub-part so the class can reach it later via `ensurePart(name)` (async) or generated `this.__<camelCasePartName>` references (e.g. `sys_pn: "message-text"` → `this.__messageText`).

### Shared code
- **`skeletons/index.js`** — reusable skeleton builders shared across widgets: `button`, `header`, `entry`, `password`, `password_box`, `dialog_box`. New widgets should compose these, not duplicate them.
- **`skin/index.scss` + `skin/skin.scss`** — shared SCSS mixins (`dtk-butler-main`, `dtk-butler-button`) consumed via `@use '../../../skin' as *;`.
- **`widgets/index.js`** — exports `dtk_common`, the common base class (extends `LetcBox`) with helpers `setItemState`, `setItemStatus`, `onServerComplain`.
- **`templates/progress.js`** — a raw-HTML SVG template (circular progress) returned as a string, separate from the Skeletons builder style.

### Registration / entry point
- **`index.js`** exports `loadSeeds()`, which calls `Kind.registerAddons(require('./seeds'))`.
- **`seeds.js`** maps kind names to lazy dynamic imports: `dtk_otp`, `dtk_dialog`, `dtk_pwsetter`. Widgets are loaded **explicitly/lazily** — adding a new widget means adding it both here and (if it should ship) wiring its directory. A widget is then instantiated by the host via its kind name (e.g. `{ kind: 'dtk_pwsetter', sys_pn: 'pwsetter' }` inside a skeleton's `kids`).

## Adding a widget
1. Create `widgets/<name>/{index.js, skeleton/index.js, skin/index.scss}` following an existing widget (otp is the richest example).
2. Class extends `dtk_common`; `require('./skin')` at top; implement `initialize`, `onDomRefresh`, `onUiEvent`.
3. Register the kind name → `import('./widgets/<name>')` in `seeds.js`.
4. Reuse builders from `skeletons/` and mixins from `skin/`; route events through `service` strings using `_a.*`/`_e.*` constants.
