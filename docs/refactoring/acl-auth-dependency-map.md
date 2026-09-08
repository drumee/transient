# Authentication and ACL dependency map

This records the narrow Phase 4 private capability. Historical repository
location is evidence, not runtime ownership; all source references are pinned
in `SOURCE_MANIFEST.md`.

| Component | Historical source | Target owner | Authentication role | Authorization role | Scope | Procedure / DB | Hub | MFS | Team | Phase 4 |
|---|---|---|---|---|---|---|---|---|---|---|
| Login Worker | `server-team/service/yp.js::login` | `server-runtime/service/yp.js` | Invokes session login | none | kernel/public | `session_signin` / Yellow Page | no | no | source-only; policy removed | Implemented |
| Session abstraction | `server-core/lib/session.js::signin` | `server-runtime/lib/session.js` | Credentials → persisted `regsid`; resolves later request | supplies identity/domain context | kernel | `session_signin`, cookie join / Yellow Page | no | no | no | Implemented |
| Cookie input | `server-core/lib/input.js::{_authorization,authorization}` | `server-runtime/lib/session.js` | Reads `regsid` | none | kernel | `cookie` / Yellow Page | no | no | no | Implemented |
| SQL login | `schemas/yellow_page/procedures/session/session_signin.sql` | `target/os/schemas/yellow-page-auth` | SHA2-512 verification and cookie binding | none | Yellow Page | `session_signin` / Yellow Page | no | no | no | Implemented |
| Domain scope dispatch | `server-core/lib/acl.js::check_domain` | `server-runtime/lib/{permission,domain-authorizer}.js` | requires session | calls Domain ACL | domain | `domain_permission` / Yellow Page | no | no | historical Hub precheck excluded | Implemented |
| SQL Domain ACL | `schemas/yellow_page/procedures/domain/permission.sql` | `target/os/schemas/yellow-page-auth` | none | `privilege & requested_permission` | domain | `domain_permission` / Yellow Page | no | no | no | Implemented |
| Generic DB API | `server-essentials/lib/mariadb.js::{await_proc,await_func,await_query}` | current `server-essentials` | runs procedure/query | runs function | generic | MariaDB | no | no | no | Reused |
| Hello private validation | New Phase 4 descriptor/worker | `target/modules/hello` | consumes session | requests `read` | domain | runtime → Yellow Page | no | no | no | Implemented |
| Runtime session/OTAK transport | `server-core/lib/input.js::{validCookie,_authorization}`; `server-team/service/bootstrap.js::authn`; `authn_store`/`socket_bind` SQL | `server-runtime::{session,bootstrap,websocket-router}` | Allocates/reuses `regsid`, stores and resolves one-use OTAK | none; public transport fast path | domain + `src:anyone` / `public-api` | `session_ensure`, `authn`, `authn_store`, `socket_bind` / Yellow Page | no | no | historical Hub scope intentionally removed | Phase 4.4 |
| Hub ACL | historical Hub/session/ACL paths | none | n/a | Hub-resource authorization | hub | Hub shard procedures | yes | boundary | historical only | Deferred |
| MFS ACL/provisioning | schemas/setup-schemas/server-team | none | n/a | resource/node authorization | hub/resource | Hub shards/MFS | yes | yes | historical only | Deferred |

## Closure classification

| Historical object | Classification | Reason |
|---|---|---|
| `domain`, `entity`, `drumate`, `cookie`, `privilege` | `REQUIRED_DOMAIN_AUTH` / `GENERIC_IDENTITY` | Direct reads/writes of `session_signin`, `domain_permission` or the narrowed authenticated-session resolver. |
| `uniqueId` | `REQUIRED_DOMAIN_AUTH` | Directly called by `session_signin` when a cookie is new. |
| `session_ensure`, `authn`, `authn_store`, `socket_bind`, `socket_get`, `socket_refresh`, `socket_free` | `RUNTIME_SESSION` / `WEBSOCKET_AUTH` | Intrinsic Phase 4.4 runtime transport closure. `session_ensure` is the narrowed no-Hub/MFS portion of `session_check_cookie`; `socket_bind` consumes the OTAK. |
| `session_check_cookie` extras (`mfs_token`, organisation/support, sysconf) | `MFS_ONLY` / excluded deployment data | Not needed to resolve the Phase 4 identity/domain context. |
| `drumate_create`, `permission_grant`, factory and search projection | `HUB_ONLY` / `MFS_ONLY` | Provision personal Hub/MFS state and are not fixture dependencies. |
| Hub permission procedures | `HUB_ONLY` | Require the deferred Hub-shard/MFS boundary. |

## Boundary invariant

```text
scope = domain → central Yellow Page → domain_permission
scope = hub    → Hub shard / resource-MFS boundary → deferred
```

An explicit Domain descriptor never falls through to a Hub default. A valid
session alone is never a grant; `permission.src` is mandatory and its current
Domain privilege is evaluated on every private request. `permission.dest` is
optional, but when present it is evaluated through the same bitwise
`domain_permission` function and both non-zero results are required. A
destination privilege alone never grants access.
