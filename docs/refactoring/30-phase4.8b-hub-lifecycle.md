# Phase 4.8B — Hub lifecycle, authorized context and schema propagation

Status: **CLOSED / VALIDATED**, including the normative ACL correction, on
2026-10-08.

## Decision and sequence

The authoritative sequence is now:

```text
Phase 4.8B Hub lifecycle
→ Phase 4.9 Finder stabilization/extraction
→ end-to-end Oxymotion validation
```

Finder/Oxymotion are consumers, not owners of Hub lifecycle. No `oxy_` object
is present in the kernel. Existing Phase 4.9 extraction/publication artifacts
and closure reports are repository facts but are not accepted as phase-gate
evidence under this sequence; Phase 4.9 must be revalidated after 4.8B.

## Ownership

| Boundary | Ownership |
|---|---|
| `target/control-plane/hub-lifecycle` | Hub request/idempotence, shard assignment, Yellow Page Hub registry, ACL, plan resolution, durable orchestration and upgrade scans |
| `target/foundation/server-runtime` | authenticated `scope: hub` authorization and injection of an already authorized internal `hub_context` |
| standalone `system-mfs` | MFS SQL and initialization inside an already assigned shard |
| application module | its canonical manifest, Hub SQL and versioned trusted handler |

The control-plane location is transitional. A later extraction decision may
create a final delivery boundary, but 4.8B does not require a remote repository.

## API and DTOs

Creation accepts a trusted session, a server-established `creator_module`, and
only `{idempotency_key,name}` from public input. The public response is
`{hub_id,status}`. The key scope is organisation + principal + creator module.
Same key/same fingerprint resumes; same key/different request is rejected.

The internal resolver consumes `{hub_id,uid,organisation_id,asked_permission,
capabilities}` and returns `{hub_id,type,organisation_id,uid,asked_permission,privilege,
database_name,db_host,fs_host,home_dir,home_id,authorized}`. This object is
internal and is never serialized as the creation response.

## Normative ACL contract

Phase 4.8B consumes the current `@drumee/server-essentials >=1.3.6` constants
through an explicit `createAclContract(Constants)` dependency. It does not own
or duplicate their numeric hierarchy.

| Name | requested `permission` bit | granted cumulative `privilege` |
|---|---:|---:|
| read | 2 | 3 |
| write | 4 | 7 |
| delete | 8 | 15 |
| admin | 16 | 31 |
| owner | 32 | 63 |

The historical evaluator is bitwise: `(granted_privilege & asked_permission)
=== asked_permission`. The public ACL documentation says `write = 8`, but the
current executable constants, `permissionValue("write")`, service usages and
MFS checks all establish write as 4; 8 is delete. The implementation follows
the executable contract and records this documentation divergence explicitly.

The creating Drumate is persisted as `hub.owner_id` and receives
`privilege.owner` (63). Generic ACL grant/revoke requires the admin permission
bit (16), which both admin and owner words contain. Read, write and delete do
not grant ACL-management authority. Generic grant refuses owner; revocation
refuses the durable owner. The historical dedicated ownership-transfer path is
not silently folded into grant and remains outside the minimal 4.8B API.

## Manifest contract

`server/schemas/SCHEMA_MANIFEST.json` remains the sole module schema manifest.
Phase 4.8B preserves existing metadata and adds `inherit` plus `requires`.
Absence means `installed` and `[]`. Unknown inheritance, missing/inactive or
version-incompatible dependencies, cycles and ownership collisions fail before
plan execution. Exact dependency constraints reuse `schemaVersion`; no second
version system is introduced.

`installed` selects all active installed Hub contributors. `own` selects the
creator and transitive requirements. A dependency's own `inherit` is ignored;
its `requires` is followed. Target classification prevents Yellow Page,
platform, principal and Drumate objects from being installed into a Hub shard.

The current standalone `system-mfs` manifest is a compatible legacy manifest:
its package-relative `schemas/SCHEMA_MANIFEST.json`, absent propagation fields
and `schemaClass: common` provision list normalize to installed/empty
requirements/Hub contribution. Canonical fixtures are under
`tests/fixtures/phase4.8b/`. Moving the standalone file to the canonical
`server/schemas` path is release debt because this repository's instructions
forbid modifying the sibling standalone checkout.

