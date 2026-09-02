# @drumee/ui-dev-tools

Development and build tooling for [Drumee](https://drumee.com) front-end
projects.

[![npm](https://img.shields.io/npm/v/@drumee/ui-dev-tools)](https://www.npmjs.com/package/@drumee/ui-dev-tools)

```console
npm i --save-dev @drumee/ui-dev-tools
```

## What it provides

Installing this package runs a `postinstall` hook that symlinks its commands
into your project's `node_modules/.bin`, so they are callable from npm scripts.
It does **not** declare them through `package.json` `bin`.

| Command | Runs |
|---|---|
| `drumee-ui-devel` | Development server with live rebuild |
| `drumee-ui-deploy` | Production build and deploy |
| `drumee-make-widget` | Scaffold a new widget |
| `drumee-build-jitsi` | Build the Jitsi bundle |
| `drumee-build-env` | Write the environment file |

Wire them up in your `package.json`:

```json
{
  "scripts": {
    "dev": "drumee-ui-devel",
    "deploy": "drumee-ui-deploy",
    "add-widget": "drumee-make-widget"
  }
}
```

The hook also copies `.dev-tools.rc` into the parent directory on first install
if it is not already there; that is where per-project overrides live.

This package owns the build and entry-point generation for
[ui-team](https://github.com/drumee/ui-team) — that logic lives here, not in the
consuming repository.

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

MIT — see [LICENSE](LICENSE).
