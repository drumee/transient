# Reproducible Builds (toward outsider self-host)

For a self-host product, anyone must be able to build/install without insider
access. Two things currently gate that: **private source** and the **seed
archive**. This documents the strategy and the decisions still owned by the team.

## 1. Source access

`bundle()` clones each component from `git@github.com:drumee/<repo>`. Outsiders
can't reach these. `bundle()` already supports redirection via `REPO_BASE`:

```bash
# Build from a public mirror or a local clone cache instead of private GitHub
export REPO_BASE=https://github.com/your-org      # public HTTPS mirror
export REPO_BASE=/path/to/local/mirror            # local bare-repo mirror
./build-all.sh
```

**Team decision required (pick one):**

- **Publish the component repos** (or read-only mirrors) so `REPO_BASE` points at
  public HTTPS. Simplest for outsiders; this is what most self-host projects do.
- **Ship release source tarballs** per version and have `bundle()` consume a
  tarball when `REPO_BASE` is a `file://`/`https://` archive base. Keeps repos
  private while making releases buildable.
- **Container-only public path**: outsiders never build; they pull published
  images (Phase 2). Source stays private; native channel remains insider-only.

The container channel (Phase 2) is the recommended public path either way: most
users should `docker compose up`, not compile.

## 2. The seed archive

`drumee-schemas` restores MariaDB from a `mariabackup` **physical backup**
(`var/tmp/drumee/seeds.tgz`), not a SQL dump. The full production seed contains
proprietary data and is git-ignored (`schemas/seeds/`). A fresh install needs no
proprietary data — only the data-free schema plus a **stocked entity pool** — so
we generate the seed from source.

### Options (in order of preference for outsiders)

1. **Build from source** with `scripts/build-seed.sh` — the recommended default.
   Spins up a throwaway MariaDB in Docker, loads the base databases from the
   `schemas` repo's `templates/factory/`, **stocks the entity pool** via
   `server-team`'s `offline/factory`, and `mariabackup`s the result:
   ```bash
   scripts/build-seed.sh                       # -> schemas/var/tmp/drumee/seeds.tgz
   scripts/build-seed.sh --out=/path/seeds.tgz
   ```
   `schemas/build.sh` calls this automatically when no seed and no `SEEDS_DIR`
   are present. See **"Building the seed from source"** below for the mechanics
   and requirements.
2. **Prebuilt seed artifact** — the team publishes a versioned `seeds.tgz`
   alongside each release; `schemas/build.sh` consumes it like any seed.
   *(Requires a CI step to produce and publish it — a natural wrapper around
   option 1.)*
3. **Insider path** — set `SEEDS_DIR` to a directory holding a real seed; the
   build tars it. Stays for internal use.
4. **No-Docker fallback** — `schemas/make-seed.sh --schema-sql=DDL.sql` builds a
   *minimal* seed (data-free schema, **empty** pool) with a local `mariadb-server`
   + `mariadb-backup`. Note: an empty pool trips the `EMPTY_FACTORY` guard in
   `drumee-schemas` postinst (see gap #2 in **docs/native-audit.md**) unless the
   target re-stocks it — prefer option 1.

### Building the seed from source

`scripts/build-seed.sh` + `scripts/Dockerfile.seed` +
`scripts/seed-entrypoint.sh` reproduce, offline and in one throwaway
container, exactly what a freshly-populated reference system contains. The flow:

1. **Local MariaDB** — the container starts its own `mariadbd` on loopback and a
   local `redis-server` (the populate step's `Cache.load()` needs it).
2. **Base databases** — reuses `deploy/docker/schemas-init.sh` to create
   `yp/utils/mailserver/template/trash` from `templates/factory/seed/*.sql`, set
   `domain` id=1, create the app user, and apply `patches/manifest.txt` (which
   heals the trigger headers `make-templates` corrupts in the dump).
3. **Populate + stock pool** — reuses `deploy/docker/container-populate.js`, which
   drives `server-team/offline/factory/schema.js` (`entity_create` + load
   `templates/factory/{hub,drumate}.sql` + MFS root) to stock the pool to
   `POOL_COUNT` (default 10) per type, then creates the nobody/guest/system
   accounts. `CREATE_ADMIN` is intentionally unset — the native install's
   `populate.js` creates the domain-specific admin + RSA keys at install time.
4. **Backup** — `mariabackup --backup && --prepare` (mirrors the `schemas` repo's
   `bin/build-seeds`), tar'd top-level so `setup-schemas/bin/install` restores it
   via `tar --one-top-level=seeds` + `mariabackup --copy-back --target-dir=.../seeds`.

The resulting seed ships a **non-empty pool**, so the postinst `EMPTY_FACTORY`
guard passes on first install.

**Requirements & knobs.** Needs Docker (buildx) and local source checkouts. Source
trees are bind-mounted read-only and their existing `node_modules` are reused, so
no private `@drumee` registry access or in-container `npm install` is needed:

| Env | Default | Purpose |
|---|---|---|
| `SERVER_SRC` | sibling `../server-team` | `offline/factory` + `@drumee` node_modules |
| `SETUP_SCHEMAS_SRC` | `schemas/src/setup-schemas` | `lib/organization` + node_modules |
| `SCHEMAS_SRC` | `schemas/src/schemas` | `templates/factory` + schema/patch corpus |
| `POOL_COUNT` | `10` | pool entities per type (drumate, hub) |
| `DRUMEE_DOMAIN_NAME` | `localhost` | domain row written by populate |
| `TAG` | `local` | `drumee/seed:<TAG>` image tag |

Two environment gotchas the script already handles: `mariadb-install-db`
pre-creates `root@'127.0.0.1'`/`root@'::1'` with empty passwords (so the password
is set on all loopback root accounts), and the pool's ~20 entity DBs blow past the
container's default 1024 open-file limit during backup (raised via
`docker run --ulimit nofile=1048576:1048576`).

### Schema source — RESOLVED

The canonical schema is data-free and lives in the `schemas` repo under
`templates/factory/` (`seed/{yp,utils,mailserver,trash}.sql` + `{hub,drumate}.sql`).
`scripts/build-seed.sh` (above) wires this into the `schemas-init` +
`container-populate` flow. See **docs/schema-init.md** for the full schema model
and the container gaps it exposes (DB privileges, multi-DB model, socket-vs-TCP).

## Status

- [x] `REPO_BASE` redirection documented (already supported by `bundle()`).
- [x] Actionable failure in `schemas/build.sh` when no seed is present.
- [x] `scripts/build-seed.sh` builds a full seed (data-free schema + stocked pool)
  from source in Docker; `schemas/build.sh` auto-invokes it.
- [x] `schemas/make-seed.sh` no-Docker fallback with real `mariabackup` mechanics.
- [ ] Team decision: public source strategy (mirror / tarball / container-only).
- [ ] CI step to publish a versioned `seeds.tgz` (wrap `scripts/build-seed.sh`).
