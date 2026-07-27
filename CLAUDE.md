# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository builds, packages, and distributes the **Drumee** sovereign data platform through two channels from one source of truth (`config/drumee.yaml`):

- **Container channel** — Docker Compose stack (`scripts/dev-up.sh`, `scripts/get-drumee.sh`)
- **Native Debian channel** — `.deb` packages installable via `apt install drumee`

Each subdirectory under `infra/`, `schemas/`, `server/`, `ui/`, `static/` is a self-contained package builder that clones source from `git@github.com:drumee/`, compiles it, and produces a `.deb` via `dh_make` + `dpkg-buildpackage`. The `deploy/docker/` tree holds Dockerfiles and entrypoints for the container channel.

## Runtime Architecture

Each Drumee endpoint runs **three PM2 processes**:

| Process | Mode | Role |
|---|---|---|
| `main` | fork | Page serving + WebSocket (port 23000) |
| `main/service` | cluster | REST API workers (port 24000, scaled by RAM: 2 GB→2, 6 GB→3, >6 GB→4) |
| `factory` | fork | Schema factory — replenishes entity pool (autorestart disabled) |

All service URLs follow `/-/svc/module.method` — no hardcoded routes.

### Runtime Directory Layout

```
/srv/drumee/
├── runtime/
│   ├── server/main/     # drumee-server-pod: Node.js backend
│   ├── ui/main/         # drumee-ui-pod: LETC frontend engine
│   ├── tmp/             # temporary files (cleaned by cron)
│   └── plugins/server/<endpoint>/<plugin>/
├── static/              # drumee-static: assets, locale files
└── cache/

/data/mfs/               # user file storage (MFS-managed)

/etc/drumee/
├── drumee.sh            # master runtime environment (sourced by server at startup)
├── drumee.json          # master JSON config
├── conf.d/              # exchange, myDrumee, conference configs
├── credential/          # db.json, email.json, redis.json, crypto/ (never committed)
└── infrastructure/ecosystem.json  # PM2 process definitions

/var/lib/drumee/
├── setup-infra/         # infra install scripts + 88 lodash templates
├── setup-schemas/       # schema install scripts + populate.js
├── patches/             # pending schema patches
└── postinstall/patch.sh # applied at server startup
```

### Database Structure

**`yp`** — Central system database: `sys_conf`, `domain`, `vhost`, `entity`, `drumate`, `hub`, `organisation`, `settings`, `privilege`, mailserver tables.

**Per-entity databases** — One database per user and hub, created by `entity_create` stored procedure. Contains `mfs_*`, `permission`, `media`, and activity tables.

Five additional system databases: `utils`, `mailserver`, `template`, `trash`, plus per-hub/per-drumate sharded databases.

## Building Packages

### Prerequisites

- **No root** — all scripts check `$UID` and abort if root
- **Git SSH access** to `git@github.com:drumee/` (private repos)
- **GPG key** matching maintainer email in `debian/changelog` (in local keyring)
- **Node.js** (for packages running `npm install` or webpack)
- **Debian build tools**: `dh-make`, `dpkg-buildpackage`, `debhelper`, `build-essential`

### Commands

```bash
# Single package
infra/build.sh
schemas/build.sh
server/build.sh
ui/build.sh
static/build.sh
meta/build.sh                              # drumee metapackage (pure deps)
schemas-patch/build.sh --manifest=auto     # incremental schema patch

# All main packages in dependency order
./build-all.sh                             # infra → schemas → ui → server
```

Build outputs land in `<package>/build/<version>/`. Set `DEB_BUILD_TARGET=/path` to copy `.deb` files there (only `infra`, `schemas`, `server` honor this).

### Build flags

Most scripts take **no** flags — version and email are read from `<package>/debian/changelog` via `get_version`/`get_email`. `get_build_dir` unconditionally wipes and recreates the staging dir, so `--force` is unnecessary. Exceptions:

| Script | Flag | Effect |
|---|---|---|
| `ui/build.sh` | `--compile=yes\|no` | Parsed but **not honoured** — webpack always runs |
| `ui/build.sh` | `--enable-api=yes\|no` | Also compile the `api` webpack target (default `no`) |
| `schemas-patch/build.sh` | `--manifest=auto\|<file>` | **Required** — selects the patch manifest |
| `schemas-patch/build.sh` | `<N>` (positional) | Commit depth for `--manifest=auto` (default `2`) |
| `builder/build.sh` | `pull` (positional) | Pull the `setup` repo before packaging |

### Environment variables

| Variable | Effect |
|---|---|
| `DEB_BUILD_TARGET=/path` | Copy `.deb` there after build (infra, schemas, server only) |
| `SEEDS_DIR=/path` | Source for schemas seeds archive (default `$HOME/docker/data/seeds/`) |
| `REPO_BASE=git@...` | Override GitHub base URL for `bundle()` (local mirror) |

