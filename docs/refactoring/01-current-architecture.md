# Current Architecture

## Baseline and topology

`SOURCE_MANIFEST.md` was checked on 2026-08-28. Its 21 repository names equal the 21 immediate directories under `sources/`; every recorded SHA is present as a Git commit and its tree exactly matches `HEAD:sources/<name>`. Remote branch-tip identity cannot be re-proved from a subtree snapshot, so the recorded `main` branch is accepted as import provenance rather than independently verified state.

Classification applies to responsibilities, not current files or repositories. A `KEEP_OS` label below means that the evidenced capability must exist in the future minimal OS. It does not mean the cited file should remain intact, move wholesale, or define the final repository boundary.

```text
browser (ui-team) -> server-team -> server-core -> server-essentials
                         |                              |
                         +--> schemas / entity DBs <---+
                                      |
                               physical MFS storage
```

`setup-schemas` provisions instances/entities, `debian` packages and deploys the system, and `cli` administers it directly through MariaDB today.

## Server runtime

`sources/server-team/service.js` starts REST, creates core `Input`, `Output`, and `Session`, loads essentials `Cache`, calls `Acl.loadModules(__dirname)` and `Acl.loadPlugins()`, then dispatches through `Acl.run(session)`. `sources/server-team/index.js` is the push/page server. `sources/server-team/package.json` confirms dependencies on server-core, server-essentials and schema utilities.

ACL JSON is catalog and dispatch metadata. `sources/server-team/router/rest/index.js` registers built-in `acl/`, then reads the endpoint plugin configuration under `sysEnv().plugins_dir` and registers each plugin `acl/`. A process lock prevents later registration unless forced; signal handling forces reload. Implementation paths come from `modules.private/public` (for example `sources/loby/acl/signup.json`). The generic REST dispatch, ACL evaluation and module-discovery responsibilities are `KEEP_OS`; the policy data evaluated by that machinery is not automatically OS-owned. Service-specific deny/allow lists belong with their services, billing/over-limit policy is `TEAM_MODULE` or a separately approved policy module, and secure-share policy remains `INVESTIGATE`. The cited Team files are current implementation evidence, not a proposed file boundary.

`sources/server-core/lib/index.js` exports request/session/ACL/entity/MFS primitives. `sources/server-essentials/lib/index.js` exports MariaDB, cache/Redis, environment, logging, messaging, network, mail/template and utilities. These are existing `SDK_OR_ESSENTIALS`; no replacement core is proposed.

## Browser runtime and Team UI

`sources/ui-team/src/drumee/api.js` establishes bootstrap, service and WebSocket paths. `sources/ui-core/letc/index.js` installs LETC/Backbone/Marionette and globals including `Kind`, `Skeletons`, `Visitor`, and `DrumeeMFS`. `sources/ui-team/src/drumee/index.web.js` registers the large dynamic seed map and starts the app.

This boot path is evidence that Drumee needs a browser host/shell responsibility, but `sources/ui-team` is not the minimal shell. It is the current integrated Team application and combines bootstrap/hosting with Team routes, application seeds, globals and workflows. The target browser shell responsibility is `KEEP_OS`; the exact symbols that can satisfy it, and the compatibility seam by which the rest of UI Team becomes modules/distribution content, remain `INVESTIGATE`.

The UI is integrated: `builtins/window/**` contains Window Manager-facing windows; `builtins/media/core.js` combines MFS presentation, upload and drag/drop; `src/drumee/seeds.js` imports Finder/folder, chat, meetings, tasks, editors and utilities. The responsibility to host LETC applications and manage windows is `KEEP_OS`; this does not classify every file under the current window directories as OS code. Finder/signin/previewers are candidate `SYSTEM_MODULE`s; chat/tasks/meetings are `TEAM_MODULE`s.

`ui-core` is the LETC/kind runtime (`sources/ui-core/letc/kind/index.js`), `ui-essentials` supplies transport (`sources/ui-essentials/socket/service.js`), `ui-toolkit` reusable widgets, and `ui-styles` Sass. They are `SDK_OR_ESSENTIALS`, with global-state migration risk.

