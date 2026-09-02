# Phase 2 Runtime Extraction

## Scope and result

Phase 2 creates a deliberately small, executable no-Team foundation under
`target/`. It does not reconstruct Team and does not implement the Phase 3
`hello` module. The verified boundary is:

```text
current @drumee/server-essentials        current @drumee/ui-essentials
                 ↑                                   ↑
                 │                                   │
          server-runtime                        ui-runtime
                 │                                   │
                 └──── clean Debian/Nginx host ──────┘
                                      ↑
                         pinned setup-infra route contract
```

The disposable integration image contains neither `server-team`, `ui-team`,
schemas, MFS, MariaDB nor Redis. It contains only the source needed for the
selected Nginx generator, the Phase 2 target runtimes, Webpack tooling and one
test-only `kernel.status` worker. That worker is an integration fixture, not a
module or a replacement for `hello`.

## Backend extraction

### Extracted responsibilities

`target/foundation/server-runtime/` is CommonJS and private. Its provenance is
recorded in its `PROVENANCE.md`.

| Responsibility | Target code | Source evidence | Result |
|---|---|---|---|
| ACL descriptor registry | `lib/descriptor-registry.js::DescriptorRegistry` | `sources/server-team/router/rest/index.js::{registerModules,Acl.getModule}` | Reads `acl/*.json`, validates descriptors, resolves `module.method` and chooses public/private implementation. |
| Worker lifecycle | `lib/dispatcher.js::ServiceDispatcher` | `sources/server-team/router/rest/index.js::{Acl.run,exec}` | Defers `require()` until first dispatch, caches the class by resolved path, instantiates `new WorkerClass({ session, permission })`, authorizes, then calls the declared method. |
| Fast authorization seam | `lib/permission.js::{fastCheckName,authorizeFastPath}` | `sources/server-core/lib/acl.js::{check_preprocess,fast_check,check_env}` | Handles the only approved database-free fast path, `public-api`; no Mariadb, yp, MFS or ACL SQL is loaded. |
| HTTP boundary fixture | `lib/http.js::createServiceServer` | Service path forms in `sources/setup-infra/templates/etc/drumee/infrastructure/routes/app.conf.tpl` | Test-only HTTP adapter accepts the existing `/svc/`, `/vdo/` and `/service/` path families and dispatches to the new runtime. |
| Frontend resolver | `lib/plugin-resolver.js::FrontendPluginResolver` | `sources/server-team/service/bootstrap.js::plugin` | Logical plugin name → plugin `index.json` → `entry` → public `{ path }`, with invalid/missing metadata errors. |

The generic boundary deliberately excludes the secure-share session ceiling,
over-limit clamp, billing/payment/promo exceptions, Team allow/deny lists and
all Team endpoint policy co-located in
`sources/server-team/router/rest/index.js::Acl.run`. The target dispatcher has
no dependency on those names or on Team source paths; the target test asserts
that fact.

### Current Essentials API and compatibility adaptation

The target accepts the current imported `permissionValue` converter from
`sources/server-essentials/lib/lex/permission.js`, whose package version is
`1.3.6` (`sources/server-essentials/package.json`). It does not import or copy
generic MariaDB, transaction, cache, logging, configuration, result or error
utilities. Those remain the independently reusable Essentials layer.

The focused test records the current numeric semantics:

```text
permissionValue("write") = 0b0000100
privilegeValue("write")  = 0b0000111
```

The historical Team/Core lock resolution was `1.3.1`; its corresponding values
were `0b0001000` and `0b0001111`. This is a deliberate no-Team Phase 2
difference, not a compatibility shim. Also, `get` is absent from the current
permission/privilege tables. The generic Essentials helper returns its current
zero sentinel for that unknown key; the runtime records rather than hides that
semantics. A later Team adapter, if one is justified, belongs above
Essentials—not in it.

The source core fast-path code checks `permission.preproc.fast_check`, while
the approved Phase 3 descriptor has a direct `permission.fast_check` value.
`server-runtime` supports both spellings only at its temporary authorization
seam and gives `public-api` the same database-free grant. This isolates the
future `hello` contract without adding schemas or changing baseline source.

### Backend tests

`target/foundation/server-runtime/test/server-runtime.test.js` passes and
proves valid/malformed descriptor handling, unknown module/method handling,
public/private selection, lazy class loading, cache reuse, current Essentials
permission semantics, Team-policy absence and all required plugin-resolver
failure modes.

## Frontend extraction

`target/foundation/ui-runtime/` is CommonJS and private. It is a compact
runtime host, not a copy of `ui-core`.

