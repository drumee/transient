# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains Debian package builders for the **Drumee** platform. Each subdirectory is a self-contained package builder that clones source from `git@github.com:drumee/`, compiles it, and produces a `.deb` file via `dh_make` + `dpkg-buildpackage`.

## Platform Architecture

Drumee is a **sovereign data infrastructure** — a Meta Operating System providing every application layer (auth, storage, backend, frontend) in one cohesive system. The packages built here are the four runtime components:

| Package | Runtime role |
|---|---|
| `drumee-static` | Static assets and localization files |
| `drumee-schemas` | MariaDB schema definitions and seed data |
| `drumee-server-pod` | Backend Node.js services (REST API + WebSocket) |
| `drumee-ui-pod` | Frontend rendering engine (LETC-based) |

Each deployed endpoint runs **two Node.js processes**: `index.js` (page serving + WebSocket) and `service.js` (REST API). All service calls follow the URL pattern `/-/svc/module.method` — there are no hardcoded routes.

### Core Subsystems

- **ACL** — Bitwise Linux-style permissions declared per-module in JSON; evaluated on every request before dispatch or 403.
- **MFS** (Meta File System) — Abstraction over the host filesystem with built-in permission awareness; raw filesystem is never exposed directly.
- **LETC** (Limitlessly Extensible Tree Components) — UI rendered on the client from JSON trees transmitted by the server; uses Backbone.Marionette widget classes identified by a `kind` key.
- **Request Pipeline** — Manages session lifecycle, ACL enforcement, input validation, output formatting, and the YP service registry.

### Runtime Paths

- Credentials: `/etc/drumee/credentials/` (JSON files, never committed to source control)
- Runtime config: accessed via `yp.sys_conf` (not environment files)
- Plugin directory: `/srv/drumee/runtime/plugins/server/<user>/<plugin>/`
- Plugin service URLs: `/-/<endpoint>/svc/module.method`

## Building Packages

**Never run build scripts as root.** All scripts check `$UID` and abort if run as root.

Build a single package:
```bash
infra/build.sh
schemas/build.sh
server/build.sh
ui/build.sh
static/build.sh
schemas-patch/build.sh --manifest=auto
```

Build all main packages at once:
```bash
./build-all.sh   # builds infra, schemas, ui, server in order
```

Common flags accepted by most build scripts:
- `--version=X.Y.Z` — override the version (default: read from `debian/changelog`)
- `--force=yes` / `--force=rebuild` — skip the "rebuild existing?" prompt
- `--email=user@example.com` — override maintainer email

GPG signing uses the maintainer email from `debian/changelog`. The key must be present in the local keyring.

Set `DEB_BUILD_TARGET=/path/to/dir` to automatically copy the built `.deb` to a target directory after each build.

## Shared Utilities

`utils/env.sh` — exports all Drumee runtime path constants (`DRUMEE_ROOT_DIR`, `DRUMEE_SERVER_HOME`, `DRUMEE_UI_HOME`, etc.)

`utils/functions.sh` — provides:
- `bundle <base> <repo-name> <branch> [src-files] [dest-path] [npm-script]` — clone or pull `git@github.com:drumee/<repo-name>.git`, run `npm i` if `package.json` exists, rsync files to the build dir
- `get_version <base>` / `get_email <base>` — parse from `debian/changelog`
- `check_version` / `check_email` — interactive prompts to confirm or change version/email, update `debian/control`
- `copyToTarget <path>` — copy `<path>_all.deb` to `$DEB_BUILD_TARGET` if set
- `bundle_acme <base> <dest>` — clone `acmesh-official/acme.sh` from GitHub (not Drumee)
- `parse_args "$@"` — parses `--version`, `--force`, `--type`, `--compile`, `--enable-api`, `--email` flags into exported shell vars

Set `REPO_BASE` to override the GitHub base URL used by `bundle()` (e.g., for a local mirror).

## Package Map

