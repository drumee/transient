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

## Install ordering (resolved)

`apt` configures a package only after the packages it `Depends` on, so the
components now encode the required order (`infra → schemas → static → server → ui`)
with explicit inter-package dependencies in each `debian/control`:

| Package | Depends (ordering) |
|---|---|
| `drumee-infra` | — (base) |
| `drumee-schemas` | `drumee-infra` |
| `drumee-static` | `drumee-infra` |
| `drumee-server-pod` | `drumee-schemas`, `drumee-static` |
| `drumee-ui-pod` | `drumee-server-pod` |

So `apt install drumee` (or installing the components in any order) configures
them in dependency order without relying on the command-line order.

## Still blocked for a real build/validation here

Building the `.deb`s and validating the install end-to-end needs inputs not
present in this checkout (they live in the Drumee build environment):

| Input | Needed by | Status |
|---|---|---|
| Private `@drumee` npm auth (or pre-installed `node_modules`) | every component (`bundle()` runs `npm i`) | only `infra`/`server`/`ui`/`schemas` checkouts have `node_modules`; `setup-schemas` does not |
| **Seeds archive** (`seeds.tgz`, a `mariabackup` physical backup) | `drumee-schemas` build | absent |
| **`static` source repo** | `drumee-static` build | absent |
| A **project GPG key** | signed `.deb`s + APT `Release` | absent (build unsigned with `-us -uc` for testing) |
| A disposable **Debian VM/systemd container** | running the host-reconfiguring postinst | required for true validation |
