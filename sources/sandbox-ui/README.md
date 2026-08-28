# Drumee Sandbox — UI

The front-end of the Drumee sandbox: a small, self-contained example of building
an interface on the [Drumee](https://drumee.com) rendering engine.

Its back-end counterpart is
[sandbox-server](https://github.com/drumee/sandbox-server).

## What it shows

How a Drumee application is put together when it is not the full workspace —
a loader, a widget tree, locale files and styles, bundled standalone.

| Path | Contents |
|---|---|
| `index.html` | Initial loader — pulls in the Drumee rendering engine |
| `app/index.js` | Application entry point, run once the engine is ready |
| `app/bootstrap.js` | Bootstrap sequence |
| `app/skeleton/` | The JSON component trees that describe the UI |
| `app/skin/` | Styles |
| `app/locale/` | User-facing strings |
| `app/user/` | User-facing views |
| `webpack/` | Bundle configuration |

There is no HTML to write beyond the loader: the interface is described as
`Skeletons.*` trees and rendered on the client.

## Development

```console
npm install
npm run dev        # development server
npm run deploy     # production build and deploy
```

You need a Drumee runtime to talk to — see the
[getting-started guides](https://docs.drumee.com/getting-started).

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

AGPL-3.0 — see [LICENSE](LICENSE).
