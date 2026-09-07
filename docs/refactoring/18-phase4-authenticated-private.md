# Phase 4 — Authenticated private Domain capability

## Result

Phase 4 adds one narrow reusable private capability: real Yellow Page login,
real `regsid` session reuse and Domain-scoped authorization. It extends the
existing validation module with `hello.private`; it does not add a Hub, MFS,
provisioning, Finder, Window Manager or a business application.

```text
credentials → yp.signin → session_signin → cookie.status=ok/regsid
→ authenticated request → hello.private (scope: domain)
→ domain_permission → lazy HelloWorker.private
```

The Phase 3 path remains unchanged:

```text
hello.ping → anonymous + public-api → PASS without a session
```

## Historical login path

| Step | Historical source | Phase 4 result |
|---|---|---|
| Login service | `sources/server-team/service/yp.js::login` | `server-runtime/service/yp.js::YellowPageWorker.signin` keeps only generic credential-to-session invocation. |
| Session orchestration | `sources/server-core/lib/session.js::signin` | `server-runtime/lib/session.js::KernelSession.signin`. |
| Session procedure | `sources/schemas/yellow_page/procedures/session/session_signin.sql::session_signin` | Installed in the disposable Yellow Page closure. |
| Cookie input | `sources/server-core/lib/input.js::{_authorization,authorization}` | `SessionManager` reads the historical `regsid` cookie. |

`POST /-/svc/yp.signin` invokes the source-derived `session_signin` procedure.
It retains the historical `SHA2(password, 512)` check and cookie write/update,
returning the resulting `regsid` only as an HttpOnly response cookie. The
historical final result projection references `mimicker`; that field has no
retained Phase 4 consumer and would widen the direct identity closure, so the
isolated procedure returns `NULL AS mimicker`. A later request is authenticated
only by resolving the persisted cookie. No uid, Worker identity or test header
is injected in acceptance testing.

The source Team login service has product-specific origin, redirect, device and
accounting behavior. Those branches remain outside the runtime.

## Fixture boundary

`target/os/schemas/yellow-page-auth/phase4-fixture.sh` inserts two deterministic
test identities in the minimum Yellow Page tables. This is test setup, not an
authentication bypass:

```text
fixture → domain/entity/drumate/privilege rows + SHA2 fingerprint
runtime → credentials → session_signin → real regsid cookie
```

It does not call `drumate_create`, allocate a personal database, create a Hub,
call `permission_grant`, or initialise MFS. The disposable test password is an
environment value and is not included in responses, logs or this document.
The fixture derives its SHA-512 fingerprint in shell and interpolates only the
validated 128-character hex digest into fixture SQL; the runtime still submits
the plaintext password to `session_signin` for historical verification.

## Domain ACL

`target/modules/hello/server/acl/hello.json` adds:

```json
{
  "scope": "domain",
  "permission": { "src": "read" }
}
```

It has no `public-api` fast check. The generic path is:

```text
resolved regsid identity → scope: domain
→ domain_permission(uid, domain_id, requested_permission)
→ generic Dispatcher → lazy WorkerClass
```

The exact procedure is
`sources/schemas/yellow_page/procedures/domain/permission.sql::domain_permission`:
`privilege.privilege & requested_permission`. Current
`server-essentials/lib/mariadb.js::await_func` returns a one-field result row;
`YellowPageStore.scalarFunctionValue` is the documented runtime adaptation to
that current generic API.

The retained `check_domain()` result semantics are exact at the authorization
boundary: `permission.src` is mandatory, so a missing source privilege denies;
an absent `permission.dest` is satisfied; and a present destination privilege
is a second `domain_permission` check. Both requested bitmasks must return
non-zero. `dest` alone can never grant Domain authorization.

Historical `Acl._start` performs Hub/MFS-oriented environment checks before
`check_domain`. For explicit `scope: "domain"`, Phase 4 dispatches directly to
the real `domain_permission` path before those unrelated preconditions. Hub
scope is neither activated nor emulated.

## Domain versus Hub

| Scope | Database / procedure | Status |
|---|---|---|
| `domain` | Central Yellow Page / `domain_permission` | Implemented and live-tested. |
| `hub` | Per-Hub shard and Hub permission/MFS boundary | Deferred; no branch, schema or fixture is active. |

The test MariaDB contains only database `yp`; its application tables are
`cookie`, `domain`, `drumate`, `entity` and `privilege`. No personal Hub
database or MFS table is created.

## SQL closure and provenance

`target/os/schemas/yellow-page-auth/phase4-schema.sql` records source-level
provenance. The installed closure is only:

- tables: `domain`, `entity`, `drumate`, `cookie`, `privilege`;
- functions: `uniqueId`, `domain_permission`;
- procedure: `session_signin`.

`uniqueId` is required because `session_signin` creates a cookie. The broader
historical `session_check_cookie` is not installed: its MFS token,
organisation/support and system-configuration closure is unnecessary. The
source-derived `YellowPageStore::resolveSession` cookie/entity/drumate/domain
join supplies only authenticated identity and Domain context.

## Acceptance evidence

`tests/integration/kernel/phase4-authenticated-private.test.js` starts from a
clean database and verifies through real HTTP:

| Request | Session / privilege | Result |
|---|---|---|
| `hello.ping` | none | `200` public success |
| `hello.private` | none | `403` |
| `yp.signin`, invalid credentials | none | `401`, no cookie |
| `hello.private` | real session, no Domain privilege | `403` |
| `hello.private` | real session, read privilege | `200` |
| `hello.private`, privilege revoked | same session | `403` |
| `hello.private`, privilege restored | same session | `200` |
| `domain_permission(uid, 41, 1/2/4)` with fixture privilege `3` | real SQL bitmask | `1` / `2` / `0` |

The revoke/restore transition without re-login proves session authentication
and Domain authorization are distinct and that `domain_permission` executes
on the live path. The test also asserts the exact five-table closure and
absence of personal-Hub/MFS objects.

## Environment and validation

The clean Node/Nginx kernel host remains configured from pinned `setup-infra`.
Phase 4 adds a network-isolated `mariadb:11.4` container with no host port.
Runtime credentials are generated below `.tmp/test-env/kernel/` with mode
`0600`, mounted read-only, and removed only by guarded kernel cleanup. No
historical Debian Team image, Team runtime, `setup-schemas`, factory or host
`/etc` is used.

| Command | Result |
|---|---|
| `node --test target/foundation/server-runtime/test/*.test.js` | PASS |
| `npm test --prefix target/modules/hello` | PASS |
| `node --test tests/integration/kernel/phase4-authenticated-private.test.js` | PASS |

## Deferred

Hub scope/shards, MFS data and ACL, `drumate_create`, factory/provisioning,
Signin/Loby UI migration, Marketing, Team migration and deployment packaging.
