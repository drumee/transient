# Minimal Kernel Plan

## 1. Objective

The primary target is an application-neutral Drumee kernel that can host a new independent module. The current Team repositories are immutable migration sources and later compatibility references; they are not the design template for the first kernel.

The first proof is exactly one synthetic module, `hello`. The first useful application is `marketing`. Team capabilities are considered only after that kernel has been exercised and stabilized.

This is an extraction plan, not an extraction. `server-runtime` and `ui-runtime` are transitional workspaces, not approved final package names or repository boundaries.

## 2. Layer model

```text
backend                                      frontend

server-essentials                            ui-essentials
  generic DB/config/logging/transport          generic frontend foundation
          ↑                                           ↑
          │                                           │
server-runtime                              ui-runtime
  Drumee backend kernel candidates             Drumee frontend kernel candidates
          │                                           │
          └──────────── minimal Drumee kernel ────────┘
                                │
                              hello
                                │
                            marketing
                                │
                     later system and Team modules
```

`server-essentials` must remain usable by a non-Drumee Node/MariaDB service. In particular, it must not acquire dependencies on Hub, Drumate, Drumee ACL, MFS semantics, `module.method`, plugin discovery, or Team behavior. The existing generic MariaDB API belongs at that independent boundary (`sources/server-essentials/lib/mariadb.js`). `ui-essentials` remains the generic frontend foundation for the same reason.

### Phase 2 Essentials version policy

The baseline and the new kernel have deliberately different dependency purposes. `sources/server-team/package.json` and `sources/server-core/package.json` declare `@drumee/server-essentials` `^1.3.1`, and their imported locks resolve `1.3.1`; the current imported Essentials source is `1.3.6` (`sources/server-essentials/package.json`). The historical lock is evidence for baseline reproduction only. It is not a version constraint on `server-runtime`.

Phase 2 must use the current imported `server-essentials` API. A candidate extracted from `server-core` or generic Team loader code that assumes older behavior must be adapted in a documented, transitional `server-runtime` seam and receive a focused test. Do not downgrade Essentials, duplicate its generic database/cache/logging functionality, or add a Team-only compatibility branch to Essentials.

The inspected `Mariadb` public surface is unchanged between the baseline staging copy at `1.3.1` and current `1.3.6`: both expose `await_proc`, `await_func`, `await_query`, `await_run`, `query` and transaction-backed execution (`sources/server-essentials/lib/mariadb.js`). The known active-transaction issue therefore remains a provisioning/MFS risk, not evidence that the new kernel must use `1.3.1`.

There is an observed ACL-semantic difference to characterize before reusing generic descriptor conversion: historical `1.3.1` maps `permissionValue('write')` to `0b0001000`, while current `1.3.6` maps it to `0b0000100`; the corresponding cumulative `privilegeValue('write')` is `0b0001111` versus `0b0000111`. Legacy aliases such as `get` are also absent from the current tables (`sources/server-essentials/lib/lex/{permission,privilege}.js`). `sources/server-team/router/rest/index.js::Acl.getModule` converts ACL strings through `permissionValue`, and `sources/server-core/lib/acl.js::{check_source,check_dest}` passes the numeric value into SQL ACL checks. Phase 2 must select and test the current semantics for the no-Team kernel; preserving legacy mappings, if ever required, belongs in an explicit temporary runtime adapter with an architectural rationale.

`sources/server-core` and `sources/ui-core` are evidence and extraction sources. Neither is presumed to survive wholesale or under its current package name.

## 3. Backend extraction boundary

The following are proposed ownership decisions for the *first iteration* of `server-runtime`; all extraction waits for explicit implementation approval.

| Status | Candidate responsibility | Current evidence | Rationale |
|---|---|---|---|
| Initial KEEP | request/session input-output context | `sources/server-core/lib/{session,input,output,exception}.js` | Required to receive a generic request and establish execution context. |
| Initial KEEP | generic ACL evaluation integration | `sources/server-core/lib/acl.js`; `sources/server-team/router/rest/index.js::Acl.run` | A module host must authorize calls, but the ACL rules and product policies do not thereby become kernel code. |
| Initial KEEP | descriptor registration and `module.method` parsing/resolution | `sources/server-team/router/rest/index.js::{loadModules,loadPlugins,getModule}` | Required to discover registered backend modules and select a declared service. |
| Initial KEEP | public/private implementation selection, lazy worker loading/cache, post-grant execution | `sources/server-team/router/rest/index.js::Acl.{getModule,run}` | This is the generic half of current dispatch. It must be separated from Team policy before reuse. |
| Initial KEEP | generic frontend-plugin bundle resolver | `sources/server-team/service/bootstrap.js::plugin` | New frontend applications must resolve a logical plugin name without depending on `server-team`. |
| Explicitly OUT | Team services, service allow/deny lists, secure-share policy, billing/over-limit policy | `sources/server-team/acl/**`; router checks around `Acl.run` | Those are policies of a service/distribution, not generic dispatch. Secure-share remains `INVESTIGATE`. |
| Explicitly OUT for `hello` | MFS engine, storage, shard templates, provisioning, Hub workflows | `sources/server-core/lib/{mfs,entity,file-io}.js`; `sources/schemas/**` | MFS is intentionally post-`hello`; account/hub provisioning is not needed to prove the first module host. |
| INVESTIGATE | minimum identity/entity context, event/WebSocket transport, endpoint configuration, lifecycle API | `sources/server-core/lib/{entity,hub,user,runtimeEnv}.js`; `sources/server-team/service.js` | These may be required for an independent module, but the smallest safe subset is not yet proven. |

