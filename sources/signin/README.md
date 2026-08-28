# @drumee/signin

The [Drumee](https://drumee.com) sign-in widget, bundled so it can be embedded
outside the main workspace application.

## What it is

A standalone build of the sign-in interface, built on the Drumee rendering model
— the UI is described as JSON component trees rather than written as HTML.

| Path | Contents |
|---|---|
| `src/index.js` | Entry point |
| `src/widgets/` | The widget implementations |
| `src/seeds.js` | The widget map |
| `src/locale/` | User-facing strings |
| `webpack/` | Bundle configuration |
| `patches/` | Dependency patches |

## Development

```console
npm install
npm run dev
```

Per-project settings live in `.dev-tools.rc` — adjust `devel.sh` there before
the first run so the dev server points at your instance.

```console
npm run stage      # staging build
npm run deploy     # production build and deploy
```

## Built on

[`@drumee/ui-toolkit`](https://github.com/drumee/ui-toolkit) and
`@drumee/ui-styles`.

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).
