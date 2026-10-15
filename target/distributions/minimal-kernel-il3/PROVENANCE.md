# IL-3 distribution fixture provenance

Owner approval: 2026-10-15, explicit approval of the distribution fixture proposed
in `drumee/infra-layer` commit `d2b1f3fbb7f59e406c854dc80c5750a9695c9bfa`,
`docs/IL-3-kernel-distribution-handoff.md`. This is a private integration fixture,
not extraction or modification of a kernel package.

All new glue is AGPL-3.0-only. Existing acquired copyright/license notices remain
unchanged. No copied kernel implementation is tracked in this directory.

| Input | Exact revision | Use and intentional differences |
|---|---|---|
| `drumee/transient`, refactor/mapping | `5469b48109dbb20eacbbc9314a6772264b388843` | Explicit path map in sources.lock.json acquires bootstrap, Hub lifecycle, HostFilesystem/FileIo, MFS service/transfer, media service, ui-build and selected Essentials primitives unchanged. Acquisition writes only ignored vendor/cache. |
| `drumee/server-runtime`, main; npm alpha.3 | `fc7d9de3f3e63baea8258885e55efe8e242904d0` | Actual session, ACL, HTTP, descriptor dispatch, OTAK/WebSocket and intrinsic schema manifest. |
| `drumee/ui-runtime`, main; npm alpha.2 | `5366d904356b414e87848a0bc8870b612e6c748a` | Actual CommonJS/LETC bootstrap and WebSocket client. |
| `drumee/system-mfs`, main; private archive alpha.2 | `53101c4a995ffca9118f795ab5d4c7c731200a2f` | Actual module-owned schemas, provisioning, permissions, filesystem/content APIs. No publication or substitution by older npm alpha.1. |
| `drumee/window-manager`, main; npm alpha.2 | `e294979dfcb59f73af19975e40f890a0b366cd8c` | Real Finder window host. |
| `drumee/finder`, main; npm alpha.4 | `b46e2c94b615a1993b6162716d9e8965d0029564` | Real MfsClient, Finder widget, sync and window behavior. |
| `drumee/infra-layer`, main; unpublished source archive | `95db6c7aed097b62aa8081df17b3467d850e779c` | Existing pure plan, composition, preparation, activation, persistent services and recovery; bounded authenticated Redis native-check readiness before shutdown. No transient implementation fork. |

`lib/host.js` wires the existing primitives; `lib/initialize.js` invokes existing
owners and prepares explicitly authorized disposable principals. The wiring was
informed by transient's revision-pinned phase4.9-finder-live-browser.test.js,
but replaces its in-process MemoryRedis with actual authenticated RedisStore,
uses organisation 1, obtains fresh uniqueId() identities and preserves private
credentials instead of copying another fixture's fingerprint. SQL password
encoding matches unchanged session_signin; it is not a new authentication design.
`lib/database.js` implements a distribution-owned pinned-manifest interpreter
and real parameterized MariaDB adapter with transaction affinity, not SQL logic.

Runtime dependencies and tarball integrity are locked in package-lock.json.
Infrastructure images are immutable references in lib/distribution.js. The
native DNS capability image is built from Infra Layer's pinned recipe. Resulting
local image IDs, fixture Git SHA and composition revision belong in each test
report. Local test image labels do not substitute for code provenance.