The extraction rule is symbol-by-symbol: inspect `server-core` or generic portions of the Team router, extract one application-neutral primitive, test it independently, and retain provenance. `server-runtime` must not become a copy of either source repository.

## 4. Frontend extraction boundary

`ui-runtime` is the frontend counterpart of `server-runtime`, extracted from `sources/ui-core`, above `ui-essentials`.

| Status | Candidate responsibility | Current evidence | Rationale |
|---|---|---|---|
| Initial KEEP | LETC initialization and minimal render host | `sources/ui-core/letc/index.js`; `letc/widgets/**` | Needed to render a `hello` widget in a simple host. The minimal widget set must be proven, not copied wholesale. |
| Initial KEEP | Kind registry: `exists`, `get`, `register`, `loadPlugin` | `sources/ui-core/letc/kind/index.js` | Required to find a local kind or obtain a frontend plugin dynamically. |
| Initial KEEP | addon registry and `Kind.registerAddons` handshake | `sources/ui-core/letc/kind/{index,seeds/addons}.js` | Required because bundle load completes only after addon registration. |
| Initial KEEP | logical-plugin service transport and dynamic JS loading orchestration | `sources/ui-core/letc/kind/index.js`; `@drumee/ui-essentials` `fetchService`/`loadJS` imports | Drumee-specific orchestration belongs in `ui-runtime`; generic transport/loading remains in Essentials. |
| Initial KEEP | `Host`, `Visitor`, `Organization` client context | `sources/ui-core/letc/{host,user,organization}.js`; `letc/index.js` | These are kernel-level context candidates because client identity/context participates in the client/server ACL model. The backend remains authoritative. |
| Candidate, minimize | truly generic static LETC kinds such as box/text/wrapper/spinner/list/image primitives | `sources/ui-core/letc/kind/seeds/static.js` | Retain only those needed for generic LETC rendering; prove the minimum through `hello`. |
| Explicitly OUT for `hello` | `DrumeeMFS`, MFS presentation, `media_*` kinds, Finder, Desktop, Window Manager, associations, Team seeds/routes | `sources/ui-core/letc/index.js`; `sources/ui-core/letc/kind/seeds/static.js`; `sources/ui-team/src/drumee/**` | These are resource/application experience capabilities and are not needed for a module-host proof. |
| INVESTIGATE | exact Host/Visitor/Organization state, router/readiness events, generic builtin-kind set, browser shell boundary | `sources/ui-core/letc/**`; `sources/ui-team/src/drumee/{index.web.js,router/**}` | Source proves their current use but not the smallest independent contract. |

`DrumeeMFS` is currently initialized alongside the core globals (`sources/ui-core/letc/index.js`), but that co-location is not evidence that it belongs in the first runtime. Likewise, `builtin_kinds.media.*` identifies a later MFS/application surface, not an automatic builtin commitment.

## 5. Backend plugin flow to preserve initially

The initial backend compatibility contract is the current two-phase mechanism, without Team policy:

```text
startup
  → endpoint plugin configuration
  → plugin ACL directories
  → acl/*.json
  → module/service descriptor registry

request: module.method
  → parse module and method
  → resolve descriptor and public/private implementation
  → resolve permission descriptor
  → lazy require WorkerClass
  → cache WorkerClass by path
  → instantiate with session + permission
  → generic authorization / GRANTED
  → worker method
```

`sources/server-team/router/rest/index.js::loadPlugins` reads endpoint-configured ACL roots and registers their `acl` directories. `Acl.getModule` validates `module.method`, selects `modules.public` or `modules.private`, and resolves the service/permission. `Acl.run` loads and caches the worker before executing after `GRANTED`.

The current router also contains secure-share ceilings, over-limit clamps and service lists. Those branches are *not* part of the initial `server-runtime` compatibility contract. The extraction must demonstrate that generic dispatch works when such policy is supplied by the owning module/service instead.

## 6. Frontend plugin flow to preserve initially

The frontend/backend handshake is a separate existing contract. It must not be merged with backend ACL descriptors during the first kernel iteration.

```text
Kind.loadPlugin({ name, kind })
  → Kind.exists(kind)
  → bootstrap.plugin(name)
  → frontend plugin index.json
  → { path }
  → loadJS(path)
  → bundle executes
  → Kind.registerAddons(...)
  → addons:registered
  → Kind.get(kind)
```

