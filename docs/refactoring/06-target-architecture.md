# Target Architecture

This proposal requires architectural approval and does not define final repository splits. `KEEP_OS` names an application-neutral responsibility, not a current file or package that must survive unchanged.

## First target: a minimal module host

The primary target is a minimal Drumee kernel able to host a new independent application. `sources/server-team` and `sources/ui-team` remain immutable migration sources and later compatibility references; they are not the first kernel's implementation template or acceptance target.

```text
backend                                      frontend

server-essentials                            ui-essentials
  generic reusable services                    generic reusable foundation
          ↑                                           ↑
          │                                           │
server-runtime                              ui-runtime
  Drumee backend runtime candidates            Drumee frontend runtime candidates
          │                                           │
          └──────────── minimal kernel ───────────────┘
                                │
                              hello
                                │
                            marketing
                                │
                     later system and Team modules
```

`server-runtime` and `ui-runtime` are transitional extraction workspaces, not approved final package names. They are populated symbol by symbol from `sources/server-core`, `sources/ui-core`, and generic seams currently mixed into Team. Neither is a wholesale copy of `server-core` or `ui-core`.

Their canonical integration host is also separate from the historical Team deployment:

```text
clean Debian runtime
  + Nginx/configuration generated from pinned sources/setup-infra
  + server-runtime
  + ui-runtime
```

`sources/setup-infra/templates/etc/drumee/infrastructure/routes/app.conf.tpl` supplies the current Nginx evidence for service proxying and UI plugin/static aliases. `sources/debian` remains the historical packaging/self-hosting baseline; its Team images must not host the new runtime. Configuration generation is disposable under `.tmp/test-env/kernel/`, never host `/etc` or `sources/**`.

`server-essentials` remains independently reusable outside Drumee. Its generic MariaDB, connection, transaction, pooling, result and generic-error APIs (`sources/server-essentials/lib/mariadb.js`) must not acquire Hub, Drumate, Drumee ACL, MFS, module dispatch, plugin discovery or Team dependencies. `ui-essentials` remains the generic frontend foundation on the same principle.

Phase 2 consumes the current imported `server-essentials` implementation beneath `server-runtime`. The `1.3.1` resolution in the historical Team/Core locks is baseline evidence, not a constraint on this new kernel. Any source assumption that differs from the current generic API is adapted and tested at a temporary `server-runtime` seam; generic database, cache and logging primitives are reused rather than copied.

## Kernel boundary and sequencing

The first backend runtime candidates are boot/configuration, request/session/context, generic ACL-engine integration, module descriptor registration and resolution, `module.method` dispatch, public/private worker selection, lazy worker loading/cache, and the generic frontend-plugin resolver. The current evidence is split between `sources/server-core/lib/{session,input,output,acl,exception}.js`, `sources/server-team/router/rest/index.js::{loadPlugins,getModule,run}`, and `sources/server-team/service/bootstrap.js::plugin`.

The first frontend runtime candidates are minimal LETC hosting, Kind and addon registries, `Kind.loadPlugin`, dynamic JS orchestration, service transport integration, and `Host`, `Visitor`, `Organization` context. The evidence is `sources/ui-core/letc/index.js`, `sources/ui-core/letc/kind/index.js::{loadPlugin,registerAddons}`, and the generic facilities imported from `@drumee/ui-essentials`.

The kernel supplies mechanisms, never a module's product policy. Team service allow/deny lists, secure-share behavior, billing/over-limit policy and other service-specific checks stay with their owning service or remain `INVESTIGATE`; they must not be carried across simply because they are currently mixed into `server-team/router/rest/index.js`.

The sequence is intentionally strict:

```text
minimal server-runtime + ui-runtime
  → hello proves the vertical slice
  → intentional MFS backend/frontend primitives
  → marketing, the first real application
  → kernel stabilization
  → Finder / Window Manager and Team migration, capability by capability
```

MFS remains a `KEEP_OS` capability when it is intentionally introduced, but it is excluded from `hello`. Finder, Desktop, media-specific kinds, drag/drop and Window Manager are not first-kernel prerequisites; their post-MFS ownership remains `INVESTIGATE` until resource/application contracts are proven.

## Existing plugin contracts retained initially

Backend and frontend discovery are separate current contracts, so the target initially retains both rather than inventing a universal module manifest:

```text
backend startup: endpoint plugin configuration → acl/*.json → module registry
backend request: module.method → descriptor → public/private worker → lazy require/cache
                 → ACL / GRANTED → worker method

frontend: Kind.loadPlugin → bootstrap.plugin → plugin index.json → { path }
          → loadJS → Kind.registerAddons → addons:registered → Kind.get
```

`sources/server-team/router/rest/index.js::loadPlugins` registers ACL descriptor directories. `Acl.getModule` and `Acl.run` implement the current resolution/authorization/lazy-worker path. `sources/server-team/service/bootstrap.js::plugin` resolves a logical frontend plugin to its `index.json` entry; `sources/ui-core/letc/kind/index.js` loads the path and resolves only after addon registration. The generic portions of that interaction are kernel candidates; Team policy is not.

`hello` is the only synthetic validation module. It must prove a backend `hello.ping` (optionally `hello.echo`) through the ACL-driven dispatcher and a minimal LETC widget through `Kind.loadPlugin`, `bootstrap.plugin`, bundle loading and `Kind.registerAddons`, without `server-team`, `ui-team`, MFS, Finder, Window Manager, Team schemas or Team policy. Its approved descriptor uses `permission: { src: anonymous, fast_check: public-api }`; the first path therefore does not require SQL ACL procedures, `user_permission`, `user_expiry`, MFS schemas or factory provisioning.

## Modules, distribution, control plane and deployment

After `hello`, `marketing` is the first real application. Each capability it needs—private hub, MFS, hub-local schema, ACL, dynamic services, LETC UI or AI integration—must be classified as Essentials, backend kernel, frontend kernel, system module or marketing module before it is added. Application workflows, campaign data, AI/provider integration, billing and marketing policy remain marketing-owned unless kernel necessity is proven.

Only after the kernel has been exercised by marketing may Team functionality migrate module by module. Candidate system modules remain Signin/Loby and generic preview/editor capabilities; candidate Team modules remain Finder, chat, tasks, meetings and collaboration workflows, subject to evidence. A later Team distribution composes the stable kernel and selected modules; it does not define the first extraction boundary.

The Control Plane remains independently above the runtime. The CLI may eventually administer stable module lifecycle contracts, but source does not prove that capability today and the question remains `INVESTIGATE`. Deployment remains responsible for Docker/native packages, configuration, artifact acquisition, installation and rollback; it must later consume runtime/module/distribution artifacts instead of accidental Team checkout layout.

## Compatibility policy

The Phase 1 harness remains baseline evidence, a regression reference and a source for intentionally selected kernel contracts. It does not require perpetual reproduction of every Team behavior. Deliberate incompatibilities must be recorded with rationale, affected baseline surface, migration/rollback effect and an explicit approval. Current Team/self-hosting, MFS, CLI and provisioning observations remain essential evidence for later migration and deployment work.
