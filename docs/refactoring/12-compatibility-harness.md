# Phase 1 Compatibility Harness

## Outcome

Phase 1 adds a package-free, read-only characterization layer plus explicitly guarded live tests. The default command is `scripts/test-baseline-all.sh`. It reads the immutable baseline and uses temporary directories only; it does not start Drumee, connect to MariaDB, or mutate tenant data unless the live integration variables below are deliberately supplied.

The harness is baseline evidence, a regression reference and a source of intentionally selected kernel contracts. It freezes current behavior at architectural boundaries without making every Team-era behavior the definition of the new minimal kernel. Source-contract tests are used where the imported snapshot cannot run without a complete Drumee installation. They are not substitutes for the listed live scenarios when later Team/self-hosting compatibility claims are made.

## Commands

| Command | Scope | Default safety |
|---|---|---|
| `scripts/test-baseline-unit.sh` | CLI API state, storage guards, deterministic CLI MFS round-trip | Temporary files only |
| `scripts/test-baseline-server.sh` | boot, dispatcher, ACL catalog, provisioning contracts; optional live REST | Read-only unless live URL supplied |
| `scripts/test-baseline-cli.sh` | CLI backends/MFS and optional live lifecycle | Destructive lifecycle refuses to run without the exact guard |
| `scripts/test-baseline-ui.sh` | Team boot, Window Manager/module contracts; optional live HTTP smoke | Read-only |
| `scripts/test-baseline-deployment.sh` | Debian renderer and native package dependency checks | Read-only; temporary renderer files |
| `scripts/test-baseline-integration.sh` | all live probes | Skips unconfigured scenarios |
| `scripts/test-baseline-all.sh` | every safe and configured live test | Destructive tests remain guarded |

All scripts use `set -euo pipefail`, are non-interactive, and propagate failures.

The reproducible container environment is wrapped by `scripts/test-env/{check,stage-build-src,build,up,status,e2e,capture-rest-golden,browser-baseline,gate,logs,down,reset}.sh` and documented in `13-test-environment.md`. `e2e.sh` delegates to `sources/debian/tests/e2e-local.sh` and is the authoritative automated baseline path; `up.sh` is optional persistent loopback-only support for browser/manual behavior. `build.sh` prepares node dependencies only in `.tmp/test-env/build-src/**`, then passes those contexts to the immutable Debian builder. After a healthy `up.sh`, source `.tmp/test-env/baseline/runtime.env` to provide the live server/UI URLs to this harness.

Current environment status is `NOT READY`: images build and the Debian E2E has run, but `schemas-populate` exits 1. The retained persistent-stack log traces the failure through `sources/server-team/offline/factory/schema.js::publish_search_projection()` to the imported `mfs_search_projection_rebuild` procedure's `SEARCH_PROJECTION_REBUILD_ACTIVE_TRANSACTION` signal (`sources/schemas/common/procedures/mfs/mfs_search_projection_rebuild.sql`). Fixed account creation then receives `EMPTY_FACTORY`. The wrapper records rather than repairs this immutable baseline behavior.

## Test matrix

