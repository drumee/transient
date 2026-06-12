# Drumee Debian Packages

Debian packaging infrastructure for the [Drumee](https://drumee.com) sovereign data platform. Each subdirectory builds a `.deb` package from source.

## Self-hosting

- [Quickstart](docs/quickstart.md) — get Drumee running in ~10 minutes (both channels)
- [Configuration](config/README.md) — `drumee.yaml` single source of truth → `.env` / compose / debconf preseed
- [Container channel](deploy/docker/README.md) · [Native channel](docs/native-channel.md) · [Lifecycle](docs/lifecycle.md) · [Security](docs/security.md)
- [Production](docs/production.md) — publish images, real domain + TLS, SMTP, day-2 ops
- [Roadmap](ROADMAP.md) — path to a SOTA, easy-to-self-host product

## Documentation

- [Overview](docs/overview.md) — package map, runtime layout, install order
- [Database schema & init](docs/schema-init.md) — how Drumee uses MariaDB + container init gaps
- [infra-init design](docs/infra-init.md) — setup-infra renderer analysis → Jitsi/mail/DNS parity plan
- [Reproducible builds](docs/reproducible-builds.md) · [Release engineering](docs/release.md)
- [Build Pipeline](docs/build-pipeline.md) — how to build, flags, GPG signing
- [Shared Utilities](docs/utilities.md) — `functions.sh` and `env.sh` reference
- [Version Management](docs/version-management.md) — changelog lifecycle, `update-changelog.sh`
- [Deployment](docs/deployment.md) — production update workflow, `drumee` CLI

**Per-package:**
[infra](docs/package-infra.md) · [schemas](docs/package-schemas.md) · [server](docs/package-server.md) · [ui](docs/package-ui.md) · [static](docs/package-static.md) · [schemas-patch](docs/package-schemas-patch.md) · [builder](docs/package-builder.md)

## Quick Start

```bash
# Build all main packages
./build-all.sh

# Build a single package
server/build.sh --force=yes

# Build a schema patch
schemas-patch/build.sh --manifest=auto
```

**Never run build scripts as root.**
