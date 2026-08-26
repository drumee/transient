# @drumee/ui-toolkit

The shared widget library for [Drumee](https://drumee.com) interfaces.

[![npm](https://img.shields.io/npm/v/@drumee/ui-toolkit)](https://www.npmjs.com/package/@drumee/ui-toolkit)

```console
npm i @drumee/ui-toolkit
```

## What it provides

Ready-made widgets and their presentation, built for the LETC rendering model —
components are described as JSON trees rather than written as HTML.

| Path | Contents |
|---|---|
| `widgets/` | The widget implementations |
| `skeletons/` | Skeleton definitions — the JSON component trees |
| `skin/` | Widget styles |
| `templates/` | Shared templates |
| `seeds.js` | The widget map consumers register |

Used by [ui-team](https://github.com/drumee/ui-team) and
[signin](https://github.com/drumee/signin).

There is no build step here — bundling is the consuming application's job.

## Related

[`@drumee/ui-core`](https://github.com/drumee/ui-core) (the rendering engine) ·
[`@drumee/ui-essentials`](https://github.com/drumee/ui-essentials) (shared library)

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

MIT — see [LICENSE](LICENSE).
