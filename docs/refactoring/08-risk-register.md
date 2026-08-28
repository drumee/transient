# Risk Register

| Risk | Rating | Evidence / required mitigation |
|---|---|---|
| Entity/schema provisioning/templates | `CRITICAL` | `setup-schemas/lib/{schema,drumate}.js`; lock fresh/existing behavior and result shapes |
| Factory warm pool | `CRITICAL` | CLI consumes `drumate_create`/`desk_create_hub`; identify daemon, states and recovery |
| MFS deletion/import/export | `CRITICAL` | CLI DB stores touch shards and disk; test isolation and partial failure |
| Mixed schema ownership | `CRITICAL` | Task/channel data under `schemas/common`; module-aware templates/migrations |
| Split plugin discovery/lifecycle | `HIGH` | REST loader, UI bootstrap and Debian installer use separate contracts |
| Runtime globals | `HIGH` | UI-core/UI-team window globals and server shared global caches |
| Window Manager/Finder/DnD | `CRITICAL` | `ui-team/builtins/media/core.js` and window seed graph |
| ACL engine/policy ownership confusion | `CRITICAL` | ACL JSON drives dispatch, but service policy is not generic engine behavior; fixture every scope/permission and preserve module ownership |
| CLI direct DB/shard access | `CRITICAL` | Raw yp queries and qualified calls; stable API requires parity |
| CLI DB/API difference | `CRITICAL` | API backend throws; parity absent |
| Procedure result leakage | `HIGH` | `setup-schemas/lib/drumate.js::createHub` documents mixed result sets |
| Webpack aliases/dynamic imports | `HIGH` | UI seed registry and environment-driven signin build |
| Team boot sequence | `CRITICAL` | bootstrap events/globals span ui-core and ui-team |
| Mistaking UI Team for the minimal shell | `CRITICAL` | UI Team boot files also register the integrated Team application; derive the host contract through tests before selecting symbols |
| Provisioner/runtime/CLI semantic cycle | `HIGH` | All mutate yp, shards and storage |
| Patch/upgrade order | `CRITICAL` | schema patch trees and Debian schemas-patch |
| Docker/native divergence | `HIGH` | two deployment channels require shared scenarios |
| Repo-layout packaging | `HIGH` | Debian build matrix names Team repos |
| Existing installs/version skew | `CRITICAL` | consumer ranges differ from imported package versions; define matrix |
| Plugin integrity/rollback | `HIGH` | Debian script shallow clones/copies/deletes without transaction |
| Missing automated baseline coverage | `CRITICAL` | server-team/CLI/signin lack package tests |
| Apparent duplicates/deprecated code | `MEDIUM` | Usage not proven; retain and investigate |
| Reference package identity collisions | `CRITICAL` | Marketplace identifies as `@drumee/loby`; loby/marketplace point to analytics-server; descriptor identity cannot inherit package metadata blindly |
| Legacy onboarding migration | `CRITICAL` | Loby supersedes onboarding-server, but their divergent same-named schemas require an explicit deployed-data migration/upgrade path |
| Hidden host contracts in frontend examples | `HIGH` | Signin and sandbox-ui consume global LETC/router/session objects without compatibility declarations |
| Sandbox public provisioning/destruction | `CRITICAL` | `sandbox.json` exposes create/remove to anyone/public-api and service code mutates domains, users, hubs and disk |
| Marketplace callback/security boundary | `CRITICAL` | Anonymous ACL endpoints rely on JWT/HMAC and MFS permission checks in service code; preserve service-specific policy |
| Marketplace unregistered payment code | `HIGH` | `service/lib/payment.js` lacks mapped ACL, schema and Stripe dependency; do not treat it as live behavior without runtime evidence |
| Static onboarding accidentally reintroduced | `LOW` | Source is retained only by baseline immutability; target distributions must not package it |
