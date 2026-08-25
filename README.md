# @drumee/ui-core

The Drumee rendering engine — the client-side framework that turns JSON
component trees into a working interface.

[![npm](https://img.shields.io/npm/v/@drumee/ui-core)](https://www.npmjs.com/package/@drumee/ui-core)

```console
npm i @drumee/ui-core
```

---

## What it is

A client-side MVC framework built on Backbone.js and Backbone.Marionette. It
provides **LETC**, a JSON-based UI description system: instead of writing HTML
or templates, you describe a screen as a tree of components, and this library
builds the DOM.

It ships the kind registry, the skeleton builders and the widget
implementations. It has **no build step of its own** — bundling is the job of the
consuming application, which for the Drumee workspace is
[ui-team](https://github.com/drumee/ui-team).

## How it loads

The library is loaded for its side effects. It waits for a
`drumee:bootstraping` DOM event with `name = 'locale'`, then:

1. Loads jQuery, Lodash, Backbone.Marionette and the jQuery-UI draggable and
   resizable behaviours.
2. Patches the Backbone and Marionette prototypes from `letc/addons/`.
3. Exports its globals onto `window`: `Kind`, `Skeletons`, `Preset`, `Template`,
   `Host`, `Visitor`, `Organization`, `DrumeeMFS`, `LetcBox`, `LetcList`,
   `LetcText`, `LetcBlank`.
4. Dispatches `drumee:bootstraping` with `name = 'core'` to signal readiness.

`letc/index.js` is the entry point.

## Layout

| Path | What it holds |
|---|---|
| `letc/` | The engine — bootstrap, addons, kinds, skeletons, widgets |
| `vendor/` | Vendored third-party dependencies |

## Related

| Package | Role |
|---|---|
| [`@drumee/ui-essentials`](https://github.com/drumee/ui-essentials) | Shared front-end library this builds on |
| [`@drumee/ui-team`](https://github.com/drumee/ui-team) | The Drumee workspace application that bundles this |

There is no lint, test or build script in this repository.

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

AGPL-3.0 — see [LICENSE](LICENSE).
