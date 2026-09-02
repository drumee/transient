# Local Baseline Test Environment

## Status

The wrapper is implemented, builds the imported sources through a disposable dependency-bearing staging area, and has a strict gate that treats an unexecuted live scenario as failure. It is currently **NOT READY** for full Phase 1 Team-baseline compatibility execution: the authoritative Debian E2E ran and failed during `schemas-populate`.

This environment remains the authoritative reference for the imported Team/self-hosting baseline. It is not a requirement that the first minimal kernel reproduce every Team behavior before `hello`; it supplies evidence, later regression coverage and selected contracts for that kernel work.

The tested workstation has Docker 29.2.0, Compose 5.0.2, buildx 0.31.1, Node.js 22.22.0 and npm 11.18.0. `scripts/test-env/debian-tests.sh` ran the existing `sources/debian/tests/run-all.sh` from a disposable validation copy: 298 passed, 0 failed. `scripts/test-env/build.sh` completed and produced the local images. `scripts/test-env/e2e.sh` then produced 3 passes and 5 failures: `schemas-init`, `ui-build`, and the factory watermark passed; `schemas-populate`, server health, Team HTML, REST, and admin login failed.

The persistent diagnostic stack retained the failure log. Factory entity creation calls `sources/server-team/offline/factory/schema.js::create_entity`, which calls `publish_search_projection()` after the entity SQL and MFS root. That method invokes `mfs_search_projection_rebuild`; the imported procedure deliberately signals `SEARCH_PROJECTION_REBUILD_ACTIVE_TRANSACTION` if `@@in_transaction = 1` (`sources/schemas/common/procedures/mfs/mfs_search_projection_rebuild.sql`). The affected entities are not marked clean, so the subsequent fixed-account creations in `sources/setup-schemas/lib/organization.js::{createNobody,createGuest,createSystemUser}` receive `EMPTY_FACTORY`; `createSystemUser` then dereferences the missing user and exits. This is a reproducible baseline defect/incompatibility on this Docker/MariaDB path, not a wrapper change. No baseline source was altered to bypass it.

## Architecture

```text
transient/sources/{server-team,ui-team,schemas,setup-schemas,static}
                            |
                            v
sources/debian/scripts/build-images-local.sh
                            |
                  drumee/*:local images
                            |
                            v
generated proxy-free Compose project: transient-baseline
                            |
                            v
Phase 1 compatibility harness + sources/debian/tests/e2e-local.sh
```

`sources/debian` remains the deployment implementation. The wrapper supplies paths and isolated configuration; it does not duplicate Dockerfiles or patch the renderer/Compose model. Like the authoritative E2E, the persistent stack omits Caddy to avoid ports 80/443 and publishes the server's UI and REST listeners directly on configurable loopback-only ports.

The scope is deliberately the immutable Team baseline. Future `server-runtime` / `ui-runtime`, `hello` and `marketing` tests must use their own target artifacts and focused kernel contracts; this wrapper remains useful when a later decision selects a Team, deployment or provisioning behavior for regression comparison.

## Authoritative path validation

`sources/debian/scripts/build-images-local.sh` accepts:

| Variable | Wrapper value | Builder behavior |
|---|---|---|
| `SERVER_SRC` | `sources/server-team` | Required; server image context |
| `UI_SRC` | `sources/ui-team` | Required; UI build context |
| `SCHEMAS_SRC` | `sources/schemas` | Required; schema image and population context |
| `SETUP_SCHEMAS_SRC` | `sources/setup-schemas` | Population context; builder does not preflight it itself |
| `STATIC_SRC` | `sources/static` | Optional; present in this import and built |
| `SETUP_INFRA_SRC` | `sources/setup-infra` | Present and pinned; builds optional historical `infra-init` from the immutable source |
| `TAG` | `local` by default | Matches dev/E2E image references |
| `MEDIA_DEPS` | `0` by default | Omits large media packages from the smoke image |

`sources/debian/tests/e2e-local.sh` has no source-path overrides. It consumes already-built `drumee/{schemas,server-pod,ui-build,schemas-populate}:local`, renders a temporary Compose project named `drumee-e2e`, excludes the proxy, verifies initialization/server/admin/factory behavior, and removes its containers, volumes and temporary directory on exit.