### schemas prerequisites

`schemas/build.sh` requires `var/tmp/drumee/seeds.tgz` (a `mariabackup` snapshot). If absent, it tries `$SEEDS_DIR`. `schemas/seeds/` is gitignored.

## Install Order and Dependencies

```
drumee-infra → drumee-schemas → drumee-static → drumee-server-pod → drumee-ui-pod
```

`drumee-patch` can be applied after `drumee-schemas`.

```
drumee-infra
└── drumee-schemas   (mariadb-server, mariadb-client)
    ├── drumee-static
    ├── drumee-server-pod  (nginx, redis, ffmpeg, libreoffice, graphicsmagick, …)
    └── drumee-ui-pod      (nodejs, git)
        └── drumee-patch   (mariadb-server, mariadb-client)
```

## Post-Install Behavior

- **drumee-infra**: runs `setup-infra/bin/install` (root) — renders 88 lodash templates into `/etc/drumee/`, `/etc/nginx/`, `/etc/bind/`, `/etc/prosody/`, `/etc/jitsi/`, `/etc/postfix/`, MariaDB, Coturn. Sets up SSL (ACME/self-signed/own certs), DNS (BIND9), DKIM, Prosody XMPP, PM2 ecosystem, and crontab (cert renewal, tmp cleanup, watchdog, DB/storage backups).
- **drumee-schemas**: runs `setup-schemas/bin/install` (root) — restores MariaDB from seeds via `mariabackup`, creates system accounts (nobody, guest, system, admin), provisions initial hubs, imports wallpapers/tutorials, generates RSA key pair, sends welcome email with password-reset link.
- **drumee-server-pod**: sources `/etc/drumee/drumee.sh`, applies pending patches from `/var/lib/drumee/postinstall/patch.sh`.
- **drumee-patch**: stages patch files; applied at next server startup (not immediately).
- **drumee-static**, **drumee-ui-pod**: no special post-install.

## Config System (Single Source of Truth)

`config/drumee.yaml` drives both channels. `config/render.mjs` is a dependency-free YAML parser + validator + renderer:

```bash
node config/render.mjs validate --config config/drumee.yaml
node config/render.mjs all --config config/drumee.yaml --out-dir out
# Commands: validate | env | compose | debconf | caddyfile | all
```

Outputs: `.env`, `docker-compose.yml`, `install.conf` (debconf preseed), `Caddyfile`. Null passwords in `database.password`/`redis.password` trigger automatic strong-random generation.

`config/drumee.schema.json` is the JSON Schema (draft 2020-12) defining the config contract. `config/drumee.example.yaml` is the annotated template.

## Container Channel

```bash
scripts/build-images-local.sh   # build images from local source (tag: local)
scripts/dev-up.sh               # render config + bring up compose stack
scripts/dev-down.sh             # stop stack (KEEP_DATA=1 to preserve volumes)
```

Compose orchestration order: `mariadb` healthcheck → `schemas-init` → `ui-build` → `schemas-populate` → `server-pod` + `factory`, fronted by a `caddy` proxy.

Dockerfiles live in `deploy/docker/`. Key files:
- `ecosystem.config.js` — pm2 config (`--restPort 24000`, `--pushPort 23000`, `--http-port`, `--conf-path`)
- `entrypoint.sh` — sources `/etc/drumee/drumee.sh`, applies pending patches, launches pm2
- `schemas-init.sh` — idempotent DB bootstrap (creates `yp`, `utils`, `mailserver`, `template`, `trash`)
- `container-populate.js` — creates system accounts + RSA keypair + entity pool
- `container-factory.js` — daemon replenishing the pool (watermark-based, default 10)

Env vars for local builds: `SERVER_SRC`, `UI_SRC`, `SCHEMAS_SRC`, `SETUP_SCHEMAS_SRC`, `SETUP_INFRA_SRC`.

## Release & Version Management

### release-manifest.yaml

The authoritative version file. `product` is the user-facing release-train version; component versions are internal:

```yaml
product: 1.0.0
infra: 1.2.11
schemas: 2.6.99
server: 2.9.61
...
```

### Version coherence workflow

```bash
scripts/check-versions.sh          # verify changelogs match manifest (CI guard)
scripts/check-versions.sh --sync   # auto-update changelogs from manifest
meta/make-control.sh               # regenerate metapackage deps pinned to manifest
meta/make-control.sh --check       # CI guard: fail if out of sync
```

To bump a version: edit `release-manifest.yaml`, then run `--sync` + `make-control.sh`.

### update-changelog.sh

`server/`, `static/`, `ui/`, `schemas-patch/` each have one. Compares `debian/changelog` version against the upstream `package.json` version and picks whichever is **higher**. Without `--message`, it pulls the last 5 non-merge git commits as bullet points. Called automatically by `server/build.sh`, `ui/build.sh`, and `static/build.sh` (not `schemas-patch`).