| Responsibility | Target code | Source evidence | Result |
|---|---|---|---|
| Kind/addon registry | `src/kind.js::KindRegistry` | `sources/ui-core/letc/kind/index.js::{exists,get,register,registerAddons}` and `kind/seeds/addons.js` | `register`, `exists`, `get`, addon coalescing and `addons:registered`. |
| Dynamic plugin handshake | `KindRegistry.loadPlugin` | `sources/ui-core/letc/kind/index.js::loadPlugin` | Existing-kind short circuit; logical transport; `{ path }`; injected `loadJS`; bundle registration; requested-kind resolution; clean transport/bundle rejection. |
| Browser script seam | `src/loader.js::loadBrowserScript` | `sources/ui-essentials/utils/index.js::loadJS` | Traditional XHR/script injection; no native browser ESM import. The generic loader/transport is injected by the host rather than turned into a Team global. |
| Identity context | `src/context.js::{Host,Visitor,Organization}` | `sources/ui-core/letc/{host,user,organization}.js` | Data attributes plus minimal host URL/name, visitor signed-in/online, organization metadata/name/host behavior. Backend authorization remains authoritative. |
| Minimal LETC host | `src/runtime.js::createRuntime` | `sources/ui-core/letc/index.js::export_globals` | A callable render boundary for a future widget, without Backbone/Marionette globals. |

No static kind was carried automatically. In particular, the runtime retains no
`DrumeeMFS`, `media_*`, Finder, Desktop, Window Manager, association, Team
seed, Team route, chat or application widget. The static kinds in
`sources/ui-core/letc/kind/seeds/static.js` require historical widget/global
dependencies; their actual minimal subset remains a Phase 3 proof question.

`target/foundation/ui-runtime/test/ui-runtime.test.js` passes for the Kind
registry, addon event, existing-kind shortcut, full plugin handshake, duplicate
load behavior, failure paths, context reduction and forbidden imports.

## Shared frontend build contract

`target/tooling/ui-build/` is private CommonJS tooling. It keeps Webpack as
the authoritative build mechanism and is separate from browser runtime code.

### Inspected boilerplate and extracted pieces

The main source evidence is:

- `sources/signin/webpack.js::{makeOptions,normalize}` for web target,
  `[name]-[fullhash].js`, context and explicit build/output paths;
- `sources/signin/webpack/module.js` for SCSS/CSS/PostCSS/Sass and asset rules;
- `sources/signin/webpack/sync.js::DrumeeSyncer.{apply,get_hash}` for hash and
  `index.json` fields;
- `sources/signin/webpack/shortcut.js` for the excluded legacy/app aliases.

`lib/config.js::createConfig` retains CommonJS/Webpack resolution, web target,
SCSS/CSS/PostCSS/Sass, image/font asset modules and async WebAssembly. It has
no aliases by default. The large historical shortcut map is explicitly not a
kernel build requirement; it can only be considered later as an opt-in legacy
preset after a consumer proves the need.

`lib/manifest.js::DrumeeBuildManifestPlugin` writes build metadata as the
first-class successor to the required portion of `sync.js`:

```json
{
  "hash": "<webpack stats.hash>",
  "timestamp": 0,
  "head": "<revision>",
  "rev": "<revision>",
  "entry": "<emitted bundle>",
  "version": "<package version>",
  "no_hash": 0
}
```

The optional `UI_RUNTIME_HOST` / `rsync` branch from historical `sync.js` is
not present in `ui-build`; it remains a development/deployment workflow, not
a build or browser-runtime prerequisite.

The tests compile a SCSS and SVG fixture twice, prove a generated metadata file
and a content-sensitive changed hash, then compile the real `ui-runtime` source
through the same config. No historical frontend application was migrated.

### appHash chain and manifest distinction

The source-proven chain is:

```text
Webpack compilation
  → stats.hash
  → ui-build index.json build metadata
  → server-essentials/sysEnv.js::loadUiinfo('app') / getUiInfo()
  → server-core/runtimeEnv.js::RuntimeEnv.getAppInfo()
  → app.hash and derived main/vendor/sprite/locale/core bundle names
  → server-team client template scripts.tpl
  → bootstrap().appHash
  → frontend consumer
```

`sources/server-core/lib/runtimeEnv.js::loadManifest` separately reads
`<ui_home>/app/manifest.json`, mtime-caches it and places it in `app.manifest`.
It is an application manifest used to select named bundles in
`sources/server-team/client/page.js::start` and
`sources/server-team/service/bootstrap.js::js`. It is **not** the Webpack
`index.json` build metadata produced by `sync.js` or Phase 2 `ui-build`.
`ui-build` preserves that separation. Its source-faithful contract helper and
test prove both paths and the template's `appHash: "<%= app.hash %>"` consumer.