No external sibling checkout or automatic GitHub clone is used. `setup-infra` is supplied directly from its pinned import; the builder consequently builds `drumee/infra-init:local`. The authoritative proxy-free baseline E2E still does not use that optional service as its HTTP host.

## Dependency staging

`sources/debian/scripts/build-images-local.sh` builds the server and UI contexts with `INSTALL_DEPS=0` (`sources/debian/deploy/docker/Dockerfile.server` and `Dockerfile.ui`), so it requires usable `node_modules` in the supplied context. The imports do not have dependency trees and `sources/ui-team` has no lockfile. `build.sh` therefore runs `stage-build-src.sh` before the Debian builder when source dependency trees are absent:

```text
sources/server-team, sources/ui-team
       │ exact copy; source remains read-only
       ▼
.tmp/test-env/build-src/{server-team,ui-team}
       │ npm ci only here
       ▼
build-images-local.sh with SERVER_SRC/UI_SRC set to staging paths
```

The staging script verifies a recursive source-content diff after installation, ignoring only `node_modules`, `.git`, the harness-provided UI lockfile, and npm's generated `.dev-tools.rc`. `sources/server-team/package-lock.json` is the imported lock. The reviewed UI lock and its provenance are committed as `tests/fixtures/build-locks/ui-team-package-lock.json` and `ui-team-lock-metadata.json`; the metadata pins the SHA-256 of the imported UI `package.json`, Node/npm versions and the resolution command. npm 11 requires `--dangerously-allow-all-scripts=true` for the lockfile's pinned native installation hooks; this is confined to the disposable contexts. `.tmp/test-env/build-src/dependency-resolution.env` records the source-tree ID, lock hashes, tool versions and exact install command for each run.

That staging lock reproduces the baseline Team image only: it resolves `@drumee/server-essentials` 1.3.1. It must not be reused to constrain a future isolated `server-runtime`; Phase 2 targets the current imported Essentials source independently and records any deliberate runtime adaptation in its own focused tests.

## Prerequisites

- Linux.
- Docker daemon accessible to the invoking user.
- Docker Compose plugin and buildx.
- Node.js 20 or newer.
- At least 20 GiB free (conservative image/runtime preflight).
- Imported source directories listed above.
- Registry access to resolve the committed lockfiles when the disposable staging contexts do not already exist. The wrapper never installs into `sources/**`.

Run:

```bash
scripts/test-env/check.sh
```

The check is read-only, prints actionable failures, verifies `sources/**` is pristine, and installs nothing.

## Commands

```bash
scripts/test-env/check.sh          # prerequisites and immutable-source guard
scripts/test-env/debian-tests.sh   # Debian run-all.sh in disposable validation copy
scripts/test-env/build.sh          # explicit source mapping -> drumee/*:local
scripts/test-env/up.sh             # persistent isolated baseline stack
scripts/test-env/status.sh         # jobs, health, HTTP/REST and pool counts
scripts/test-env/e2e.sh            # authoritative disposable e2e-local.sh
scripts/test-env/capture-rest-golden.sh # record sanitized REST contract after a live pass
scripts/test-env/browser-baseline.sh # optional persistent/manual browser baseline recorder
scripts/test-env/gate.sh           # strict Phase 1 readiness gate; SKIP fails
scripts/test-env/logs.sh            # core service logs
scripts/test-env/logs.sh factory    # one service
scripts/test-env/down.sh            # containers, volumes, DB and MFS state
scripts/test-env/reset.sh           # down + rendered runtime state
REMOVE_TEST_IMAGES=1 scripts/test-env/reset.sh  # additionally remove :local images
```

`build.sh` calls `check.sh` first, stages only the dependency-bearing server/UI contexts when needed, and exports every `*_SRC` path. Schema, setup-schema, static, and pinned setup-infra paths always point directly to `transient/sources/**`; the staged server/UI files are byte-for-byte checked against their imports. `MEDIA_DEPS=1 scripts/test-env/build.sh` opts into the heavy runtime tools. A non-local `TAG` can build images, but the existing E2E requires `TAG=local` and the wrapper warns accordingly.