## Data, provisioning and modules

`sources/schemas` has central `yellow_page`, per-hub `hub`, per-user `drumate`, and shared `common` classes (`sources/schemas/README.md`). Placement is not ownership proof: `common/tables/task*.sql` and `common/procedures/task_*.sql` are Team functionality mixed into common provisioning.

`sources/setup-schemas/lib/schema.js` calls `entity_create`, creates a typed database and `<home_dir>/__storage__`, creates the MFS root, records `home_id`, and marks the pool entity clean. `lib/drumate.js` consumes pooled entities via `drumate_create` and `<drumate-db>.desk_create_hub`, seeds folders and implements removal. `lib/organization.js` creates domains, system identities, hubs and admin/guest accounts. This combines `KEEP_OS` semantic contracts with `DEPLOYMENT` first-install orchestration.

The imported reference repositories demonstrate several different extension shapes, analyzed precisely in `05-module-contract.md`:

- `sandbox-server` is a server plugin whose public ACL exposes sandbox create/load/remove operations. Its services provision and purge whole domains, users, hubs and MFS content (`sources/sandbox-server/service/{index.js,lib/organization.js,lib/drumate.js,lib/mfs.js}`), so it is not a minimal CRUD plugin and must not be copied as a generic lifecycle design.
- `sandbox-ui` is a standalone Drumee-powered application. Its HTML loads the host bootstrap and its own hashed bundle; `app/bootstrap.js` waits for `drumee:router:ready`, registers kinds and feeds the router body. It demonstrates application hosting, not the deployed UI-plugin `index.json` path.
- `loby` co-locates seven ACL service families, service code, email templates and application schemas. Signup/OAuth/onboarding/plan behavior also reaches yp identity, sessions, rewards and organization provisioning, so the repository is a mixed module rather than one clean contract unit.
- `signin` is only the frontend half. It registers three kinds using dynamic imports and depends on host globals/readiness events; `package.json` declares toolkit/styles but not ui-core because the host supplies the runtime.
- `marketplace` exposes OnlyOffice/EurOffice MFS integration through ACL and services, but has no schema tree. It also contains `service/lib/payment.js`, which is not referenced by either ACL module and requires Stripe even though Stripe is absent from `package.json`; current reachability is `INVESTIGATE`.
- `onboarding-server` is `LEGACY`, superseded by loby. Two overlapping SQL files are identical, eight differ, and loby adds newer steps and removes a hard-coded shard name. The immutable source remains useful for migration/schema-lineage evidence but is excluded from the target architecture.
- `onboarding` is a static marketing/documentation/pricing site, not a Drumee runtime plugin. It uses HTML, Sass, browser modules and JSON content and links into Drumee signup. Its current package scripts compile only the older `home.scss`/`features.scss`, while the tree also contains newer page-specific sources. It is excluded from the future runtime, module set and distributions. Its imported copy remains only because `sources/**` is the immutable baseline.

Loby's package metadata points to `analytics-server`, and marketplace declares the package name `@drumee/loby` plus the same stale repository URL. These are contract-breaking identity inconsistencies, not reliable module identity evidence. `ui-core/letc/kind/index.js::loadPlugin` and `server-team/service/bootstrap.js::plugin` remain the actual deployed UI-plugin discovery evidence; backend and frontend discovery still use separate conventions.

## Build, control plane and coverage

`sources/cli` maps Commander commands to abstract user/hub/settings/MFS resources. DB mode works; `sources/cli/src/backend/api/index.js::connect` only throws. It is `CONTROL_PLANE`, not boot-critical.

`sources/debian` is `DEPLOYMENT`: it defines Docker and native channels, package builds and lifecycle operations. Compose orders MariaDB/Redis, schema init, UI build/population, server/factory and Caddy (`sources/debian/README.md`). It consumes repository-specific Team products today.

Coverage is incomplete: server-core has live smoke scripts; server-team, CLI and signin have no package test script; UI Team has tests but no test script; loby has Node tests; Debian has E2E/native suites (`sources/debian/tests/**`). No baseline-vs-target compatibility harness exists.
