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
proprietary data and is git-ignored (`schemas/seeds/`). A fresh install only needs
an **empty-but-valid** schema, so we generate a *minimal bootstrap seed*.

### Options (in order of preference for outsiders)

1. **Prebuilt minimal seed artifact** — the team publishes a versioned
   `seeds-minimal.tgz` alongside each release. `schemas/build.sh` consumes it like
   any seed. *(Recommended — requires a CI step to produce and publish it.)*
2. **Generate locally** with `schemas/make-seed.sh`:
   ```bash
   schemas/make-seed.sh --out=schemas/var/tmp/drumee/seeds.tgz --schema-sql=DDL.sql
   ```
   Requires `mariadb-server` + `mariadb-backup` locally. It spins up a throwaway
   MariaDB, applies the schema DDL, takes a `mariabackup`, and archives it.
3. **Insider path** — set `SEEDS_DIR` to a directory holding a real seed; the
   build tars it. This is the current default and stays for internal use.

### Schema source — RESOLVED

The canonical schema is data-free and lives in the `schemas` repo under
`templates/factory/` (`seed/{yp,utils,mailserver,trash}.sql` + `{hub,drumate}.sql`),
and the repo already provides `bin/build-seeds` (mariabackup). So a minimal seed
needs no proprietary data: create the base DBs from the factory SQL, then run
`bin/build-seeds`. The remaining work is wiring this into a `schemas-init` step —
see **docs/schema-init.md** for the full schema model and the container gaps it
exposes (DB privileges, multi-DB model, socket-vs-TCP).

## Status

- [x] `REPO_BASE` redirection documented (already supported by `bundle()`).
- [x] Actionable failure in `schemas/build.sh` when no seed is present.
- [x] `schemas/make-seed.sh` scaffold with real `mariabackup` mechanics + guards.
- [ ] Team decision: public source strategy (mirror / tarball / container-only).
- [ ] Team decision: canonical schema DDL source; then CI-published `seeds-minimal.tgz`.