`up.sh` defaults to:

```text
Compose project: transient-baseline
Team UI:        http://127.0.0.1:23800/
REST base:      http://127.0.0.1:24800/
Admin:          admin@transient.test
Pool:           drumate=5, hub=5; watermark=5; interval=5s
```

Override loopback ports with `UI_HOST_PORT` and `API_HOST_PORT`; both must be distinct unprivileged ports. Override the project only with a name beginning `transient-`. Docker refuses the launch if a selected host port is already allocated.

After `up.sh`, wait for initialization and use `status.sh`. Retrieve the deterministic disposable password from `.tmp/test-env/baseline/.env` or the `schemas-populate` logs. Never reuse it outside this environment.

To expose the runtime to Phase 1 tests:

```bash
set -a
source .tmp/test-env/baseline/runtime.env
set +a
scripts/test-baseline-integration.sh
```

`runtime.env` includes `DRUMEE_TEST_BASE_URL` and `DRUMEE_TEST_UI_URL` as well as the requested Compose paths/services. It contains no generated database password or real credential. The Compose `.env` contains generated/test-only secrets, is mode `0600`, is ignored by Git, and remains under disposable runtime state.

## Runtime state

All generated state is under:

```text
.tmp/test-env/baseline/
  drumee.yaml
  .env
  docker-compose.yml
  docker-compose.test.yml
  runtime.env
  db/
  data/
  plugins/
```

`.tmp/` is ignored. MariaDB and Drumee physical storage are bind-mounted only from the baseline runtime directory. Named UI/credential volumes are scoped by the unique Compose project. No runtime file is written under `sources/**`.

## Safety

- Every build, E2E and lifecycle entry checks that `sources/**` has no tracked or untracked changes.
- The stack binds only `127.0.0.1` test-specific ports and does not start the generated proxy.
- The identity is `localhost` / `admin@transient.test`; no production domain is accepted from the generated configuration.
- `down.sh` removes the disposable Compose volumes and only the known `baseline/{db,data,plugins}` paths.
- `reset.sh` requires the runtime path to equal `<transient>/.tmp/test-env/baseline`; it cannot accept an arbitrary deletion target.
- Local images are retained by default and removed only with `REMOVE_TEST_IMAGES=1`.
- Destructive Phase 1 entity tests retain their separate explicit guards documented in `12-compatibility-harness.md`.

## E2E coverage

The wrapped authoritative E2E verifies MariaDB and Redis dependency startup; successful `schemas-init`, `ui-build`, and `schemas-populate`; healthy `server-pod`; Team HTML; REST response; admin login through `session_login_next`; and both factory pools at their watermark (`sources/debian/tests/e2e-local.sh`). `status.sh` exposes the same persistent-stack signals and returns nonzero for failed jobs, unhealthy server, unavailable endpoints, or pools below the deterministic count.

`e2e.sh` is the authoritative automated gating path. It delegates to the imported `e2e-local.sh`, which creates and destroys its own temporary directory, Compose containers, and volumes, deliberately omits the proxy, and does not bind the ordinary development ports. `up.sh` is instead an optional persistent, loopback-only diagnostic/browser environment. It uses the same Debian renderer and images, but retains its runtime state until `down.sh` or `reset.sh` is explicitly requested.

### REST golden capture

After an authoritative live environment is healthy and an explicitly test-only authenticated session/header is available, run:

```bash
DRUMEE_TEST_BASE_URL=http://127.0.0.1:<api-port> \
DRUMEE_TEST_AUTH_HEADER_VALUE='Bearer <test-only-value>' \
scripts/test-env/capture-rest-golden.sh
```

It records exactly six sanitized observations in `tests/fixtures/rest/baseline.json`: `yp.get_env`, unknown module, unknown method, malformed service, representative ACL denial, and an authenticated read. The normalizer retains status/envelope/error semantics but reduces arbitrary response values to types and redacts credentials, tokens, host-specific IDs and identities. Once present, `tests/integration/server-live.test.js` requires exact normalized equality rather than accepting a broad status/error range. No fixture was recorded in this run because the authoritative stack never reached REST availability.

