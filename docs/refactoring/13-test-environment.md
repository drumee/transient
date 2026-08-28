# Local Baseline Test Environment

## Status

The baseline wrapper is implemented and its non-image tests pass. It is currently **NOT READY** to run the full Phase 1 suite from this checkout because `sources/server-team/node_modules` and `sources/ui-team/node_modules` are absent. The authoritative builder sets `INSTALL_DEPS=0` and reuses those dependency trees (`sources/debian/scripts/build-images-local.sh`, `sources/debian/deploy/docker/Dockerfile.{server,ui}`). The wrapper will not install into or otherwise mutate `sources/**`.

Docker 29.2.0, Compose 5.0.2, buildx 0.31.1 and Node.js 22.22.0 are available on the tested host. Docker daemon access succeeds when authorized. `scripts/test-env/debian-tests.sh` ran the existing Debian `tests/run-all.sh` from a disposable copy and passed 12 checks with no failures. Image build and `e2e-local.sh` were not run because `check.sh` correctly stopped at the missing dependency contexts.

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

## Authoritative path validation

`sources/debian/scripts/build-images-local.sh` accepts:

| Variable | Wrapper value | Builder behavior |
|---|---|---|
| `SERVER_SRC` | `sources/server-team` | Required; server image context |
| `UI_SRC` | `sources/ui-team` | Required; UI build context |
| `SCHEMAS_SRC` | `sources/schemas` | Required; schema image and population context |
| `SETUP_SCHEMAS_SRC` | `sources/setup-schemas` | Population context; builder does not preflight it itself |
| `STATIC_SRC` | `sources/static` | Optional; present in this import and built |
| `SETUP_INFRA_SRC` | `sources/setup-infra` | Optional; absent here, so `infra-init` is skipped |
| `TAG` | `local` by default | Matches dev/E2E image references |
| `MEDIA_DEPS` | `0` by default | Omits large media packages from the smoke image |

`sources/debian/tests/e2e-local.sh` has no source-path overrides. It consumes already-built `drumee/{schemas,server-pod,ui-build,schemas-populate}:local`, renders a temporary Compose project named `drumee-e2e`, excludes the proxy, verifies initialization/server/admin/factory behavior, and removes its containers, volumes and temporary directory on exit.

No external sibling checkout or automatic GitHub clone is used. Missing `setup-infra` is passed as the nonexistent imported path so the existing optional skip executes.

## Prerequisites

- Linux.
- Docker daemon accessible to the invoking user.
- Docker Compose plugin and buildx.
- Node.js 20 or newer.
- At least 20 GiB free (conservative image/runtime preflight).
- Imported source directories listed above.
- Exact dependency trees already present in the immutable `server-team` and `ui-team` build contexts, because Debian's local builder uses `INSTALL_DEPS=0` to avoid private-registry access.

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
scripts/test-env/logs.sh            # core service logs
scripts/test-env/logs.sh factory    # one service
scripts/test-env/down.sh            # containers, volumes, DB and MFS state
scripts/test-env/reset.sh           # down + rendered runtime state
REMOVE_TEST_IMAGES=1 scripts/test-env/reset.sh  # additionally remove :local images
```

`build.sh` calls `check.sh` first and exports every `*_SRC` path into `transient/sources/**`. `MEDIA_DEPS=1 scripts/test-env/build.sh` opts into the heavy runtime tools. A non-local `TAG` can build images, but the existing E2E requires `TAG=local` and the wrapper warns accordingly.

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

## Known limitations

- The imported build contexts currently lack `node_modules`, so image build cannot proceed without an approved reproducible dependency import. The wrapper will not fetch or mutate them.
- `sources/setup-infra` is absent. The existing builder skips `infra-init`; local mode does not exercise optional mail/DNS/Jitsi infrastructure.
- `MEDIA_DEPS=0` omits LibreOffice, FFmpeg and related heavy tools, so media conversion/editor behavior needs a separate explicit build.
- The environment exercises the container channel only. Native Debian installation remains covered by metadata/render checks and requires a disposable VM.
- The Debian E2E checks HTTP/server/factory behavior but is not browser automation. Window Manager, Finder drag/drop and preview compatibility remain separate Phase 1 gaps.
- The persistent direct-port stack bypasses Caddy static routing. This matches the authoritative proxy-free E2E isolation strategy but does not characterize proxy/TLS behavior.
- CLI DB integration still requires the CLI's local `/etc/drumee`, dependency and physical-storage assumptions; bringing up this stack alone does not install the CLI into a container.

## Readiness decision

**NOT READY for full Phase 1 compatibility execution** on the current checkout. The wrappers and non-image validation are ready; readiness requires restoring the exact dependency-bearing immutable build contexts, then successfully running `build.sh`, `e2e.sh`, `up.sh`, `status.sh`, and the configured Phase 1 integration suite.
