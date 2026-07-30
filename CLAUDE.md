# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## About This Project

`@drumee/server-core` is the foundational middleware library for Drumee backend services. It owns the HTTP request/response lifecycle, session management, authentication/authorization (ACL), the meta-filesystem (MFS), and media conversion. It is a **library only** — it has no server entry point of its own. Consuming services (`server-team`, `onboarding-server`, `stripe-server`, …) instantiate the pipeline and supply the business logic.

**`docs/ARCHITECTURE.md` is the authoritative deep reference** (525 lines): hub multi-tenancy, full request pipeline diagram, session states, bitwise ACL model, MFS node layout, generator format matrix, output envelope, exception→HTTP code table, dependency map. Read it before making non-trivial changes; keep it updated alongside code.

## Commands

```bash
npm install

npm test               # runs test:modules && test:acl && test:db sequentially
npm run test:modules   # instantiates Mariadb/Cache/redisStore/Logger/Offline from essentials
npm run test:acl       # STALE — see caveats below
npm run test:db        # SELECT 1 + SHOW TABLES against the `yp` database

npm run release        # git push → npm publish → npm version patch
```

### Test caveats (verify before trusting a failure)

The suites are smoke tests against a live environment, not a unit-test harness. There is no test runner, no lint, and no build step.

- All suites need a configured Drumee host: `/etc/drumee/drumee.sh` sourced, MariaDB reachable as `$USER`, and Redis up. `lib/test/db.js` and `lib/test/modules.js` connect to database `yp` with `user: process.env.USER`.
- `test:modules` is declared as `source /etc/drumee/drumee.sh node lib/test/modules.js` — `source` swallows the `node` argument, so the script never actually runs. Invoke `node lib/test/modules.js` directly after sourcing.
- `test:acl` calls `Acl.loadWorkers()` / `Acl.getWorker()` / `Acl.permission()`, which no longer exist on `lib/acl.js`, and points at `../server/service/acl` outside this repo. It fails by design until rewritten.
- `lib/test/convert.js` is a fully commented-out one-off migration script; it is not wired into `npm test`.

To exercise a change for real, run it from a consuming service (`server-team`) rather than from this repo.

## The self-dependency gotcha (read this first)

`package.json` lists `@drumee/server-core` as its own dependency, and several internal modules require themselves through the package name rather than a relative path:

- `lib/entity.js:14` → `require('@drumee/server-core/lib/acl')`
- `lib/mfs.js:39,42` → `require("@drumee/server-core/lib/file-io")`, `.../lib/entity`
- `lib/utils/generator.js:23` → `require("@drumee/server-core/lib/utils/mfs")`

These resolve to **`node_modules/@drumee/server-core/`** — the published copy, currently v1.1.57 while the working tree is v1.1.80 — not to the local files. So editing `lib/acl.js` does **not** change the `Acl` that `Entity` extends locally. When touching `acl.js`, `file-io.js`, `entity.js`, or `utils/mfs.js`, either convert the require to a relative path or symlink `node_modules/@drumee/server-core` to the repo root, otherwise you will debug the wrong code.

## Architecture

Request flow (see `docs/ARCHITECTURE.md` §4 for the full diagram):

```
Input (lib/input.js)      parse URL/headers/cookies/multipart → INPUT_READY
  ↓
Session (lib/session.js)  resolve hub from Host header, resolve user from cookie → READY
  ↓
Acl (lib/acl.js)          check_env → check_source → check_dest → check_domain → check_remit
  ↓                       → GRANTED | DENIED (403, service never runs)
Entity (lib/entity.js)    extends Acl; service handlers subclass this
  ↓
Output (lib/output.js)    standard envelope, headers, cookies → SENT
```

`Session` is the hub of the object graph: it constructs and holds `input`, `output`, `hub`, `user`, `yp`, `exception`, `websocket`, and `Acl`/`Entity` receive it as `opt.session` and rebind those references onto themselves. `Entity` is not a stage *after* `Acl` — it *is* `Acl` plus notification helpers (`notify_hub`, `notify_user`, `notify_by_email`, `pushUserOnlineStatus`).