### Browser/manual baseline

`browser-baseline.sh` is intentionally interactive and only applies to the optional persistent stack after it is healthy. It writes ignored evidence to `.tmp/test-env/results/browser-baseline.tsv`, covering Window Manager open/close/focus/multiple-window behavior, Finder navigation, MFS file open, drag/drop copy-or-move, and preview. The command requires every result to be `PASS` and an explicit reviewer `YES` before it writes a passing result marker. The corresponding deterministic checklist is `tests/fixtures/manual-browser-checklist.md`. This run could not perform it because baseline schema population did not succeed.

### Strict Phase 1 gate

`scripts/test-env/gate.sh` reports `PASS`, `FAIL`, or `SKIP / NOT CONFIGURED` for every mandatory surface and exits nonzero unless every one is `PASS`:

```text
safe tests; Debian E2E; provisioning; MFS live; CLI DB; REST golden;
empty-factory lifecycle; browser baseline
```

It consumes results only when they identify the current immutable source tree, so stale evidence cannot make a changed baseline appear ready. Provisioning/MFS/CLI DB require their existing explicit disposable-instance guards. The gate intentionally treats missing environment variables, absent authentication/golden data, or unrecorded browser approval as `SKIP`, and every mandatory `SKIP` is a failure.

## Known limitations

- Staging needs access to the package registry to resolve the imported server lock and reviewed UI lock. This is a reproducible preparation step, but the imports do not themselves carry an offline dependency cache.
- On the tested baseline, `schemas-populate` is blocked by the active-transaction search-projection failure described above. Until that baseline compatibility issue is understood and resolved upstream or a compatible runtime combination is identified, no REST golden, live provisioning/MFS/CLI DB, or browser evidence can be captured from this stack.
- The pinned `sources/setup-infra` import lets the historical builder produce optional `infra-init`, but the proxy-free baseline E2E does not exercise its generated Nginx configuration or optional mail/DNS/Jitsi services. The new-kernel Nginx contract is deliberately deferred to the separate Phase 2 kernel integration environment defined in `14-minimal-kernel-plan.md`.
- `MEDIA_DEPS=0` omits LibreOffice, FFmpeg and related heavy tools, so media conversion/editor behavior needs a separate explicit build.
- The environment exercises the container channel only. Native Debian installation remains covered by metadata/render checks and requires a disposable VM.
- The Debian E2E checks HTTP/server/factory behavior but is not browser automation. Window Manager, Finder drag/drop and preview compatibility remain separate Phase 1 gaps.
- The persistent direct-port stack bypasses Caddy static routing. This matches the authoritative proxy-free E2E isolation strategy but does not characterize proxy/TLS behavior.
- CLI DB integration still requires the CLI's local `/etc/drumee`, dependency and physical-storage assumptions; bringing up this stack alone does not install the CLI into a container.

## Readiness decision

**NOT READY for full Phase 1 Team-baseline compatibility execution** on the tested baseline. Image building and authoritative E2E are now exercised, and the failure is captured. Readiness requires a passing authoritative `e2e-local.sh` baseline, successful configured provisioning/MFS/CLI DB tests, sanitized REST golden capture, approved browser evidence, and a strict gate with no mandatory skips. This task does not modify the immutable baseline to make those conditions true.

This does not redefine the initial architectural target: the minimal kernel begins with selected no-Team contracts and `hello`. It does mean that later claims of Team or self-hosting compatibility cannot be marked ready until this baseline gate passes.

## Separate Phase 2 kernel environment

The baseline wrapper above remains Team/self-hosting evidence only. The separate
no-Team kernel environment is documented in
[`15-phase2-runtime-extraction.md`](15-phase2-runtime-extraction.md) and uses
`scripts/test-env/kernel/{check,build,configure,up,status,test,logs,down,reset}.sh`.
It builds a clean Debian Node/Nginx image from the pinned `setup-infra` contract
and Phase 2 target code; it does not reuse baseline Team images or the failed
schema/factory path.
