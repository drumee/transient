# Drumee Onboarding Server

The back-end behind Drumee's onboarding flow, plus the analytics endpoints that
record how it is going.

## What it provides

| Service | ACL | Handles |
|---|---|---|
| `onboarding` | `acl/onboarding.json` | The onboarding steps and their state |
| `analytics` | `acl/analytics.json` | Onboarding analytics endpoints |

Implementations are in `service/`, email and page templates in
`service/templates/`, and the database objects this plugin owns in
`schemas/tables/` and `schemas/procedures/`.

Its front-end counterpart is
[onboarding-ui](https://github.com/drumee/onboarding-ui).

## Running it

This is a Drumee server plugin: it runs inside a Drumee server runtime.

```console
npm install
npm run register-plugin
npm run dev
npm run deploy
npm run remove-plugin
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

Apache-2.0 — see [LICENSE](LICENSE).