| Surface | Test | Level | Automated | Destructive | Status |
|---|---|---|---|---|---|
| Server boot | initialization order, session failures, panic codes (`sources/server-team/service.js`) | Compatibility | Yes | No | Pass |
| Server boot | live `yp.get_env` smoke | Integration | Yes with `DRUMEE_TEST_BASE_URL` | No | Blocked by baseline populate failure |
| Dispatch | valid, malformed, unknown module/method; loby/sandbox discovery (`router/rest/index.js::getModule/loadModules`) | Compatibility | Yes | No | Pass |
| Dispatch/session | sanitized REST golden: public/error/denied/authenticated contracts | Integration | Yes with URL/test auth | No | Blocked; capture only after live pass |
| ACL | entire Team/loby/sandbox ACL catalog; representative anyone/anonymous/read/write/admin/owner | Compatibility | Yes | No | Pass with frozen defects |
| ACL | observable denied access | Integration | Yes with live server | No | Environment required |
| Drumate provisioning | `drumate_create`, `EMPTY_FACTORY`, folder initialization | Compatibility | Yes | No | Pass |
| Drumate provisioning | create/get/update/purge disposable drumate | Integration | Yes, guarded | Yes | Environment required |
| Hub provisioning | `desk_create_hub`, owner/home identity, failed result | Compatibility | Yes | No | Pass |
| Hub provisioning | create/members/purge disposable hub | Integration | Yes, guarded | Yes | Environment required |
| Factory pool | Debian empty-pool install guard and CLI error mapping | Compatibility | Yes | No | Pass |
| Factory pool | actual empty-pool create failure | Integration | Yes, separately guarded | Yes | Environment required |
| MFS engine | SQL create/list/read/mkdir/rename/move/copy/delete and identity/parent/storage/permission contracts | Compatibility | Yes | No | Pass |
| MFS cross-hub | destination ACL registration | Compatibility | Yes | No | Pass |
| CLI MFS | list projection, errors, file/directory import/export hierarchy and blob layout | Unit | Yes | Temporary only | Pass |
| CLI MFS | live DB import/export against disposable hub | Integration | Yes, guarded | Yes | Environment required |
| CLI DB | command families and user/hub/settings/MFS verbs | Compatibility | Yes | No | Pass |
| CLI DB | live reads, invalid entity, create/update/delete | Integration | Yes, guarded by operation | Potentially | Environment required |
| CLI API | `ApiBackend.connect()` explicit non-operational error | Unit | Yes | No | Pass |
| Team frontend | entry/bootstrap/seeds/Drumee start contract | Compatibility | Yes | No | Pass |
| Team frontend | HTML and bootstrap endpoint smoke | Integration | Yes with UI URL | No | Environment required |
| Window Manager | active window/open/raise/layers/workspace path contract | Compatibility | Yes | No | Pass |
| Window Manager | open/close/focus/multiple-window browser behavior | Browser integration | Deterministic manual checklist + explicit approval | No | Blocked; `browser-baseline.sh` records result |
| Finder/MFS | open workspace/file code paths and MFS live lifecycle | Compatibility/integration | Partial | Guarded for mutation | Gap: DnD/preview |
| Backend modules | Team, loby and sandbox ACL discovery/resolution | Compatibility | Yes | No | Pass |
| Frontend modules | signin plugin/router readiness and sandbox standalone readiness/kind loading | Compatibility | Yes | No | Pass |
| Docker self-host | config validation/rendering baseline (`sources/debian/tests/smoke-config.sh`) | Compatibility | Yes | No | Pass |
| Native Debian | dependency order, meta package, debconf bridge, pool guard (`sources/debian/tests/native/control-deps.sh`) | Compatibility | Yes | No | Pass |
| Full self-host | container bring-up and disposable native install | Integration/manual | Existing Debian commands | Yes/system-changing | Environment required |

## Environment requirements

### Strict gate

`scripts/test-baseline-all.sh` remains the broad safe characterization command, but it may validly skip live tests. It is therefore not a Phase 2 readiness decision. Use `scripts/test-env/gate.sh`; it reports `PASS`, `FAIL`, or `SKIP / NOT CONFIGURED` separately for safe tests, Debian E2E, provisioning, MFS, CLI DB, REST golden, empty-factory, and browser evidence. It exits nonzero for any mandatory `SKIP`.

### Safe/default suite

- Bash with standard POSIX utilities.
- Node.js 18 or newer; verified here with Node.js 22.22.0.
- No npm install is required by the added tests.
- The imported source trees must be present at their recorded paths.

The Debian smoke checks additionally consume `sources/debian/config/render.mjs` and its vendored/imported runtime assumptions. Docker is not used by the default checks.

### Disposable live server and frontend

Provide:

```text
DRUMEE_TEST_BASE_URL=https://phase1.example.test
DRUMEE_TEST_UI_URL=https://phase1.example.test
DRUMEE_TEST_AUTH_TOKEN=<disposable-user-token>       # authenticated probe only
DRUMEE_TEST_AUTH_READ_SERVICE=desk.get_env           # optional
```

The instance must match the imported baseline and provide MariaDB, Redis, `/etc/drumee` configuration, service and UI endpoints, schema initialization, a test DNS name, and a browser-compatible TLS setup. The precise supported Debian, Node.js and MariaDB production versions are not declared consistently by the imported repositories and remain `INVESTIGATE`; use the versions built by `sources/debian` for the authoritative baseline run.

### Disposable CLI/provisioning environment

The CLI DB backend requires local access to MariaDB and physical MFS storage, the current system database user, `/etc/drumee`, and `@drumee/server-essentials` resolution (`sources/cli/src/backend/db/index.js::connect`). Set `DRUMEE_TEST_DB_INTEGRATION=1` for read-only CLI probes.

Destructive lifecycle tests additionally require all of:

```text
DRUMEE_TEST_ALLOW_DESTRUCTIVE=YES_I_ACCEPT_DISPOSABLE_DATA_LOSS
DRUMEE_TEST_USER_EMAIL=phase1-<unique>@example.test
DRUMEE_TEST_HUB_NAME=phase1-<unique>
DRUMEE_TEST_STORAGE_ROOT=/.../phase1-...          # marker guard; actual root remains /etc/drumee-driven
```

The email must start `phase1-` or `phase1+` and end in `.test`; the hub must start `phase1-` or `phase1_`; the marker storage root must contain `phase1`. Run only in a disposable instance whose configured MFS root and databases can be discarded. To characterize exhaustion, use a separate deliberately empty pool and set `DRUMEE_TEST_FACTORY_EMPTY=YES`; never combine that scenario with a shared development instance.

