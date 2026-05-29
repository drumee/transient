# Package: drumee-schemas

**Directory:** `schemas/`
**Debian package:** `drumee-schemas`
**Current version:** 2.6.7

## Purpose

Installs the MariaDB database schema definitions and seed data that the Drumee server requires. The `postinst` script runs the installer which creates all databases, tables, stored procedures, and initial data rows.

## Source Repos

| Repo | Branch | Destination |
|---|---|---|
| `setup-schemas` | main | `/var/lib/drumee/setup-schemas/` |
| `schemas` | preview | `/var/lib/drumee/schemas/` |

## Build Prerequisites

**Seeds archive required.** The build looks for a seeds archive in this order:

1. `schemas/var/tmp/drumee/seeds.tgz` — pre-existing archive in the repo
2. `$SEEDS_DIR/` directory (default: `$HOME/docker/data/seeds/`) — built from live seed data

If neither exists, the build exits with an error. Seeds are the initial database rows needed to bootstrap a working Drumee instance.

### Creating seeds.tgz from a live instance

```bash
SEEDS_DIR=/path/to/seeds/dir schemas/build.sh
```

The build script packs `$SEEDS_DIR` into `seeds.tgz` automatically if the pre-existing archive is absent.

## schemas/seeds/ Directory

Contains 828+ pre-seeded data directories with UUID-based names (e.g. `0_00172d6400172d65`). These are packaged directly into the `.deb` and extracted to `/var/lib/drumee/seeds/` on install. They represent the initial workspace and user data for a fresh Drumee deployment.

## schemas/Dockerfile

Provides a self-contained build environment with MariaDB, Node.js, and Debian build tools. Useful for building the schemas package in a clean environment without a local MariaDB installation.

```bash
cd schemas
docker build -f Dockerfile -t drumee/schemas-builder .
docker run --rm -v $(pwd):/build drumee/schemas-builder
```

## Build

```bash
schemas/build.sh [--version=X.Y.Z] [--force=yes] [--email=user@example.com]
```

## Installed Paths

```
/var/lib/drumee/
├── setup-schemas/       # install scripts and schema SQL files
├── schemas/             # schema source (preview branch)
└── seeds/               # initial seed data directories
/var/tmp/drumee/
└── seeds.tgz            # packed seeds archive
```

## Dependencies

```
binutils, nodejs, mariadb-server, mariadb-client
```

## Post-Install

Runs `/var/lib/drumee/setup-schemas/bin/install`, which:
- Starts MariaDB if not running
- Creates Drumee databases and users
- Applies all schema SQL files
- Loads seed data from `/var/lib/drumee/seeds/`
