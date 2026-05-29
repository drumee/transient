# Package: drumee-infra

**Directory:** `infra/`
**Debian package:** `drumee-infra`
**Current version:** 1.2.11

## Purpose

The foundation package. Must be installed first on any Drumee server. Provides:

- nginx configuration and virtual host templates
- SSL certificate management via acme.sh
- Cron jobs (tmp file cleanup, certificate renewal)
- Shared shell utilities under `/var/lib/drumee/utils/`
- openssh-client for the server's outbound SSH operations

## Source Repos

| Repo | Branch | Destination |
|---|---|---|
| `setup-infra` | main | `/var/lib/drumee/setup-infra/` |
| `acme.sh` (GitHub: acmesh-official) | master | `/etc/acme/` |

The `acme.sh` clone uses `bundle_acme`, which hits `https://github.com/acmesh-official/acme.sh` directly — not the Drumee GitHub org.

## Build

```bash
infra/build.sh [--version=X.Y.Z] [--force=yes] [--email=user@example.com]
```

No special prerequisites beyond SSH access to `git@github.com:drumee/setup-infra`.

## Installed Paths

```
/usr/                    # from setup-infra's usr/ tree
/etc/                    # nginx config, acme.sh config
/var/lib/drumee/
├── setup-infra/         # install scripts
└── utils/               # shared shell utilities
/etc/acme/               # acme.sh SSL tool
```

## Dependencies

```
binutils, apt-utils, git, nodejs, npm, nginx, cron,
libncurses6, g++, gyp, openssh-client, libcurl4
```

## Post-Install

Runs `/var/lib/drumee/setup-infra/bin/install`, which configures nginx, sets up cron entries, and initialises directory structure.
