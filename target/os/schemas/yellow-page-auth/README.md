# Phase 4 Yellow Page auth/domain closure

This private, transitional SQL closure is only for the Phase 4 disposable
kernel test environment. It installs no Hub database, MFS table, provisioning
procedure, factory, application schema or personal storage tree.

`phase4-schema.sql` is source-derived from the pinned `schemas` import
(`cb838e255600a4ec3797dc7ac13659ad9d187421`):

| Target object | Historical source | Phase 4 decision |
|---|---|---|
| `domain`, `entity`, `drumate`, `cookie`, `privilege` | `sources/schemas/yellow_page/tables/{domain,entity,drumate,cookie,privilege}.sql` | Only columns read/written by the retained procedures and session resolver are kept. `entity.db_name` is metadata only; no database is created from it. |
| `sys_conf` (`nobody_id`, `guest_id`, `public_id`) | `sources/schemas/yellow_page/tables/sys_conf.sql` and `procedures/session/session_check_cookie.sql` | The runtime reads the provisioned anonymous/guest identities; it never creates them. The disposable fixture provides only deterministic system-principal rows required to prove that contract. |
| `uniqueId` | `sources/schemas/yellow_page/procedures/functions.sql::uniqueId` | Required exclusively because `session_signin` creates a cookie when no `regsid` exists. |
| `session_signin` | `sources/schemas/yellow_page/procedures/session/session_signin.sql::session_signin` | Retains the historical credential lookup, `SHA2(password, 512)` verification and cookie-binding logic. Its historical final projection references `mimicker`, which is not in the minimal direct table closure and has no retained consumer; Phase 4 returns `NULL AS mimicker` rather than importing unrelated identity fields. |
| `domain_permission` | `sources/schemas/yellow_page/procedures/domain/permission.sql::domain_permission` | Retained unchanged. It evaluates `privilege & requested_permission` in Yellow Page. |
| `session_ensure` | `sources/schemas/yellow_page/procedures/session/session_check_cookie.sql::session_check_cookie` | Phase 4.4 keeps only allocation/reuse, the provisioned `nobody_id` invariant and the source's ten-minute pending-OTP expiry transition. It excludes MFS tokens, organisation/support, Hub, DMZ, profile and guest-policy branches. Fresh `cookie.uid` rows are non-null; a pre-existing nullable row is repaired to the provisioned nobody principal. |

`phase4-fixture.sh` inserts deterministic test-only identities directly into
the minimum Yellow Page tables. It includes the provisioned `nobody`, `guest`
and `system` identities required by the source session model, as well as the
two Domain-ACL test identities. It receives its password from the disposable
environment and stores only `SHA2(password, 512)`. Fixture insertion is not
an authentication bypass or provisioning substitute: runtime login still
invokes `session_signin` through the normal `yp.signin` kernel service and
returns a real `regsid` cookie.

`phase4-fixture-e8.sh` is an upgrade-characterization fixture only. It
provisions the same deterministic principals using the `e8e7bac8e` entity
shape (before `entity.type`) after the current `sys_conf` table is available.
The Phase 4.4 migration test adds nullable cookie/socket and pre-`ctime`
`authn` rows around it, then applies the current schema, injects an
unknown-age nullable-`ctime` OTAK, and reapplies the schema twice. The OTAK is
deleted rather than made fresh. It is not a runtime provisioning path.

The source `session_check_cookie` procedure is deliberately not installed.
`sources/schemas/yellow_page/procedures/session/session_check_cookie.sql`
also resolves MFS tokens, organisation/support metadata and system
configuration. The Phase 4 runtime uses the source-derived cookie/entity/domain
join in `server-runtime/lib/yellow-page-store.js::SESSION_QUERY` to resolve an
already authenticated `regsid`, avoiding that unrelated closure. Its Phase 4.4
`SESSION_CONTEXT_QUERY` reads only the provisioned anonymous/guest IDs and the
cookie state needed to distinguish a principal from signed-in authorization.
