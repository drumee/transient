# Native Debian channel

For dedicated Debian/Ubuntu hosts (advanced / IaC). Installs Drumee directly onto
the host via `apt`, configured from a debconf preseed for unattended runs.

## For end users

```bash
# Interactive
curl -fsSL https://apt.drumee.net/install-native.sh | sudo bash

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
static/build.sh                      # build drumee-static (REPO_BASE=https://github.com/drumee)
meta/build.sh                        # build the drumee metapackage
scripts/publish-apt.sh --debs=./out-debs --out=/tmp/apt-flat --key=release@drumee.org
APT_LOCAL_DIR=/tmp/apt-flat scripts/deploy-apt-repo.sh --host=USER@VPS_HOST
```

`publish-apt.sh` builds a signed **flat** repo (`apt-ftparchive` + `gpg`), emits
`InRelease`/`Release.gpg`, and exports the public key as
`drumee-archive-keyring.asc`.

`deploy-apt-repo.sh` rsyncs that directory to the VPS document root
(`/var/www/apt.drumee.net` by default), writes an nginx vhost for the domain, and
reloads nginx. Override with `--repo-dir=` / `--domain=`. TLS is provisioned
separately (`certbot --nginx -d apt.drumee.net`); the script prints the follow-up
steps, including uncommenting the port-80 → 443 redirect once the cert exists.

The packages are **self-hosted on `apt.drumee.net`** — the `drumee-static` deb alone
is ~175 MB, over GitHub's 100 MB git-file limit, so they cannot live in a Pages git
repo. Clients use a flat repo:

```
deb [signed-by=/etc/apt/keyrings/drumee.asc] https://apt.drumee.net/ ./
```

The signing key is served from the same host at
`https://apt.drumee.net/drumee-archive-keyring.asc`.

## Needs your infrastructure

- **VPS + DNS + TLS** — an `A`/`AAAA` record for `apt.drumee.net` pointing at the
  nginx host, and a certbot cert for it.
- **Signing key** — a project (not personal) GPG key in the publishing
  environment; CI publishes with it (Phase 5). The repo currently published is
  signed with a local build key and must be re-signed before launch.
- **CI publishing path** — `scripts/publish-site.sh` (used by
  `.github/workflows/release.yml`) still uploads the flat repo to the `apt-stable`
  GitHub Release. Migrating it to `apt.drumee.net` needs an SSH deploy key and host
  as repository secrets.

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
