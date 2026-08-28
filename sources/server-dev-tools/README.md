# @drumee/server-dev-tools

Development tooling for [Drumee](https://drumee.com) back-end services.

[![npm](https://img.shields.io/npm/v/@drumee/server-dev-tools)](https://www.npmjs.com/package/@drumee/server-dev-tools)

```console
npm i --save-dev @drumee/server-dev-tools
```

## What it provides

Installing this package runs a `postinstall` hook that symlinks its commands
into your project's `node_modules/.bin`, so they are callable from npm scripts.
It does **not** declare them through `package.json` `bin`.

| Command | Runs |
|---|---|
| `drumee-server-devel` | Development server with live reload |
| `drumee-server-deploy` | Build and deploy |
| `drumee-server-plugin` | Register or remove a server plugin |
| `drumee-server-endpoint` | Manage development endpoints |

Wire them up in your `package.json`:

```json
{
  "scripts": {
    "dev": "drumee-server-devel",
    "deploy": "drumee-server-deploy",
    "register-plugin": "drumee-server-plugin"
  }
}
```

On first install the hook also copies `.dev-tools.tpl` to `.dev-tools.rc` in the
parent directory; that is where per-project settings live.

Used by [schemas](https://github.com/drumee/schemas),
[setup](https://github.com/drumee/setup) and
[setup-schemas](https://github.com/drumee/setup-schemas).

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

MIT — see [LICENSE](LICENSE).
