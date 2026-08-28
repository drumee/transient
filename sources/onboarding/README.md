# Drumee Onboarding Pages

The static onboarding and feature pages for [Drumee](https://drumee.com) —
plain HTML with Sass-compiled styles, no application framework.

## Layout

| Path | Contents |
|---|---|
| `src/pages/` | The page templates |
| `src/partials/` | Shared fragments |
| `src/scss/` | Sass sources — `home.scss` and `features.scss` are the entry points |
| `src/js/` | Page scripts |
| `src/assets/` | Images and other assets |
| `src/data/` | Page content data |
| `dist/css/` | Compiled CSS output |

## Development

```console
npm install
npm run dev        # watch src/scss and recompile into dist/css
npm run serve      # serve the pages on http://localhost:8080
```

`serve` uses Python's built-in HTTP server, so Python 3 needs to be available.

## Building

```console
npm run sass:build         # compile home.scss and features.scss
npm run sass:build:prod    # same, minified
```

## Related

The onboarding **flow** — its state, services and analytics — lives in
[onboarding-server](https://github.com/drumee/onboarding-server), with its
interface in [onboarding-ui](https://github.com/drumee/onboarding-ui).

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).