`sources/ui-core/letc/kind/index.js::loadPlugin` first checks `Kind.exists`, calls the configured bootstrap service, waits for `addons:registered`, loads the returned path, then resolves the requested kind. `Kind.registerAddons` emits that event. `sources/server-team/service/bootstrap.js::plugin` strips the logical name extension, searches the installed UI plugin's `index.json`, reads `entry`, and returns a public path.

Current descriptors remain deliberately distinct:

```text
backend:  acl/*.json
frontend: index.json + bundle entry
```

A universal manifest is explicitly deferred until after `hello` proves the vertical slice. The future need for common metadata is `INVESTIGATE`; it is not a reason to replace either current mechanism now.

## 7. `hello` vertical slice

`hello` is the sole synthetic module. Its acceptance contract is:

```text
backend
  hello ACL/service descriptor registers
  → hello.ping and optional hello.echo dispatch through the extracted loader
  → public/private selection and generic authorization work

frontend
  Kind.loadPlugin({ name: "hello", kind: "hello" })
  → extracted bootstrap.plugin resolves hello/index.json
  → returned path loads a bundle
  → bundle calls Kind.registerAddons
  → a minimal LETC hello widget renders in a simple host
  → widget calls hello.ping
```

It must run without `server-team`, `ui-team`, MFS, Finder, Window Manager, Desktop, complex schemas, AI, campaigns, chat, tasks, meetings, or Team policy. `Host`, `Visitor`, and `Organization` must be available only to the extent the extracted ACL/runtime context requires them.

## 8. MFS sequencing

MFS is a later kernel capability, not an omission from the architecture:

```text
minimal backend runtime + minimal frontend runtime
  → hello validates plugin and service hosting
  → intentional MFS backend primitives
  → intentional MFS frontend primitives
  → marketing
  → Finder / Window Manager when resource/application semantics require them
```

This order prevents the current `server-core` MFS, UI media kinds, Finder and window model from being pulled into the first kernel merely because they are co-located today. It also makes MFS ownership, storage failure handling, identity/ACL, and shard/provisioning contracts explicit before user-facing file workflows are extracted.

## 9. Marketing role

After `hello`, `marketing` is the first real application and the only source of new capability pressure before Team migration. Possible needs—private hub, MFS, hub-local schemas, ACL, dynamic services, LETC UI and AI integration—must be classified individually as:

```text
server-essentials | ui-essentials | backend kernel | frontend kernel |
system module | marketing module
```

Application-specific workflows, campaign data, AI prompts/providers, billing behavior, and marketing policy remain module-owned unless their application-neutral kernel necessity is proven.

## 10. Team migration policy

Team remains available as immutable source evidence and a later compatibility target. It does not determine the first kernel's scope.

Only after the kernel has passed `hello` and been exercised by `marketing` may Team capabilities be classified and migrated one by one—for example Finder, chat, tasks, meetings, and other collaboration modules. No Team reconstruction, Finder extraction, or Window Manager extraction begins in this plan.

## 11. Compatibility policy

The Phase 1 harness remains:

```text
baseline evidence
→ regression reference
→ source of intentionally selected kernel contracts
```

It is not a perpetual requirement to reproduce every Team-era behavior. Baseline facts and safety guards remain intact. Each selected kernel contract must gain target-side tests; deliberate incompatibilities require an explicit decision, rationale, affected baseline surface, and rollback/migration consequence.

The current Debian E2E/provisioning result remains important evidence about current Team deployment, but it is not a prerequisite for defining the first no-Team `hello` kernel slice. It remains a blocking risk for later Team/self-hosting compatibility work.

## 12. Open architectural questions

All items remain `INVESTIGATE` until code or runtime evidence resolves them.

1. What minimum `server-core` session/context/ACL symbols can host `hello` without Hub, Drumate, MFS or Team services?
2. What minimal Host/Visitor/Organization state and bootstrap inputs preserve client/server ACL semantics for an independent application?
3. Which static LETC kinds are indispensable for generic rendering, and which current `builtin_kinds` are MFS/application additions?
4. Can the existing `bootstrap.plugin` resolver operate from a runtime-owned installed-plugin root without any Team endpoint/layout assumption?
5. Which parts of `Acl.run` are generic dispatch, and which are hidden Team-specific policy beyond the already identified secure-share/over-limit branches?
6. What compatibility/version relationship is required between the frontend `index.json` entry, backend ACL descriptor and their independently built artifacts?
7. What is the minimal MFS semantic/storage/ACL surface marketing actually requires after `hello`?
8. When MFS is introduced, do Finder and Window Manager remain modules or does a proven resource-host primitive belong in the frontend kernel?
9. Which selected Team contracts deserve later compatibility tests, and which Team behaviors are deliberately outside the new kernel?
