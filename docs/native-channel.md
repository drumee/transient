# Native Debian channel

For dedicated Debian/Ubuntu hosts (advanced / IaC). Installs Drumee directly onto
the host via `apt`, configured from a debconf preseed for unattended runs.

## For end users

```bash
# Interactive
curl -fsSL https://get.drumee.io/native | sudo bash

# Unattended — preseed answers rendered from drumee.yaml first
node config/render.mjs debconf --out install.conf
sudo PRESEED=install.conf bash scripts/install-native.sh
```

`apt install drumee` pulls the `drumee` metapackage (`meta/`), which depends on
`drumee-infra`, `drumee-schemas`, `drumee-static`, `drumee-server-pod`,
`drumee-ui-pod`.

## For maintainers — publishing the repo

```bash
./build-all.sh                       # build the component .debs
meta/build.sh                        # build the drumee metapackage
scripts/publish-apt.sh --debs=./out-debs --out=./apt-repo --suite=stable --key=somanos.sar@drumee.com
# serve ./apt-repo at https://apt.drumee.io
```

`publish-apt.sh` builds a signed flat repo (`apt-ftparchive` + `gpg`), emits
`InRelease`/`Release.gpg`, and exports the public key as
`drumee-archive-keyring.asc`.

## Needs your infrastructure

- **Repo hosting** — somewhere to serve `apt-repo/` (object storage + CDN, or a
  static host) at a stable URL (`apt.drumee.io`).
- **Signing key** — a project (not personal) GPG key in the publishing
  environment; CI publishes with it (Phase 5).

## Known TODO — install ordering

`apt` resolves the metapackage's `Depends` but does not guarantee *configuration*
order beyond dependency edges. The components have implicit ordering
(`infra → schemas → static → server → ui`). To make ordering robust, add explicit
inter-package `Depends`/`Pre-Depends` (e.g. `drumee-schemas` Depends `drumee-infra`)
in each component's `debian/control`. Tracked as a follow-up; today the documented
manual order (see [deployment.md](deployment.md)) and the metapackage cover most cases.