### Debian changelog format

```
<package-name> (<version>) unstable; urgency=medium

  * Change description

 -- Maintainer Name <email>  Day, DD Mon YYYY HH:MM:SS +TZOFF
```

Two-space indent before bullets and single-space before `--` are required by `dpkg-parsechangelog`.

## Publishing & Distribution

### APT repository (flat, self-hosted at `apt.drumee.net`)

```bash
scripts/publish-apt.sh --debs=DIR --out=REPO_DIR [--key=EMAIL_OR_KEYID]
scripts/deploy-apt-repo.sh --host=USER@HOST [--repo-dir=DIR] [--domain=DOMAIN]
```

`publish-apt.sh` generates `Packages`, `Packages.gz`, `Release`, `InRelease`, `Release.gpg`, and `drumee-archive-keyring.asc` into a flat directory (no `dists/pool` tree). Requires `apt-utils` (for `apt-ftparchive`) and `gpg`.

`deploy-apt-repo.sh` rsyncs that directory to the VPS document root (default `/var/www/apt.drumee.net`), installs an nginx vhost for the domain (default `apt.drumee.net`), and reloads nginx. TLS is set up separately with certbot; `APT_LOCAL_DIR` selects the local repo dir (default `apt-repo`).

Clients configure:

```bash
curl -fsSL https://apt.drumee.net/drumee-archive-keyring.asc \
  | sudo tee /etc/apt/keyrings/drumee.asc >/dev/null
echo "deb [signed-by=/etc/apt/keyrings/drumee.asc] https://apt.drumee.net/ ./" \
  | sudo tee /etc/apt/sources.list.d/drumee.list
sudo apt update && sudo apt install drumee
```

`scripts/install-native.sh` does this automatically (`APT_URL`/`KEYRING_URL` override the defaults).

### Container images

```bash
scripts/publish-images.sh   # build + push to registry
# Env: REGISTRY, TAG, PUSH=1, ALSO_LATEST, ALSO_STABLE, MEDIA_DEPS, INSTALL_DEPS
```

### Full site publish (apt + Pages)

```bash
APT_SSH_HOST=deploy@vps GH_TOKEN=<token> scripts/publish-site.sh --debs=out-debs [--key=KEYID]
```

Builds the flat repo once, then deploys it to two independent targets: `apt.drumee.net` over rsync/SSH (`APT_SSH_HOST`, `APT_REPO_DIR`, `APT_DOMAIN`) and the `get.drumee.com` Pages content — installers, renderer, keyring, CLIs — to `PAGES_REPO` (`GH_TOKEN`). Each target is skipped with a notice when its credential is absent; setting neither is an error. `scripts/install-native.sh` is copied into the flat repo so `https://apt.drumee.net/install-native.sh` serves the bootstrap without depending on Pages.

## Deployment

### Manual native install

```bash
# On build machine
./build-all.sh
scp infra/build/drumee-infra_*.deb schemas/build/drumee-schemas_*.deb \
    server/build/drumee-server-pod_*.deb ui/build/drumee-ui-pod_*.deb \
    static/build/drumee-static_*.deb user@server:/tmp/

# On target server — install in dependency order
dpkg -i /tmp/drumee-infra_*.deb
dpkg -i /tmp/drumee-schemas_*.deb
dpkg -i /tmp/drumee-static_*.deb
dpkg -i /tmp/drumee-server-pod_*.deb
dpkg -i /tmp/drumee-ui-pod_*.deb
```

### Patch-only update

```bash
schemas-patch/build.sh --manifest=auto
scp schemas-patch/build/drumee-patch_*.deb user@server:/tmp/
# On server:
dpkg -i /tmp/drumee-patch_*.deb
drumee restart   # patches are staged on install, applied at restart
```

## Testing

```bash
tests/run-all.sh             # full suite (no private source or images needed)
tests/smoke-config.sh        # 10-assertion config rendering smoke test
tests/smoke-container.sh     # container install smoke test (needs Docker)
tests/e2e-local.sh           # full-stack E2E against tag:local images
tests/wizard-install.sh      # interactive installer render-only test
tests/native/install-verify.sh      # native channel E2E (disposable Debian container)
tests/native/control-deps.sh        # inter-package dependency ordering check
tests/native/make-seed.sh           # generate bootstrap seeds.tgz for schemas build
```

`run-all.sh` runs: shell syntax (`bash -n`) → ShellCheck → renderer parse → config smoke → version drift guard → end-to-end render → compose validity (if Docker available) → operator CLI guards → wizard render → native packaging metadata.

## CI/CD (GitHub Actions)

