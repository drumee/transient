# Drumee container channel

The recommended, easiest way to self-host Drumee: one config file, a few
containers, automatic HTTPS.

## Quick start

```bash
curl -fsSL https://get.drumee.io | bash       # creates ./drumee/drumee.yaml
# edit ./drumee/drumee.yaml (domain, admin_email, ...)
curl -fsSL https://get.drumee.io | bash       # renders + starts
```

From a checkout:

```bash
scripts/get-drumee.sh                          # same flow, uses local files
```

## What runs

`config/render.mjs` turns `drumee.yaml` into `.env` + `docker-compose.yml`, and the
compose brings up:

| Service | Image | Role |
|---|---|---|
| `mariadb` | `mariadb:11` | Database (volume: `DRUMEE_DB_DIR`) |
| `redis` | `redis:7` | Cache / live-update channel |
| `schemas-init` | `drumee/schemas` | Run-once schema restore, then exits |
| `server-pod` | `drumee/server-pod` | REST API + WebSocket (volume: `DRUMEE_DATA_DIR`) |
| `ui-pod` | `drumee/ui-pod` | LETC frontend engine |
| `proxy` | `caddy:2` | Reverse proxy + automatic TLS |
| `jitsi`/`prosody`/`coturn` | — | Optional, via `COMPOSE_PROFILES` |

Ordering is handled by `depends_on` + healthchecks (no manual install order):
`mariadb (healthy)` → `schemas-init (completed)` → `server-pod` → `ui-pod` → `proxy`.

## Building the images

Images are built from the component repos (same source as the native packages):

```bash
docker build -f deploy/docker/Dockerfile.server \
  --build-arg REPO_BASE=git@github.com:drumee --build-arg BRANCH=preview \
  -t drumee/server-pod:<tag> deploy/docker
docker build -f deploy/docker/Dockerfile.ui \
  --build-arg REPO_BASE=... -t drumee/ui-pod:<tag> deploy/docker
```

Offline/CI builds: drop the source under `deploy/docker/.src/server-team` (or
`ui-team`) and the Dockerfile uses it instead of cloning. Publishing these images
is Phase 5 (CI/CD). Public source options: see `docs/reproducible-builds.md`.

## Verified locally

Built from local source (`scripts/build-images-local.sh`, `INSTALL_DEPS=0`):
`drumee/server-pod` (Node + pm2) and `drumee/ui-build` (real webpack bundles).
The corrected topology orchestrates correctly (`tests/demo-stack.sh`, stub app
images). server-pod boots pm2 + index.js/service.js against MariaDB/Redis.

## Resolved (from server-team/configs.js)

- **Listener ports** — confirmed: `--restPort` 24000 (service.js, `/-/*`),
  `--pushPort` 23000 (index.js, pages + WebSocket). `drumee.yaml` `ports.api`/`ports.ui`
  and the `Caddyfile` now use these.
- **`ecosystem.config.js`** — not shipped by the repo (dev-tools generates it). The
  image now ships `deploy/docker/ecosystem.config.js`, which passes the required
  `--restPort/--pushPort/--http-port/--conf-path` args (the scripts exit with
  "unrecognized arguments" without them).

## Remaining gates to a fully-serving real instance

- **`--conf-path`** — index.js/service.js load `<conf-path>/etc/drumee/conf.d`.
  The container must provide a populated `conf.d` (today supplied by the infra
  package). `CONF_PATH` defaults to `/`; wire conf.d provisioning into the image
  or a config volume.
- **Schema seed** — server needs the DB schema restored before it serves; this is
  the `schemas-init` + bootstrap-seed work (Phase 0.6, `make-seed.sh`). Until then
  server-pod will start but error against an empty database.
- **Healthcheck** — `/-/svc/system.ping`: confirm a cheap always-available method.
