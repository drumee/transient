# Build Pipeline

## Prerequisites

- **No root**: all build scripts check `$UID` and abort if run as root.
- **Git SSH access** to `git@github.com:drumee/` — scripts clone private repos.
- **GPG key** matching the maintainer email in `debian/changelog` must be in the local keyring.
- **Node.js** required for packages that run `npm install` or webpack during the build.
- **Debian build tools**: `dh_make`, `dpkg-buildpackage`, `debhelper`.

## Building a Single Package

```bash
infra/build.sh
schemas/build.sh
server/build.sh
ui/build.sh
static/build.sh
mfs/build.sh
schemas-patch/build.sh --manifest=auto
```

Each script sources `utils/functions.sh`, clones or updates the upstream source repo, assembles a staging directory, then calls `dh_make` and `dpkg-buildpackage` to produce the `.deb`.

## Building All Main Packages

```bash
./build-all.sh
```

Runs `infra → schemas → ui → server` in sequence with `--force=yes`. Stops on the first failure (`set -e`).

## Common Flags

All build scripts accept these flags via `parse_args`:

| Flag | Default | Effect |
|---|---|---|
| `--version=X.Y.Z` | from `debian/changelog` | Override package version |
| `--force=yes` | prompt | Skip "rebuild existing source?" prompt |
| `--force=rebuild` | prompt | Force re-clone of source repos |
| `--email=user@example.com` | from `debian/changelog` | Override maintainer email for GPG signing |
| `--type=<type>` | varies per package | Select build variant (see per-package docs) |
| `--compile=yes` | no | Force webpack/npm compile step |
| `--enable-api` | no | Include API bundle in UI build |

## Environment Variables

| Variable | Effect |
|---|---|
| `DEB_BUILD_TARGET=/path` | After a successful build, `copyToTarget` copies the `.deb` there automatically |
| `SEEDS_DIR=/path` | Override seeds source for the schemas package (default: `$HOME/docker/data/seeds/`) |
| `REPO_BASE=git@...` | Override the GitHub base URL used by `bundle()` — useful for a local mirror |

## Build Output

Each build produces a `.deb` in the package directory (e.g. `server/drumee-server-pod_2.9.44_all.deb`). If `DEB_BUILD_TARGET` is set, `copyToTarget` moves it there after the build.

## GPG Signing

`dpkg-buildpackage` signs the package with the key matching the maintainer email from `debian/changelog`. Ensure the key is imported:

```bash
gpg --list-secret-keys somanos@drumee.org
```

To build without signing (testing only):

```bash
dpkg-buildpackage -us -uc
```

The `builder/` package always builds unsigned (`-us -uc`).

## Staged Source Directory

`bundle()` clones repos into a `src/` subdirectory of each package directory. On subsequent runs, it does `git pull` instead of a fresh clone. Use `--force=rebuild` to force a clean re-clone.

The source staging area is separate from the `debian/` packaging metadata, which lives in `<package>/debian/` (or `<package>/pod/debian/` for server and ui).

## The builder/ Package

`builder/` works differently from all other packages:

- It does **not** clone and compile upstream source.
- It reads pre-built artifacts from the `target/` directory in the repo root.
- It references `git@gitlab.drumee.in:drumee` (not `github.com`) via its own `builder/utils/functions.sh`.
- It builds unsigned (`dpkg-buildpackage -us -uc`).
- Its `postinst` calls `/var/lib/drumee/setup/menu/install.sh`.

Use `builder/build.sh pull` to fetch the `setup` repo from GitLab before packaging.

## Package Dependency Chain

```
drumee-infra
    └── drumee-schemas   (mariadb-server, mariadb-client)
    └── drumee-mfs       (depends: drumee-infra)
        └── drumee-static
        └── drumee-server-pod  (nginx, redis, ffmpeg, libreoffice, ...)
        └── drumee-ui-pod      (nodejs, git)
            └── drumee-patch   (mariadb-server, mariadb-client)
```

`drumee-conference` (skeleton) depends on `drumee-infra` plus Jitsi packages (`prosody`, `jitsi-meet`, `jitsi-videobridge2`, etc.).