Supporting modules: `Data` (`lib/data.js`, payload wrapper + `module.method` parsing), `User` (`lib/user.js`), `Mfs` (`lib/mfs.js`, DB-backed virtual tree), `FileIo` (`lib/file-io.js`, physical bytes), `Exception` (`lib/exception.js`), `RuntimeEnv` (`lib/runtimeEnv.js`) → `Page` (`lib/page.js`), `Generator` (`lib/utils/generator.js`), `Document` (`lib/utils/document.js`), `MfsTools` (`lib/utils/mfs.js`).

All public classes are exported from `lib/index.js`. **`lib/hub.js` is not exported** — it is a small `Logger` subclass with a single `keysel()` helper, effectively dead unless required by path.

### What lives outside this repo

Three things core depends on but does not contain — do not go looking for them here:

- **ACL service declarations.** `Acl.initialize()` takes the required permission as `opt.permission` (`lib/acl.js:51`); it does not read the JSON itself. The declarations live in the consuming service's `service/acl/` directory, and its router resolves them before constructing the `Acl`.
- **Background workers.** `Document` and `Entity.notify_by_email` spawn detached child processes at `$server_home/offline/media/{seo,to-pdf}.js` and `$server_home/offline/notification/meeting-notification.js`. Those scripts belong to the consuming service.
- **Nginx.** `FileIo` never streams large files through Node — it returns an `X-Accel-Redirect` header and lets Nginx transfer the bytes. Media responses are untestable without an Nginx front end.

### Repo-local assets

- `bin/*.sh` — shell helpers for LibreOffice/GraphicsMagick document previews, MFS directory copies, zip creation, temp cleanup. Invoked by consuming services, not from `lib/`.
- `lib/templates/*.tpl` — Lodash HTML shell templates rendered by `Page` (`index.tpl` is the default).
- `schemas/common/` — SQL routines this package owns (ACL checks, permission grant/revoke/tree, fonts, utils). One routine per file, `DROP … IF EXISTS` before `CREATE`, input params prefixed `_`. Applied via the `schemas` repo tooling (`bin/patch-from-file`, `bin/patch-from-manifest`).
- `.dev-tools.rc/` — rsync target and post-deploy reload config for `drumee-server-devel` / `drumee-server-deploy`. Edit `devel.sh` / `deploy.sh` to point at a host; `reload.sh` restarts `$ENDPOINT` and `$ENDPOINT/service`.

## Key Patterns

**`initialize(opt)`, not constructors.** Setup lives in `async initialize(opt)` on every class. Constructors do nothing meaningful; `Logger` from essentials drives instantiation.

**Event-driven, not call-driven.** Stages never call each other. They wire `.once()` handlers on shared events from `@drumee/server-essentials`' `Events`: `INPUT_READY`, `READY`, `START`, `GRANTED`, `DENIED`, `ERROR`, `SENT`, `END_OF_SESSION`, plus Input's `precondition_failed`. Every stage also registers `_halt()` on terminal events, so adding a new stage means wiring both the success and the halt paths.

**Service naming.** `module.method` (`yp.get_env`, `media.copy`). URLs are matched by `SVC_TAG = /^\/[_-]\/.*(service|svc|vdo)\//` in `lib/input.js:32`, with a `@hostname` variant for cross-vhost calls. No hardcoded routes anywhere.

**Double-underscore internals.** Classes are declared `class __acl extends Logger`, `class __entity extends Acl`, etc., and exported under the clean name. Match this when adding a module.

**Two async idioms coexist.** Database access goes through YP (`this.yp.await_proc(name, args)` / `asyncCall`). Media generation uses `async/await` over `shelljs.exec`. Long tasks are fire-and-forget `spawn(..., { detached: true })`, with results pushed back later over the Redis-backed websocket — never awaited inline.

**External binaries are hard requirements.** `Generator` and `Document` shell out to absolute paths: `/usr/bin/gm`, `/usr/bin/ffprobe`, `ffmpeg`, `soffice`, `/usr/bin/pdfinfo`. Missing tools surface as empty `stdout`, not as errors.

**`@drumee/server-essentials` is the base layer.** It supplies `Logger`, `Mariadb`, `RedisStore`, `Cache`, `Offline`, `sysEnv()`, and the shared `Attr` / `Events` / `Constants` vocabularies. Never redefine an attribute key locally — add it to essentials. Changes there propagate to every service through this library.

**Credentials.** Read from `/etc/drumee/credential/` at runtime; never committed, never hardcoded.