## Persistence, concurrency and recovery

The control-plane schema persists:

- scoped idempotency request and fingerprint;
- Hub lifecycle and immutable shard association;
- Yellow Page `entity` and minimal `hub` registry rows;
- canonical cumulative ACL privilege and durable owner;
- creator and inheritance policy;
- immutable create/upgrade plan snapshots and artifact references;
- per-Hub/per-module version, state, attempt and bounded error code;
- schema-object ownership.

Atomic unique keys select one Hub for concurrent retries. Database creation is
an idempotent durable boundary. Provisioners run in dependency order. A failed
handler leaves the Hub/shard and successful work intact. Retrying reloads the
same immutable plan. Handlers must tolerate the crash window between SQL
success and the `ready` update.

Upgrade scans are bounded to 500 Hubs and cursor-paginated. New contributors
produce new plans; completed plans are never rewritten. Deactivation/removal
does not delete objects. Ready capabilities remain usable during an upgrade;
the runtime rejects only services whose required capability is not ready.

## Security

Only fully authenticated Drumate sessions may create/select Hubs. Anonymous,
nobody, guest and OTP/intermediate sessions fail closed. Domain permission
does not imply Hub permission. The resolver validates organisation, entity
type, shard existence, ACL and required capabilities. Physical locators,
credentials and filesystem paths from client input are rejected. The runtime
resolves canonical `permission.src` before worker construction. Cumulative
write includes read, but write/delete cannot grant or revoke ACL; admin/owner
can. Contextual MFS checks remain separate and unchanged.

## Validation command

```bash
scripts/test-env/kernel/phase4.8b-validation.sh
```

It runs focused unit/runtime tests, boots the isolated real kernel MariaDB
environment, provisions `system-mfs` plus independent fixtures, exercises
authorized SQL/MFS operations and failure/retry, then validates the private
package artifact.

## Validation evidence

| Suite | Result |
|---|---:|
| Hub lifecycle manifest/plan/idempotence/ACL unit tests | 10/10 |
| Focused runtime Hub authorization/context tests | 4/4 |
| Complete transitional server-runtime regression | 43/43 |
| Standalone system-mfs regression, including MariaDB | 9/9 |
| Isolated Phase 4.8B real-MariaDB scenario | 1/1 |

The real scenario created distinct `installed` and `own` Hubs and shards,
automatically provisioned `system-mfs` and canonical fixtures, exercised MFS,
called a fixture procedure through `ServiceDispatcher` and an authorized Hub
context, denied reader writes and cross-Hub selection, and proved client
database parameters could not redirect execution. The corrected run also
migrated the former 1/2/3 ACL column, persisted the creator as owner 63, denied
delete and ACL management to a writer 7, and allowed ACL management to an
admin 31. It retained a sentinel,
failed after successful upgrade SQL, exposed `failed`/attempt state, kept prior
capabilities usable, resumed the same plan/shard, paginated the scan and left
the `own` Hub untouched. It also resumed an `allocating` Hub, converged two
concurrent creates to one Hub/entity/shard association, loaded the control
plane from a second filesystem copy and recovered persisted metadata/data.

The private artifact dry run validates package-relative files and declares
current server-essentials as a peer dependency; it bundles no duplicate ACL
constants. Nothing was published.

## Repository baselines and limits

Implementation modified only `transient`, branch `refactor/mapping`, from
baseline `b4d755cda1722f312c436f69b7900616c99f2cad`. Inspected standalone heads
were server-runtime `d17ecee8`, system-mfs `a7f7395b`, ui-runtime `5366d904`,
Window Manager `e294979d`, Finder `730aa309` and Oxymotion `2bdcd556` (whose
pre-existing untracked `node_modules/` was preserved).

The final Hub lifecycle boundary is still transitional and must later be
extracted or assigned to a final control-plane repository. The standalone
server-runtime has not yet received the Hub authorization seam, and the
standalone system-mfs manifest still uses its compatible legacy `schemas/`
location; those are explicit release/migration tasks, not duplicate runtime
implementations. Phase 4.9 and full Oxymotion integration were not started.