- **`.github/workflows/ci.yml`** — every PR/push to `main` or `feat/**`: shell lint + ShellCheck + `tests/run-all.sh`. No secrets needed.
- **`.github/workflows/release.yml`** — on `v*` tags: version coherence guard → build+push images (cosign-signed via GitHub OIDC, SBOM via syft) → build `.deb` packages → native install E2E → publish apt-stable + Pages → container smoke test. Secrets (all gated — missing = skip, not fail): `DRUMEE_SSH_KEY`, `GPG_PRIVATE_KEY`/`GPG_PASSPHRASE`, `REGISTRY_TOKEN`, `PAGES_DEPLOY_TOKEN`.

## CLIs

### drumee (PM2 wrapper)

Installed by `drumee-server-pod` to `/usr/sbin/drumee`:

```bash
drumee start|stop|restart [<service>]
drumee restart <user>/service       # restart a specific plugin service
drumee log <service>                # tail PM2 logs
```

### drumee-ctl (lifecycle operator)

Channel-aware (detects container vs. native). In `bin/drumee-ctl`:

```bash
drumee-ctl status|doctor|backup|restore <file>|upgrade [tag]|rollback
```

`doctor` checks Docker/DB/Redis/TLS health. `backup` creates timestamped tgz with DB dump + data + config. Set `DRUMEE_DIR` to point at the compose project.

### drumee-plugin

In `bin/drumee-plugin`:

```bash
drumee-plugin add <source> [--endpoint=E] [--name=N]
drumee-plugin list|remove|enable|disable <ep/name>
drumee-plugin apply <manifest.json>
```

Source can be git URL (`#ref`), local dir, or archive. Installs to `$PLUGIN_DIR/<endpoint>/<name>` (default `/srv/drumee/runtime/plugins/server`). Restarts backend after changes.

## Shared Utilities

`utils/env.sh` — exports runtime path constants (`DRUMEE_ROOT_DIR=/srv/drumee`, `DRUMEE_DATA_DIR=/data`, `DRUMEE_SERVER_HOME`, `DRUMEE_UI_HOME`, `ACME_DIR=/etc/acme`, etc.). Also re-checks `$UID`.

`utils/functions.sh` — provides:
- `bundle <base> <repo-name> <branch> [src-files] [dest-path] [npm-script]` — clone/pull from `${REPO_BASE:-git@github.com:drumee}`, `npm i`, rsync to build dir. On re-runs: `git stash` + `git pull` + `git checkout` instead of fresh clone.
- `bundle_acme <base> <dest>` — clone `acmesh-official/acme.sh` from GitHub (not Drumee)
- `get_version <base>` / `get_email <base>` — parse from `debian/changelog`
- `get_build_dir <dir>` — unconditionally wipe + recreate staging dir
- `copyToTarget <path>` — copy `.deb` to `$DEB_BUILD_TARGET` if set
- Obsolete interactive helpers (`check_version`, `check_email`, `check_build_dir`, `parse_args`) — only `admin/build.sh` still uses the `check_*` flow

## Package Directory Map

| Directory | Package | Source repo(s) | Notes |
|---|---|---|---|
| `infra/` | `drumee-infra` | `setup-infra`, `acme.sh` | Post-install renders 88+ config templates |
| `schemas/` | `drumee-schemas` | `setup-schemas`, `schemas` | Requires `seeds.tgz`; post-install restores MariaDB |
| `server/` | `drumee-server-pod` | `server-team` | Post-install applies pending patches |
| `ui/` | `drumee-ui-pod` | `ui-team` | Webpack build during package build |
| `static/` | `drumee-static` | `static` | No deps, served by nginx |
| `schemas-patch/` | `drumee-patch` | `schemas` | Requires `--manifest` |
| `builder/` | `drumee-bootstrap` | `setup` | Interactive installer, builds unsigned, GitLab fallback |
| `meta/` | `drumee` | — | Metapackage, deps pinned via `make-control.sh` |
| `admin/` | — | — | Admin scripts only (uses interactive `check_*` flow) |

## Key Directories

```
config/         drumee.yaml schema + render.mjs (single source of truth)
deploy/docker/  Dockerfiles, Caddyfile, entrypoints (container channel)
scripts/        build/publish images, get-drumee, dev-up/down, apt repo
bin/            drumee-ctl + drumee-plugin CLIs
meta/           drumee metapackage + make-control.sh
tests/          config + container + native + E2E test suites
target/         pre-built artifacts for drumee-bootstrap
docs/           full documentation (quickstart, lifecycle, security, per-package details)
```

## External Documentation

Full docs are in `docs/` and at [drumee.github.io/docs/package-building](https://drumee.github.io/docs/package-building/):
- Per-package deep dives: infra, schemas, server, ui, static, schemas-patch, builder
- Quickstart, first-deploy runbook, production ops, lifecycle, security
- Build pipeline, reproducible builds, release engineering, version management
