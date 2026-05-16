# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This repository contains Debian package builders for the **Drumee** platform. Each subdirectory is a self-contained package builder that clones source from `git@github.com:drumee/`, compiles it, and produces a `.deb` file via `dh_make` + `dpkg-buildpackage`.

## Building Packages

**Never run build scripts as root.** All scripts check `$UID` and abort if run as root.

Build a single package:
```bash
infra/build.sh
schemas/build.sh
server/build.sh
ui/build.sh
static/build.sh
mfs/build.sh
schemas-patch/build.sh
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
- `bundle <base> <repo-name> <branch> [src-files] [dest-path]` — clone or pull `git@github.com:drumee/<repo-name>.git`, run `npm i` if `package.json` exists, rsync files to the build dir
- `get_version <base>` / `get_email <base>` — parse from `debian/changelog`
- `check_version` / `check_email` — interactive prompts to confirm or change version/email, update `debian/control`
- `copyToTarget <path>` — copy `<path>_all.deb` to `$DEB_BUILD_TARGET` if set

Set `REPO_BASE` to override the GitHub base URL used by `bundle()` (e.g., for a local mirror).

## Package Map

| Directory | Package name | Source repo(s) cloned | Key deps |
|---|---|---|---|
| `infra/` | `drumee-infra` | `setup-infra` (main), `acme.sh` | nginx, nodejs, npm, git, openssh-client |
| `schemas/` | `drumee-schemas` | `setup-schemas` (main), `schemas` (**preview** branch) | mariadb-server |
| `server/` | `drumee-server-pod` | `server-team` (previev branch), `schemas-utils` | nginx, redis, graphicsmagick, ffmpeg, libreoffice |
| `ui/` | `drumee-ui-pod` | `ui-team` (preview branch) | webpack (runs during build) |
| `static/` | `drumee-static` | `static` (main) | — |
| `mfs/` | `drumee-mfs` | `schemas` (feature/v2.4) | — |
| `schemas-patch/` | `drumee-patch` | `schemas` (revamp) | @drumee/server-essentials |
| `admin/` | — | — | admin scripts only |
| `conference/` | — | — | skeleton, unused |

## Version Management

The authoritative version for each package lives in the first line of `<package>/debian/changelog`:
```
drumee-infra (1.2.11) unstable; urgency=medium
```

To bump a version, edit that first line in the `changelog` (following the standard Debian changelog format) before running the build script. The build scripts also update `Standards-Version` in `debian/control` to match.

## Post-Install Behavior

- **infra**: runs `/var/lib/drumee/setup-infra/bin/install`
- **schemas**: runs `/var/lib/drumee/setup-schemas/bin/install`
- **server-pod**: sources `/etc/drumee/drumee.sh`, applies any pending patches from `/var/lib/drumee/postinstall/patch.sh`

## schemas-patch

`schemas-patch/build.sh` takes an optional depth argument (default `2`) that controls how many git commits are diffed to generate the patch manifest:
```bash
schemas-patch/build.sh 3   # diff last 3 commits
```
The patch manifest at `src/schemas/patches/manifest.txt` must exist or the build exits with "No change to build patch".
