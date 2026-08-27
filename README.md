# Drumee Sandbox Server — plugin example

A minimal, working example of a [Drumee](https://drumee.com) server plugin. If
you are adding services to Drumee, start by reading this repository — it is
small enough to hold in your head.

Its front-end counterpart is
[sandbox-ui](https://github.com/drumee/sandbox-ui).

## What a plugin looks like

| Path | Role |
|---|---|
| `acl/sandbox.json` | Declares the callable services and the privilege each one requires |
| `service/index.js` | Implements them |
| `service/lib/` | Supporting code |
| `schemas/tables/`, `schemas/procedures/` | Database objects the plugin owns |
| `schemas/avatar.sql` | Example schema object |

The ACL file is the contract: nothing is reachable unless it is declared there.

## Installing it into a runtime

A plugin runs inside a Drumee server runtime rather than on its own.

```console
git clone https://github.com/drumee/sandbox-server.git
cd sandbox-server
npm install
npm run register-plugin
```

Then restart the Drumee server so it picks up the new services. To take it out
again, run `npm run remove-plugin`.

```console
npm run dev        # development mode
npm run deploy     # build and deploy
```

To get a runtime to develop against, follow the
[getting-started guides](https://docs.drumee.com/getting-started).

## Built on

[`@drumee/server-core`](https://github.com/drumee/server-core) and
[`@drumee/server-essentials`](https://github.com/drumee/server-essentials).

## Contributing

See the org [CONTRIBUTING guide](https://github.com/drumee/.github/blob/main/CONTRIBUTING.md).
Questions: [Discussions](https://github.com/orgs/drumee/discussions).

## License

AGPL-3.0 — see [LICENSE](LICENSE).
