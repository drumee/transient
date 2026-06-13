# Database schema & initialization (from the `schemas` repo)

> **Status: full stack serves end-to-end (validated on WSL, local source).**
> `mariadb → schemas-init → ui-build → schemas-populate → server-pod → Caddy` returns the
> real Drumee page (`GET / → 200`, `GET /-/svc/* → 401`). Getting there required, beyond the
> DB init below: pm2 `exec_mode: fork` (the apps parse `process.argv`), conf.d provisioning in
> the server entrypoint, the credential dir at `/etc/drumee/credential`, and Redis defaulting
> to no-auth (the app has a secondary Redis client that doesn't authenticate — internal
> network, so no-auth is the safe default until that's fixed upstream).


Analysis of `github.com/drumee/schemas` (branch `preview`) and what the self-host
solution still needs to initialize a database correctly. This is the deepest
remaining gap — both channels can start `server-pod`, but it won't serve until the
databases exist and are seeded.

## How Drumee uses the database

It is **not** a single application database. The `schemas` repo defines **8 DB
classes** (`bin/patch.js`, CLAUDE.md):

| Class | Role |
|---|---|
| `yellow_page` (`yp`) | Main system DB: auth, directory, admin, OAuth, contacts |
| `utils` | Shared utility functions / UDFs |
| `mailserver` | Email backend |
| `common` | Procedures shared into every hub/drumate DB (MFS, channels) |
| `hub` | **Template** for a workspace DB |
| `drumate` | **Template** for a per-user DB |
| `licence`, `costums` | Licensing; customer overrides |

**Databases are created at runtime.** `yellow_page/procedures/entity/create.sql`
executes `CREATE DATABASE \`<name>\`` for every new hub/drumate, then the server
loads the `hub`/`drumate` template into it. So the connected DB user must hold
**global `CREATE DATABASE`** + access to all those DBs — not rights on one schema.

**Connection** (`server-essentials/lib/configs.js` + `mariadb.js`): reads
`/etc/drumee/credential/db.json`. If it has `host/port/user/password` it connects
over **TCP**; otherwise it falls back to a **unix socket**
(`/var/run/mysqld/mysqld.sock`). So a networked `mariadb` container is viable —
but the schema tooling (`bin/patch.js`, `bin/build-seeds`) assumes the **local
socket + OS-user auth**, so it must be adapted for TCP in a container.

## The seed source (resolves Phase 0.6)

The canonical, **data-free** schema lives in the repo:

- `templates/factory/seed/{yp,utils,mailserver,trash}.sql` — base system DBs
- `templates/factory/{hub,drumate}.sql` — per-instance templates
- `bin/build-seeds` — runs `mariabackup --backup/--prepare` into a seeds dir
  (confirms the seed is a **physical backup**, exactly what `schemas/build.sh`
  consumes as `seeds.tgz`).

So a minimal bootstrap seed needs **no proprietary data**: spin MariaDB → apply the
factory SQL → `bin/build-seeds`. `schemas/make-seed.sh` should call the repo's
`bin/build-seeds` (or apply these factory files) instead of asking for an unknown
`--schema-sql`. The "canonical schema DDL source" decision is therefore answered.

## What was built (and validated locally)

A real `schemas-init` — `deploy/docker/Dockerfile.schemas` + `deploy/docker/schemas-init.sh`,
built from the `schemas` repo (lean: `mariadb-client` + `templates/factory/` + the
init script; it does **not** run the Node patch engine, which assumes a local socket).
Idempotent, run-once. Against a real `mariadb` over TCP as root it:

1. creates the base DBs `yp`, `utils`, `mailserver`, `template`, `trash`;
2. loads the data-free factory seed into each;
3. upserts the `dom_id=1` domain row to the configured domain;
4. creates the app user with `GRANT ALL … WITH GRANT OPTION` (needed for runtime
   `CREATE DATABASE`).

**Verified** (`drumee/schemas:local` against `mariadb:11`): `yp` = **130 tables +
645 routines**, all 5 DBs present, `domain(1)` = the configured domain, `drumee-app`
connects over TCP and **can `CREATE DATABASE`** (runtime hub provisioning). This
resolves the two blockers: the missing init image, and the wrong scoped-user/single-DB
model (compose now uses a known `MARIADB_ROOT_PASSWORD` and drops `MARIADB_USER`/`DATABASE`).

## Bug found in the `schemas` repo

**`bin/make-templates` corrupts triggers.** Line 95 (`sed s/DEFINER=(.+)//`) is greedy
and strips the `TRIGGER <name>` together with the definer, so all 3 triggers in
`seed/yp.sql` are malformed (`/*!50003 CREATE*/ /*!50017 ` then `AFTER INSERT`). A
direct replay aborts there. `schemas-init` loads `yp` with `--force` (the 3
quota-maintenance triggers are skipped — non-fatal). **Upstream fix:** make that sed
match only routines (like line 94) or be non-greedy / `TRIGGER`-aware.

## The complete initialization chain (fully traced)

From `setup-schemas` (`bin/install` + `populate.js` + `lib/*`) and `server-team`
(`offline/factory/*`, `service/*`), the authoritative order to a serving instance is:

1. **Base DBs + schema** — create `yp`/`utils`/`mailserver`/`template`/`trash`, load the
   factory seed, grant the app user. *(schemas-init — built + validated.)*
2. **System config** — `Organization.populate()` runs 27 `REPLACE/INSERT` statements:
   `sys_conf` (guest_id, nobody_id, domain_name, mfs paths, wallpaper, quota), `domain`,
   `dmz_user` (guest), `organisation`, `settings`, `vhost` (ns1/ns2/jit/www/smtp/...),
   `mailserver`. *(Validated live — 27/27 applied.)*
3. **Stock the factory pool** — accounts can't be created until a pool exists.
   `drumate_create` calls `pickupEntity(type)` which draws from
   `entity WHERE area='pool' AND settings.pool_state='clean'`. The pool is filled by the
   **offline factory** (`offline/factory/schema.js create_entity`): `entity_create(type)` →
   load the per-type template into the new DB → create the MFS root (`mfs_create_node` +
   `home_dir/__storage__`) → set `pool_state='clean'`.
   - **Genesis subtlety:** the running factory builds its template by dumping an *existing
     active* entity (`make_template`: `SELECT … entity WHERE type=? AND status='active'`).
     On a fresh install none exist, so the **first** pool entities must be seeded from the
     `schemas` repo's `templates/factory/{hub,drumate}.sql` (the genesis templates). After
     that the factory self-maintains to a watermark (default 210 each).
4. **Accounts** — `createNobody` / `createGuest` / `createSystemUser` / `createAdmin` via
   `drumate_create` + `createHub` (each consumes pool entities). `createAdmin` also issues a
   password-reset link.
5. **RSA keypair** — `subtleCrypto.generateKeysPair()` → `/etc/drumee/credential/crypto/{public,private}.pem`.
6. **(Optional)** wallpapers/tutorials import (network), welcome email.

`EMPTY_FACTORY` (seen in testing) = step 3 was skipped — the pool is empty.

### Container adaptations the offline factory needs

`offline/factory/schema.js` is bare-metal-oriented; in a container:
- it loads templates with the `mariadb` CLI (`Constants.DB_CLI`) → the init image needs
  `mariadb-client`;
- `create_vfs_root()` does `new Mariadb({ user: process.env.USER })` and `chown` → run with
  `USER` unset (so it uses the `db.json` app user over TCP) and `system_user` reachable;
- MFS roots are created on disk under `data_dir` → that volume must be writable.

### Status: full chain VALIDATED end-to-end

`deploy/docker/container-populate.js` implements steps 2–5 and was validated live against
real `mariadb` + `redis` (seeded by `schemas-init`):

```
stockFactory   3 drumate + 3 hub pool entities seeded from genesis templates  ✓
createNobody / createGuest / createSystemUser   all succeeded                 ✓
yp.drumate     nobody, guest, system (category=system)                        ✓
RSA keypair    /etc/drumee/credential/crypto/public.pem (450 bytes)           ✓
EMPTY_FACTORY  resolved
```

Two container adaptations were required and are encoded:
- run the populate image with `USER=drumee-app` (so `create_vfs_root`'s `new Mariadb({user})`
  uses the app creds over TCP) and as uid root (so MFS `chown` works);
- provide a `~/.my.cnf` `[client]` pointing at the `mariadb` service so the factory's
  `mariadb <db> < template.sql` (which takes no connection args) connects over TCP instead
  of the absent local socket. The container entrypoint writes this from `db.json`.

## Schema upgrades (containers)

`schemas-init` is also the **upgrade path**: the image ships the schema class dirs
plus `patches/manifest.txt`, and on every run it compares the manifest's hash with
`yp.__container_meta('patch_hash')` (a dedicated bookkeeping table — kept out of app-owned `sys_conf`):

- **fresh install** — factory seed is already current → record the level, apply nothing
- **unchanged manifest** — no-op
- **changed manifest** (new image version) — apply each entry to its class targets
  (`yellow_page`→`yp`, `hub`/`drumate`/`common`→discovered entity DBs incl. the pool,
  `utils`/`mailserver` direct), `--force` like upstream's `--ignore-error`, then
  re-record the hash

So `drumee-ctl upgrade` (compose pull + up) automatically brings the schema along
with the code. Validated: fresh/no-op/apply/re-no-op all exercised against a live
MariaDB (marker procedure applied and callable).

## Remaining gaps (setup-schemas parity)

`schemas-init` covers the **DB + schema + grant** phase. These are still done only by
`setup-schemas/bin/install` (not in any local repo) and are not yet replicated:

| Gap | Impact |
|---|---|
| **System accounts** (`nobody`/`guest`/`system`) | Confirmed absent from the factory seed, schema procedures, and server services. Runtime paths (guest sessions, system-owned content, MFS `nobody` checks) need them. |
| **RSA keypair** (`/etc/drumee/credential/crypto`) | `bootstrap.js publicKey` serves it; auth/token features need it. |
| **Wallpapers / tutorials / welcome email** | Onboarding / cosmetic. |
| ~~**Quota triggers**~~ | Resolved: the patch step recreates them from `yellow_page/triggers/` on fresh installs and upgrades. |
| **`--conf-path` (`etc/drumee/conf.d`)** | Server needs it (separate from the DB); produced by the infra package. |

Next step to a fully-serving instance: replicate the system-account + RSA-key bootstrap
(port the relevant `setup-schemas` steps, or call `drumate_create` with the system
idents), and provide `conf.d`. The database itself is now correctly initialized.
