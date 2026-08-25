# @drumee/ui-essentials

The shared front-end library underneath the Drumee rendering engine.

[![npm](https://img.shields.io/npm/v/@drumee/ui-essentials)](https://www.npmjs.com/package/@drumee/ui-essentials)

```console
npm i @drumee/ui-essentials
```

---

## What it is

The common client-side primitives that both
[`@drumee/ui-core`](https://github.com/drumee/ui-core) and the
[Drumee workspace UI](https://github.com/drumee/ui-team) depend on:

| Path | What it holds |
|---|---|
| `socket/` | Transport — the service call helpers, request headers and file upload |
| `utils/` | Shared utilities — formatting, drag-and-drop data extraction, fonts and other helpers |

`index.js` re-exports the public surface.

## Related

| Package | Role |
|---|---|
| [`@drumee/ui-core`](https://github.com/drumee/ui-core) | The rendering engine built on this |
| [`@drumee/ui-team`](https://github.com/drumee/ui-team) | The Drumee workspace application |

There is no build step here — bundling is handled by the consuming application.

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

AGPL-3.0 — see [LICENSE](LICENSE).