| Directory | Package name | Source repo(s) cloned | Key deps |
|---|---|---|---|
| `infra/` | `drumee-infra` | `setup-infra` (main), `acme.sh` | nginx, nodejs, npm, git, openssh-client |
| `schemas/` | `drumee-schemas` | `setup-schemas` (main), `schemas` (preview branch) | mariadb-server |
| `server/` | `drumee-server-pod` | `server-team` (preview branch), `schemas-utils` | nginx, redis, graphicsmagick, ffmpeg, libreoffice |
| `ui/` | `drumee-ui-pod` | `ui-team` (preview branch) | webpack (runs during build) |
| `static/` | `drumee-static` | `static` (main) | — |
| `schemas-patch/` | `drumee-patch` | `schemas` (preview) | @drumee/server-essentials |
| `builder/` | `drumee-infra` (interactive installer) | `setup` (somanos/wip) | debconf only |
| `admin/` | — | — | admin scripts only |

## Version Management

The authoritative version for each package lives in the first line of `<package>/debian/changelog`:
```
drumee-infra (1.2.11) unstable; urgency=medium
```

To bump a version, edit that first line in the `changelog` (following the standard Debian changelog format) before running the build script. The build scripts also update `Standards-Version` in `debian/control` to match.

### update-changelog.sh

`server/`, `static/`, `ui/`, and `schemas-patch/` each have an `update-changelog.sh` that auto-syncs the changelog from the cloned source repo's `package.json` version. It picks whichever version is higher (changelog vs. package.json) and prepends or replaces the entry. Some build scripts call this automatically.

```bash
server/update-changelog.sh --message="Custom message" --email=user@example.com
```

Without `--message`, it pulls the last 5 non-merge git commits from the source repo as bullet points.

## builder/ Package

`builder/` produces a `drumee-infra` **interactive installer** — distinct from `infra/` which is pre-configured. Key behaviours:

- Does **not** clone and compile upstream source. Packages pre-built artifacts from the `target/` directory in the repo root.
- Post-install runs `/var/lib/drumee/setup/menu/install.sh` — an interactive setup wizard.
- Prompts for domain name and data partition via debconf during `dpkg -i`.
- Builds **unsigned** (`dpkg-buildpackage -us -uc`) — no GPG key required.
- Does **not** accept `--version`, `--force`, or `--email` flags.
- Has its own `builder/utils/env.sh` and `builder/utils/functions.sh` with different path constants and a GitLab fallback: when `REPO_BASE` is unset, `bundle()` defaults to `git@gitlab.drumee.in:drumee/` instead of GitHub.

```bash
builder/build.sh        # package current target/ artifacts
builder/build.sh pull   # pull setup repo first, then package
```

## schemas Build Prerequisites

`schemas/build.sh` requires a seeds archive. It looks for `var/tmp/drumee/seeds.tgz` inside the schemas directory; if absent, it tries to create it from `$SEEDS_DIR` (defaults to `$HOME/docker/data/seeds/`). The build will exit if neither exists.

`schemas/seeds/` is gitignored — it contains large MariaDB binary files unsuitable for version control.

## Post-Install Behavior

- **infra**: runs `/var/lib/drumee/setup-infra/bin/install`
- **schemas**: runs `/var/lib/drumee/setup-schemas/bin/install`
- **server-pod**: sources `/etc/drumee/drumee.sh`, applies any pending patches from `/var/lib/drumee/postinstall/patch.sh`

## schemas-patch

`schemas-patch/build.sh` **requires `--manifest`** — without it the build exits silently. Two modes:

```bash
schemas-patch/build.sh --manifest=auto        # auto-generate from last N git commits
schemas-patch/build.sh --manifest=/path/to/manifest.txt  # use an explicit manifest file
schemas-patch/build.sh --manifest=auto 3      # auto-generate using last 3 commits (default: 2)
```

`--manifest=auto` diffs the last N commits of the cloned `schemas` repo to build `patches/manifest.txt` via `bin/make-manifest`. `--manifest=<file>` copies the given file directly. The build exits with "No change to build patch" if `manifest.txt` is missing after this step.