Provisioning needs a stocked factory pool for the success scenario. It exercises yp registration, factory consumption, shard assignment and initialized MFS indirectly through the public CLI outcome. Database/schema allocation and physical root invariants must also be inspected after the run because the CLI result does not expose every intermediate transition.

### Self-hosting integration

Use the imported commands rather than copying their behavior:

- Docker/config baseline: `bash sources/debian/tests/run-all.sh` or the narrower scripts under `sources/debian/tests/`; requires Docker/Compose and disposable ports, volumes and DNS configuration.
- Native Debian: follow `sources/debian/docs/native-channel.md` and run `sources/debian/tests/native/install-verify.sh` in a disposable Debian VM as root.

Those operations alter containers, packages, services, databases and storage and are intentionally not invoked by `test-baseline-all.sh`.

## Fixtures and safety

`tests/fixtures/mfs/input/**` is the deterministic two-level MFS fixture. Unit round-trips allocate a unique directory under the operating system temp directory and verify the current `<home_dir>/__storage__/<nid>/orig.<ext>` convention from `sources/cli/src/backend/db/mfs.js::_importFile/_exportTree`.

The storage-guard test executes `DbBackend.assertExclusiveStorage/removeStorage` against a unique temporary root and freezes refusal of empty, root, outside-root and cross-tenant targets (`sources/cli/src/backend/db/index.js`). Live purge remains root-gated by the baseline CLI and adds the stronger harness guards above.

## Baseline defects discovered

1. `sources/server-team/acl/{block,menu,ops,wicket,ws}.json` contain service catalogs but no `modules` map. `router/rest/index.js::getModule` therefore returns `MODULE_NOT_FOUND` for them when no other registration supplies an implementation. The ACL catalog test freezes the exact five-file set; reachability through another runtime path remains to be established.
2. `sources/server-team/acl/desk.json::set_online_status` has a scope but no `permission.src`. `getModule` treats a missing permission object differently from an object without `src`; the effective authorization consequence requires a live denied/allowed probe.
3. `sources/server-team/acl/secure_share.json` declares an empty public implementation while retaining a private implementation. This is frozen separately from the still-unclassified secure-share policy and needs an anonymous live probe.
4. `sources/cli/src/backend/api/index.js::ApiBackend.connect` always throws. This is already mapped and now has an executable characterization test.

These are documented, not repaired.

## Coverage gaps

- The imported images were built and the authoritative disposable E2E ran, but schema population is blocked by `SEARCH_PROJECTION_REBUILD_ACTIVE_TRANSACTION`; consequently REST, session, ACL denial, live provisioning, shard/schema state and live MFS tests cannot currently execute in this baseline environment.
- No reusable browser automation dependency exists at the repository root. HTML/bootstrap availability and Window Manager source contracts are covered; actual open/close/focus/multiple-window behavior, Finder browsing, drag/drop and preview remain browser-integration gaps.
- No approved REST golden exists because the first authoritative Debian live run did not reach REST. `capture-rest-golden.sh` now records sanitized status/body envelopes once it does, and the live test becomes exact against that fixture.
- Provisioning cleanup is best-effort through current CLI commands. Because DB/disk operations are non-transactional, a failed scenario can require manual disposal of the entire instance.
- Cross-hub MFS copy/move is catalogued but not mutated automatically without two approved disposable hubs and explicit ACL identities.
- Full Docker bring-up, backup/restore, upgrade/rollback and native package installation are environment-changing and remain delegated to the existing Debian integration suites.
- Exact Debian/MariaDB/browser version support and factory daemon state transitions remain unresolved mapping questions.

## High-risk untested areas

The unsafe-to-refactor areas remain live provisioning and rollback, factory recovery, schema/template application order, physical MFS partial failure, observable ACL policy (especially secure-share and over-limit), Team boot/Window Manager behavior in a browser, existing-install upgrades, and Docker/native parity. Contract presence tests reduce accidental drift but do not prove runtime equivalence.

## Readiness interpretation

The current Team-baseline gate remains **NOT READY** until the authoritative disposable Debian E2E passes, guarded provisioning/MFS/CLI DB tests pass, REST goldens are recorded, and critical browser scenarios have automated coverage or an approved manual baseline. `scripts/test-env/gate.sh` is the machine-enforced decision for that baseline scope: zero mandatory skips and zero failures are required.

That status is a critical constraint on later Team migration and self-hosting assertions. It is not a requirement to reproduce the entire Team product before defining the first no-Team kernel slice. The first extraction must instead add focused tests for selected application-neutral contracts—especially generic backend dispatch and the `Kind.loadPlugin` / `bootstrap.plugin` handshake—and must document every deliberate incompatibility. The safe suite remains ready for CI and establishes the reproducible starting point for those later comparisons.
