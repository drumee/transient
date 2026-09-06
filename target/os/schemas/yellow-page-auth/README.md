# Phase 4 Yellow Page auth/domain closure

This private, transitional SQL closure is only for the Phase 4 disposable
kernel test environment. It installs no Hub database, MFS table, provisioning
procedure, factory, application schema or personal storage tree.

`phase4-schema.sql` is source-derived from the pinned `schemas` import
(`cb838e255600a4ec3797dc7ac13659ad9d187421`):

| Target object | Historical source | Phase 4 decision |
|---|---|---|
| `domain`, `entity`, `drumate`, `cookie`, `privilege` | `sources/schemas/yellow_page/tables/{domain,entity,drumate,cookie,privilege}.sql` | Only columns read/written by the retained procedures and session resolver are kept. `entity.db_name` is metadata only; no database is created from it. |
| `uniqueId` | `sources/schemas/yellow_page/procedures/functions.sql::uniqueId` | Required exclusively because `session_signin` creates a cookie when no `regsid` exists. |
| `session_signin` | `sources/schemas/yellow_page/procedures/session/session_signin.sql::session_signin` | Retains the historical credential lookup, `SHA2(password, 512)` verification and cookie-binding logic. Its historical final projection references `mimicker`, which is not in the minimal direct table closure and has no retained consumer; Phase 4 returns `NULL AS mimicker` rather than importing unrelated identity fields. |
| `domain_permission` | `sources/schemas/yellow_page/procedures/domain/permission.sql::domain_permission` | Retained unchanged. It evaluates `privilege & requested_permission` in Yellow Page. |

`phase4-fixture.sh` inserts deterministic test-only identities directly into
the minimum Yellow Page tables. It receives its password from the disposable
environment and stores only `SHA2(password, 512)`. Fixture insertion is not
an authentication bypass: runtime login still invokes `session_signin` through
the normal `yp.signin` kernel service and returns a real `regsid` cookie.

The source `session_check_cookie` procedure is deliberately not installed.
`sources/schemas/yellow_page/procedures/session/session_check_cookie.sql`
also resolves MFS tokens, organisation/support metadata and system
configuration. The Phase 4 runtime uses the source-derived cookie/entity/domain
join in `server-runtime/lib/yellow-page-store.js::SESSION_QUERY` to resolve an
already authenticated `regsid`, avoiding that unrelated closure.
