# Native postinst audit — does `apt install drumee` reach a serving state?

Audit of the native install path (`setup-infra/bin/install`, `setup-schemas/bin/install`,
the `.deb` maintainer scripts) against the runtime contract we reverse-engineered for
the container channel. **No build/VM was run** — this is a source audit; items marked
*verify on VM* need a real Debian host to confirm.

## Headline

The native installer already produces **most** of the runtime contract — unsurprising,
since the container entrypoints were reverse-engineered *from* it. The process model is
also fully wired (systemd → init.d → pm2). The blockers are a **missing debconf→env
bridge on the metapackage path** and a **factory-pool/seed assumption**, plus the
expected need for a real host to validate.

## Already handled by the native install (✅)

| Contract item | Where | Note |
|---|---|---|
| `credential/db.json` | `infra.js:617` | `{host,user,password}`, password generated; socket auto-detected |
| `credential/email.json` | `infra.js:623` | **nested `auth:{user,pass}`** (matches the shape our container needed) |
| `credential/redis.json` | `redis.json.tpl` | see Redis risk below |
| `credential/crypto/*.pem` (RSA) | `setup-schemas populate.js:71` | `generateKeysPair()` after DB populate |
| `conf.d/{drumee,myDrumee,exchange,conference}.json` | `infra.js:539` | the `--conf-path` content we had to hand-write in containers |
| `drumee.sh` / `drumee.json` | `infra.js:454`, `drumee.sh.tpl` | env + config |
| nginx routing | `routes/main.conf.tpl:50` | `/-/svc`→24000, ws→23000, static `/-/app` `/-/api` `/-/plugins` aliased |
| system accounts (nobody/guest/system/admin) | `organization.js:191-391` | via `drumate_create` in `populate.js` |
| **process start** | `server/etc/init.d/drumee` + `drumee-server-pod.service` | systemd unit (`dh_installsystemd`) → `/etc/init.d/drumee start` → `pm2 start ecosystem.config.js` (index.js + service.js + factory). **Starts on install and on boot.** |
| schema **triggers** | `setup-schemas/bin/install:44` | restored via `mariabackup --copy-back` (**physical** restore) — so it **avoids** the `bin/make-templates` greedy-sed trigger corruption that bit our SQL-dump container path. ✅ |

## Real gaps / risks (native-specific, actionable)

### 1. debconf → env bridge missing on the metapackage path (HIGH) — ✅ FIXED

> **Fixed:** `drumee-infra` now ships `debian/templates` (registers the
> `drumee-infra/*` questions), `debian/config` (prompts; preseed answers used
> as-is), and a `debian/postinst` that `db_get`s every answer and `export`s the
> matching `DRUMEE_*` var (same mapping as the bootstrap wizard) before running
> `setup-infra/bin/install` — and aborts with a clear message if the domain is
> empty instead of silently failing. Guarded by `tests/native/control-deps.sh`.
> Still needs a Debian VM to confirm the end-to-end install. Original analysis:

`infra.js` reads the domain/admin/paths from **environment variables**
(`process.env.DRUMEE_DOMAIN_NAME`, …; `infra.js:25-42`). With no domain it
**silently `exit(0)`s** (`infra.js:349`) → `drumee.sh` is never written → `bin/install`
prints "Setup has failed" and aborts.

- The **`drumee-bootstrap` wizard** bridges this correctly: `builder/.../menu/install.sh`
  does `. confmodule` → `db_get drumee-infra/domain` → `echo export DRUMEE_DOMAIN_NAME=… >> env`.
- The **metapackage path does not**: `infra/debian/postinst` just calls
  `setup-infra/bin/install` with **no `db_get` / no `export`**. So `apt install drumee`
  with a preseed (what `scripts/install-native.sh` + `render.mjs debconf` target) runs
  `infra.js` with empty env → silent failure.

**Fix:** have `infra/debian/postinst` read the `drumee-infra/*` debconf answers and
export them as `DRUMEE_*` before calling `bin/install` (mirror `builder/install.sh`), or
unify the metapackage path onto the bootstrap wizard. *This is the #1 thing blocking a
working `apt install drumee` + preseed.* *(verify on VM)*

### 2. Factory pool depends on the seed (MEDIUM)
`populate.js` creates accounts but does **not** pre-stock the hub/drumate entity pool
from genesis templates (the container channel had to). On native the pool comes from the
`mariabackup` **seed** (`seeds.tgz`). If that seed wasn't built from a system with a
stocked pool, the first hub/drumate creation hits **`EMPTY_FACTORY`**. Wallpaper/tutorial
import additionally needs network (`content.drumee.com`, `drumee.com`) and silently skips
if unreachable. **Verify the seed ships a stocked pool, or add genesis stocking.** *(verify on VM)*

### 3. Redis auth posture undefined (LOW)
No password is generated for Redis; `redis.json`'s `redisAuth` is effectively empty →
**no-auth** (matches our container finding). Fine if Redis binds to localhost/the data
network; confirm it isn't exposed. *(verify on VM)*

### 4. Needs a real host (validation-only, not a code gap)
`service mariadb start/stop`, `prosody`/`prosodyctl`, `crontab`, the `www-data` user, and
`mariadb_config --socket` detection all assume a real Debian host with systemd. A plain
(non-systemd) container can't validate the install end-to-end — a disposable **Debian 12
VM** is required.

## Observation (not a gap)

The native pm2 ecosystem runs **`index.js` in fork mode (1 instance)** but
**`service.js` in `cluster_mode` (2–4 instances)** (`infra.js:198-223`). Our *container*
ran both in fork because `cluster_mode` broke the apps' `process.argv` parsing under
`pm2-runtime`. Native's cluster config is the canonical production setup; the divergence
only matters if someone reuses the native ecosystem inside a `pm2-runtime` container.

## Bottom line

Native is closer than it looks: credentials, conf.d, nginx, accounts, RSA, and process
start are all wired, and it dodges the trigger-corruption bug. To get `apt install drumee`
to actually serve, fix the **debconf→env bridge (#1)** and confirm the **seed's factory
pool (#2)**, then validate on a Debian VM. The packaging/ordering is already correct and
tested (`tests/native/control-deps.sh`).
