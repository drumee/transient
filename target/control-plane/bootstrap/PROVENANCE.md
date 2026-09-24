# Phase 4.6A provenance

| Target | Source evidence | Source SHA | Extraction decision |
|---|---|---|---|
| `schemas/001-organisation.sql` | `sources/schemas/yellow_page/tables/organisation.sql` | `cb838e255600a4ec3797dc7ac13659ad9d187421` | Retains the historical registry shape; excludes Hub, quota and membership procedures. |
| `lib/index.js` identity ordering | `sources/setup-schemas/lib/organization.js::{_sysconf,createNobody,createGuest,createSystemUser}` | `1582eb557ce092dd2cc5fa6f9d533d64911f4dce` | Preserves domain/organisation before nobody, guest and system. Replaces the MFS-coupled `Drumate.create()` call with direct creation in the already-owned runtime identity tables. |
| `lib/store.js::create_principal` | `sources/schemas/yellow_page/procedures/drumate/drumate_create.sql` and runtime intrinsic identity schema | `cb838e255600a4ec3797dc7ac13659ad9d187421` | Preserves Drumee UID generation, Drumate/entity pairing, system category and Domain privilege while intentionally excluding factory pools, per-user schemas, MFS initialization, vhosts, Hub creation and filesystem writes. |

The runtime schema remains owned by `server-runtime`. Platform bootstrap reuses
its tables and `uniqueId()` function but does not duplicate or alter them.
