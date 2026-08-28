# Current Architecture

## Baseline and topology

`SOURCE_MANIFEST.md` was checked on 2026-08-28. Its 21 repository names equal the 21 immediate directories under `sources/`; every recorded SHA is present as a Git commit and its tree exactly matches `HEAD:sources/<name>`. Remote branch-tip identity cannot be re-proved from a subtree snapshot, so the recorded `main` branch is accepted as import provenance rather than independently verified state.

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

ACL JSON is catalog and dispatch metadata. `sources/server-team/router/rest/index.js` registers built-in `acl/`, then reads the endpoint plugin configuration under `sysEnv().plugins_dir` and registers each plugin `acl/`. A process lock prevents later registration unless forced; signal handling forces reload. Implementation paths come from `modules.private/public` (for example `sources/loby/acl/signup.json`). Dispatch/discovery is `KEEP_OS`; Team service implementations are not.

`sources/server-core/lib/index.js` exports request/session/ACL/entity/MFS primitives. `sources/server-essentials/lib/index.js` exports MariaDB, cache/Redis, environment, logging, messaging, network, mail/template and utilities. These are existing `SDK_OR_ESSENTIALS`; no replacement core is proposed.

## Browser runtime and Team UI

`sources/ui-team/src/drumee/api.js` establishes bootstrap, service and WebSocket paths. `sources/ui-core/letc/index.js` installs LETC/Backbone/Marionette and globals including `Kind`, `Skeletons`, `Visitor`, and `DrumeeMFS`. `sources/ui-team/src/drumee/index.web.js` registers the large dynamic seed map and starts the app.

The UI is integrated: `builtins/window/**` contains Window Manager-facing windows; `builtins/media/core.js` combines MFS presentation, upload and drag/drop; `src/drumee/seeds.js` imports Finder/folder, chat, meetings, tasks, editors and utilities. LETC host/Window Manager primitives are `KEEP_OS`; Finder/signin/previewers are candidate `SYSTEM_MODULE`s; chat/tasks/meetings are `TEAM_MODULE`s.

`ui-core` is the LETC/kind runtime (`sources/ui-core/letc/kind/index.js`), `ui-essentials` supplies transport (`sources/ui-essentials/socket/service.js`), `ui-toolkit` reusable widgets, and `ui-styles` Sass. They are `SDK_OR_ESSENTIALS`, with global-state migration risk.

## Data, provisioning and modules

`sources/schemas` has central `yellow_page`, per-hub `hub`, per-user `drumate`, and shared `common` classes (`sources/schemas/README.md`). Placement is not ownership proof: `common/tables/task*.sql` and `common/procedures/task_*.sql` are Team functionality mixed into common provisioning.

`sources/setup-schemas/lib/schema.js` calls `entity_create`, creates a typed database and `<home_dir>/__storage__`, creates the MFS root, records `home_id`, and marks the pool entity clean. `lib/drumate.js` consumes pooled entities via `drumate_create` and `<drumate-db>.desk_create_hub`, seeds folders and implements removal. `lib/organization.js` creates domains, system identities, hubs and admin/guest accounts. This combines `KEEP_OS` semantic contracts with `DEPLOYMENT` first-install orchestration.

Loby demonstrates backend plugin co-location: package scripts, ACL, services and owned schemas (`sources/loby/**`), but no normalized compatibility/lifecycle manifest. Its package repository metadata points to `analytics-server`, an `INVESTIGATE` inconsistency. Signin maps kind names to dynamic imports and calls `Kind.registerAddons` (`sources/signin/src/{seeds,index}.js`). `ui-core/letc/kind/index.js::loadPlugin` asks `bootstrap.plugin` for a JS entry; `server-team/service/bootstrap.js::plugin` resolves UI `index.json`. Backend and frontend discovery thus use separate conventions.

## Build, control plane and coverage

`sources/cli` maps Commander commands to abstract user/hub/settings/MFS resources. DB mode works; `sources/cli/src/backend/api/index.js::connect` only throws. It is `CONTROL_PLANE`, not boot-critical.

`sources/debian` is `DEPLOYMENT`: it defines Docker and native channels, package builds and lifecycle operations. Compose orders MariaDB/Redis, schema init, UI build/population, server/factory and Caddy (`sources/debian/README.md`). It consumes repository-specific Team products today.

Coverage is incomplete: server-core has live smoke scripts; server-team, CLI and signin have no package test script; UI Team has tests but no test script; loby has Node tests; Debian has E2E/native suites (`sources/debian/tests/**`). No baseline-vs-target compatibility harness exists.