## Kernel integration environment

The executable environment lives under `scripts/test-env/kernel/`:

```text
check → build → configure → up → status/test → logs → down/reset
```

`build.sh` creates a guarded temporary Docker context under
`.tmp/test-env/kernel/image-context/`; it copies only:

```text
sources/setup-infra
sources/server-essentials/lib/lex
target/foundation/server-runtime
target/foundation/ui-runtime
target/tooling/ui-build
scripts/test-env/kernel/container
```

It does not copy Team source, Debian source, schemas, MFS or a historical Team
image. The clean Debian `node:22-bookworm-slim` image installs Nginx and builds
the private `ui-build` dependencies inside the image. Its `ui-runtime` artifact
is built to `index.json` plus hashed bundle before startup.

The pinned generator source is `setup-infra` main
`643d74fa8bc89d418ff1169daa09554ae84e48ef` (from `SOURCE_MANIFEST.md`).
`configure.sh` runs `sources/setup-infra/infra.js` **inside the disposable
image** with `--outdir /out/generated`; the host-visible output is only under:

```text
.tmp/test-env/kernel/generated/
```

The upstream generator renders broader historical configuration trees. This
environment starts none of their DNS, BIND, mail, Postfix, DKIM, MariaDB, PM2,
Jitsi, Prosody or Coturn services and does not load their files into Nginx. It
uses precisely the generated
`etc/drumee/infrastructure/routes/app.conf` in a disposable Nginx server block.
That is the selected source contract:

```text
/-/svc/kernel.status  → generated /(svc|vdo|service)/ proxy → 127.0.0.1:24000 → server-runtime
/-/plugins/ui-runtime/index.json → generated plugins alias → ui-runtime build artifact
```

The environment is loopback-only on `127.0.0.1:28642` by default and has no
database service. It runs generator and Nginx as the invoking UID so runtime
state stays removable by that user. `reset.sh` verifies the exact
`.tmp/test-env/kernel` path before removal; it never accepts an arbitrary host
path. It never writes `/etc` on the host.

## Tests and result

| Test / command | Purpose | Result |
|---|---|---|
| `node --test target/foundation/server-runtime/test/server-runtime.test.js` | backend descriptor/ACL/dispatcher/plugin resolver | PASS |
| `node --test target/foundation/ui-runtime/test/ui-runtime.test.js` | Kind/addon/plugin/context boundary | PASS |
| `DRUMEE_UI_BUILD_NODE_MODULES=.tmp/test-env/build-src/ui-team/node_modules node --test target/tooling/ui-build/test/ui-build.test.js` | real Webpack, SCSS/assets, hash, metadata and appHash characterization | PASS |
| `node --test tests/integration/kernel/kernel-environment-contract.test.js` | no-Team Docker context, generated route and cleanup guards | PASS |
| `scripts/test-env/kernel/check.sh` | Linux/Docker/Compose/buildx/Node/source prerequisites | PASS |
| `KERNEL_BUILD_QUIET=1 scripts/test-env/kernel/test.sh` | clean Debian build, pinned config generation, `nginx -t`, service/static routes and Team/MFS/schema absence | PASS |

The generated configuration is intentionally inspected, and `nginx -t` passes
inside the running integration container. No Docker Compose project, Team image
or production host configuration is used.

## Deferred

Phase 2 does **not** implement or migrate:

- `hello`, including `hello.ping`, its ACL descriptor, widget or plugin bundle;
- database-backed ACL, `acl_check.sql`, `user_permission` or `user_expiry`;
- schemas, provisioning, factory, Hub/Drumate lifecycle or MFS;
- Finder, Desktop, Window Manager, drag/drop, media kinds or associations;
- Team modules, Team distribution or historical frontend-app migration;
- new Debian packages, final package identities or a public API;
- ESM migration, Webpack removal, style-loader replacement or a universal
  backend/frontend module descriptor.

## Phase 3 readiness

Phase 3 can consume a CommonJS descriptor registry/dispatcher with the approved
database-free `public-api` path, a logical `bootstrap.plugin` resolver, the
CommonJS Kind/addon/loadJS handshake, a reproducible Webpack artifact/metadata
builder, and the verified source-faithful Nginx service/plugin routes. It must
add exactly one independent `hello` module; it must not use the `kernel.status`
integration fixture as product code.
