# Drumee Debian Packages

Debian packaging infrastructure for the [Drumee](https://drumee.com) sovereign data platform. Each subdirectory builds a `.deb` package from source.

## Documentation

- [Overview](docs/overview.md) — package map, runtime layout, install order
- [Build Pipeline](docs/build-pipeline.md) — how to build, flags, GPG signing
- [Shared Utilities](docs/utilities.md) — `functions.sh` and `env.sh` reference
- [Version Management](docs/version-management.md) — changelog lifecycle, `update-changelog.sh`
- [Deployment](docs/deployment.md) — production update workflow, `drumee` CLI

**Per-package:**
[infra](docs/package-infra.md) · [schemas](docs/package-schemas.md) · [server](docs/package-server.md) · [ui](docs/package-ui.md) · [static](docs/package-static.md) · [schemas-patch](docs/package-schemas-patch.md)

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
