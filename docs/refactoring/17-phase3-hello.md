# Phase 3 — Hello Vertical Slice

## Result

`target/modules/hello/` is the sole synthetic Phase 3 module. It validates the
application-neutral kernel without becoming a product or a module framework.

```text
browser
  → ui-runtime READY
  → Kind.loadPlugin({ name: "hello", kind: "hello" })
  → GET /-/svc/bootstrap.plugin?name=hello
  → server-runtime ACL/Worker dispatch
  → hello index.json → loadJS(bundle) → Kind.registerAddons
  → HelloWidget (LetcBox) → Skeletons.Note
  → POST /-/svc/hello.ping
  → server-runtime ACL/Worker dispatch → response → Widget re-render
```

The end-to-end browser test proves the kind is absent before dynamic loading,
registered only by the bundle afterwards, and renders `Status: Hello from
Drumee` from the real HTTP response.

## Backend

`target/modules/hello/server/acl/hello.json` is a normal ACL descriptor:

```json
{
  "permission": {
    "src": "anonymous",
    "fast_check": "public-api"
  }
}
```

The descriptor resolves `hello.ping` to
`target/modules/hello/server/service/hello.js::HelloWorker.ping`. The worker
returns deterministic `{ ok: true, message: "Hello from Drumee", module:
"hello" }` data and does not read state.

The normal `DescriptorRegistry → ServiceDispatcher` path parses
`module.method`, selects the public implementation for an anonymous session,
authorizes the existing DB-free `public-api` fast path, requires the Worker
only on first invocation, caches its class, constructs it and invokes `ping`.
`target/modules/hello/test/hello.test.js` proves no class is loaded before the
first invocation and that two invocations use one WorkerClass load. It also
proves a descriptor without `fast_check: "public-api"` yields
`PERMISSION_DENIED`; Hello is not an ACL bypass.

`server-runtime` now exposes `bootstrap.plugin` as an ordinary generic ACL
service through `service/bootstrap.js::BootstrapWorker`. Its injected
`FrontendPluginResolver` reads the independently built plugin's `index.json`
and returns `{ path }`. This is a targeted extraction from
`sources/server-team/service/bootstrap.js::plugin`, retaining no Team endpoint
or application policy. Backend and frontend descriptors remain separate:
`acl/*.json` versus UI `index.json`.

`lib/http.js` now accepts bounded JSON POST bodies for the historical frontend
service pattern and retains its normal `{ status, data }` envelope. There is no
`if (module === "hello")` route or dispatcher branch.

## Frontend

The plugin bundle is `target/modules/hello/ui/index.js`. It calls the existing
addon contract exactly once:

```js
Kind.registerAddons({ hello: HelloWidget });
```

`HelloWidget` is a CommonJS class extending the real globally published
`LetcBox`; it follows the pinned `ui-dev-tools/widget` pattern: load skin,
`super.initialize`, declare handlers, then `onDomRefresh → feed(skeleton)`.
Its skeleton composes two pre-registered `Skeletons.Note` descriptors. It
does not use `KIND`, DOM injection or an application renderer.

The small generic `ServiceClient` is a documented CJS extraction of
`sources/ui-essentials/socket/{service,utils}.js`. `LetcView` and `LetcBox`
now provide their normal `fetchService`/`postService` methods through the
runtime-owned client. Hello calls `this.postService("hello.ping", {})`; on a
successful response it updates its model and feeds its real LETC skeleton
again. Session/socket/Team-specific transport behavior remains deferred.

## Build and metadata

`scripts/test-env/kernel/container/build-hello.js` builds the plugin through
the shared CommonJS/Webpack `ui-build` configuration. The output is an
independent hashed `hello-*.js` plus `index.json` metadata (hash, entry,
version, revision and timestamp). Nginx exposes it under
`/-/plugins/hello/`; `bootstrap.plugin` reads exactly that metadata entry.

This preserves the existing artifact contract without adding a second hash or
RuntimeEnv implementation. The Phase 2 characterized chain remains:

```text
Webpack stats.hash → index.json build metadata → RuntimeEnv → app.hash → appHash
```

Hello is a plugin, so the live slice uses its metadata `entry` for dynamic
loading rather than introducing an application manifest or a parallel appHash
mechanism.

## Environment

The existing disposable clean-Debian environment remains the integration host:

```text
node:22-bookworm-slim + Nginx
  + generated pinned setup-infra route file
  + server-runtime and ui-runtime
  + Hello ACL/service and Webpack artifact
```

`scripts/test-env/kernel/container/service.js` registers the generic runtime
bootstrap descriptor and the Hello ACL directory. Nginx still includes only
the generated `setup-infra` `routes/app.conf`; no Team image or handwritten
proxy route is used. The test container logs generic dispatch observations,
which the browser E2E asserts for both `bootstrap.plugin` and `hello.ping`.

## Exclusions

The Hello image and source include none of:

- `server-team` or `ui-team` runtime code;
- MFS, DrumeeMFS, Finder, Desktop or Window Manager;
- schemas, `acl_check.sql`, `user_permission`, `user_expiry`, MariaDB or
  provisioning; or
- Marketing, a lifecycle manager, a universal descriptor or an ESM loader.

The generic `public-api` fast check is existing runtime behavior, not a new
Hello-specific authorization exception.

## Validation

| Command | Result | Evidence |
|---|---|---|
| `node --test target/foundation/server-runtime/test/server-runtime.test.js` | PASS | Existing registry, dispatcher, lazy worker, resolver and ACL checks remain green. |
| `npm test --prefix target/modules/hello` | PASS | Hello descriptor, DB-free ACL, Worker cache, HTTP envelope and addon registration. |
| `npm test --prefix target/foundation/ui-runtime` | PASS | READY, plugin behavior and the new generic service client. |
| `DRUMEE_UI_BUILD_NODE_MODULES=.tmp/test-env/build-src/ui-team/node_modules node --test target/tooling/ui-build/test/ui-build.test.js` | PASS | Existing build contract plus a distinct hashed Hello plugin bundle and skin. |
| `KERNEL_BUILD_QUIET=1 scripts/test-env/kernel/test.sh` | PASS | Pinned configuration, `nginx -t`, resolver, Hello service and artifact routes. |
| `node --test tests/integration/kernel/hello-browser-e2e.test.js` | PASS | Browser dynamic plugin load, real HTTP `hello.ping`, dispatcher logs, state update and DOM result. |

The known historical Team provisioning defect remains outside this no-Team
slice and was neither changed nor used.

## Phase 4 boundary

Phase 3 establishes a small, DB-free plugin/service host. It does **not**
authorize MFS, database-backed ACL, schemas, Marketing, Team migration or any
other Phase 4 work. The next capability must be selected deliberately from a
real application requirement.
