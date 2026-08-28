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
| ACL/service-name assumptions | `CRITICAL` | ACL JSON drives dispatch; fixture every scope/permission |
| CLI direct DB/shard access | `CRITICAL` | Raw yp queries and qualified calls; stable API requires parity |
| CLI DB/API difference | `CRITICAL` | API backend throws; parity absent |
| Procedure result leakage | `HIGH` | `setup-schemas/lib/drumate.js::createHub` documents mixed result sets |
| Webpack aliases/dynamic imports | `HIGH` | UI seed registry and environment-driven signin build |
| Team boot sequence | `CRITICAL` | bootstrap events/globals span ui-core and ui-team |
| Provisioner/runtime/CLI semantic cycle | `HIGH` | All mutate yp, shards and storage |
| Patch/upgrade order | `CRITICAL` | schema patch trees and Debian schemas-patch |
| Docker/native divergence | `HIGH` | two deployment channels require shared scenarios |
| Repo-layout packaging | `HIGH` | Debian build matrix names Team repos |
| Existing installs/version skew | `CRITICAL` | consumer ranges differ from imported package versions; define matrix |
| Plugin integrity/rollback | `HIGH` | Debian script shallow clones/copies/deletes without transaction |
| Missing automated baseline coverage | `CRITICAL` | server-team/CLI/signin lack package tests |
| Apparent duplicates/deprecated code | `MEDIUM` | Usage not proven; retain and investigate |
