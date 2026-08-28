# Self-Hosting Map

`sources/debian` is `DEPLOYMENT`. Its README defines container and native Debian channels rendered from one YAML configuration.

The build maps `server-team` to `drumee-server-pod`, `ui-team` to `drumee-ui-pod`, `setup-schemas + schemas` to `drumee-schemas`, and also produces static, infra, schema-patch, bootstrap and meta packages (`sources/debian/README.md`, component `build.sh` and `debian/control`). `release-manifest.yaml` and changelogs carry release versions.

Dockerfiles under `deploy/docker/**` build schemas, population, UI, server, static and infra. Rendered Compose orders MariaDB/Redis before schema init, UI build, population, server/factory, with Caddy routing (`config/render.mjs`). `scripts/build-images-local.sh` consumes sibling source contexts; `dev-up.sh` renders `.env`, Compose, install config and Caddyfile.

The native channel builds `.deb` files; the meta package selects dependencies. Maintainer scripts/systemd/PM2 assets install and configure runtime. Schema patches have a separate package/manifest path (`schemas-patch/**`). Runtime assumes `/etc/drumee`, MariaDB privileges sufficient to create tenant databases, Redis, fixed runtime/data paths and shared MFS storage (`sources/server-essentials/lib/sysEnv.js`).

`bin/drumee-ctl` detects Compose/native and performs status, doctor, backup/restore, upgrade/rollback and plugin delegation. `bin/drumee-plugin` installs server plugin source, manages `.disabled`, and restarts. This is separate from `sources/cli`; npm CLI packaging/integration is not proven and is `INVESTIGATE`.

Future deployment needs versioned runtime artifacts, a distribution manifest, module descriptors/artifacts, schema migrations and integrity/compatibility metadata. It must preserve configuration, secrets, MFS mounts, schema init, factory, backup/restore and both channels. No format redesign is approved.

Required compatibility checks: fresh install, initial admin/hub creation, restart, backup/restore, upgrade/rollback, plugin persistence, schema patching and migration of supported existing installations on both channels.
