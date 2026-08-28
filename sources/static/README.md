# Drumee Static Assets

Every static file the [Drumee](https://drumee.com) client serves: icons, fonts,
images, locales and sample media.

- **Docs:** [docs.drumee.com](https://docs.drumee.com/introduction/)

---

## What is in here

| Directory | Contents |
|---|---|
| `icons/` | The icon set — the largest part of this repository |
| `fonts/` | Web fonts |
| `images/` | Product and interface imagery |
| `flags/` | Country flags |
| `locale/` | Locale data files |
| `styles/` | Shared stylesheets |
| `videos/`, `musics/`, `sample/` | Sample and demo media |
| `dataset/` | Reference datasets |
| `vendor/` | Vendored third-party assets |

## How it is used

These assets are served to the browser by a running Drumee instance. They are
shipped as part of an install rather than pulled in as an npm dependency: the
`drumee-static` Debian package is built from this repository and installs the
files under `/srv/drumee/static`.

For a local checkout, `npm run setup` writes the development environment file
and `npm run dev` runs the watcher against it.

The icon sources that the workspace UI compiles into sprites live in
[ui-team](https://github.com/drumee/ui-team) under `icons/`; this repository
holds the assets served at runtime.

## Contributing

Adding or replacing an asset is a normal pull request. Keep file sizes sensible
— everything here is downloaded by clients.

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

AGPL-3.0 — see [LICENSE](LICENSE).

Third-party assets under `vendor/`, and any font or media with its own licence,
remain under their original terms.
