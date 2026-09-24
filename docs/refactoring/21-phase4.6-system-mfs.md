# Phase 4.6 — platform bootstrap contract and system-mfs

Phase 4.6 is closed and validated after the closed Phase 4.5 exportability lock.

```text
4.6A platform bootstrap implemented and validated
4.6B system-mfs implemented and validated
```

Phase 4.6A adds no MFS code, MFS schema, package publication or application.

## Goal and lifecycle

The phase turns installed runtime schemas into a valid minimal Drumee instance,
then will introduce MFS as the first system/kernel module in a later lot.

```text
runtime package installation
→ intrinsic runtime schema installation
→ platform bootstrap
→ organisation 1 + nobody + guest + system
→ valid minimal Drumee instance
→ optional system-mfs capability
→ business applications such as Marketing
```

The canonical invariants are:

```text
DEFAULT_ORG_ID = 1
NOBODY_UID = ffffffffffffffff
```

Runtime may resolve and validate them but must never create or repair them.

## Ownership

- `server-runtime`: boot/runtime, session/authentication, Domain ACL, module
  loading/dispatch and intrinsic runtime schemas;
- platform bootstrap/control plane: decides when and for which context to
  create and validate organisation `1`, nobody, guest and system;
- `system-mfs`: will own MFS behavior, schemas, migrations and MFS-specific
  provisioning hooks, but not platform identity creation;
- Marketing: will own its business lifecycle and schemas;
- Finder: remains a future system application, not the MFS engine.

Phase 4.6A implements only a small explicit orchestrator. It does not introduce
a generic provisioning framework.

## Historical dependency characterization

The historical entry point is `sources/setup-schemas/populate.js`, which runs
`Organization.populate()`, stocks MFS-capable factory entities, and then calls
`createNobody()`, `createGuest()` and `createSystemUser()`. The evidence is
pinned at setup-schemas SHA
`1582eb557ce092dd2cc5fa6f9d533d64911f4dce` and schemas SHA
`cb838e255600a4ec3797dc7ac13659ad9d187421`.

| Object | Historical JS and SQL path | Transitive state and dependency | Classification for 4.6A |
|---|---|---|---|
| Organisation 1 | `Organization._sysconf()` and `populate()` issue direct `REPLACE` statements | `domain`, `organisation`, `sys_conf`, `dmz_user`, `settings`, vhosts, mail records and filesystem-root configuration | `domain` and `organisation` are `PLATFORM_BOOTSTRAP`; runtime-owned `sys_conf` is reused; DMZ, settings, vhosts, mail and filesystem keys are `SYSTEM_MFS`, `TEAM_COMPATIBILITY` or `OPTIONAL` |
| Nobody | `Organization.createNobody()` calls `Drumate.create()`, which calls `drumate_create`, `initFolders()` and `updateEntries()` | `drumate_create` uses `pickupEntity`, `unique_username`, `main_domain`, `get_sysconf`, per-user databases, permission setup, `mfs_trash_init`, `mfs_chat_init`, `mfs_changelog`/`mfs_ack`; JS then calls `mfs_init_folders`, rewrites pool identities and creates a filesystem directory | Identity rows and Domain privilege are `PLATFORM_BOOTSTRAP`; factory, per-user database, permission, filesystem and MFS work are `SYSTEM_MFS` or `LEGACY` for the minimal platform |
| Guest | `Organization.createGuest()` resolves `sys_conf.guest_id` and follows the same `Drumate.create()` path | Same MFS/factory closure as nobody, plus the historical `dmz_user` row | Generated Drumate identity plus `guest_id` are `PLATFORM_BOOTSTRAP`; `dmz_user` and DMZ policy are deferred |
| System | `Organization.createSystemUser()` generates a UID, calls `Drumate.create()`, then calls `createHub()` twice | Same identity/MFS closure, followed by `desk_create_hub` for media and portal Hubs and their storage | Privileged generated Drumate identity is `PLATFORM_BOOTSTRAP`; all Hub, portal, media, storage and MFS work is `SYSTEM_MFS` or `TEAM_COMPATIBILITY` |

The historical `Drumate.create()` path cannot be reused unchanged. Phase 4.6A
retains the existing Drumee identity semantics—`uniqueId()`, paired
`entity`/`drumate` rows and Domain privilege—but writes that minimal closure
directly. This is the intentional semantic difference: no factory entity,
per-user database, vhost, permission database, MFS procedure or filesystem is
created.

## Minimal persisted model

Phase 4.6A reuses the runtime-intrinsic `domain`, `entity`, `drumate`,
`privilege`, `sys_conf` and `uniqueId()` objects. Its only new SQL object is the
historical `organisation` table, owned by the control plane. The canonical
numeric default organisation is represented by `organisation.sys_id = 1`,
`organisation.domain_id = 1` and `domain.id = 1`; its opaque
`organisation.id` is generated.

The identities are persisted as system Drumates in Domain 1:

- nobody uses exactly `ffffffffffffffff` and authoritative privilege `1`;
- guest uses a generated UID, authoritative privilege `1`, and the canonical
  `sys_conf.guest_id` reference;
- system uses a generated UID and authoritative Domain-owner privilege `63`;
- `sys_conf.nobody_id` records the canonical nobody UID.

Current minimal-runtime consumers read `nobody_id` and `guest_id`. The legacy
`public_id` key is used by Team room policy, not by the minimal runtime, so it
is not written. `domain_name` is required by the historical MFS-coupled
`drumate_create` procedure but not by the selected direct identity primitive.
`dmz_user` is DMZ-specific, `map_role` is not a current runtime dependency, and
no `system_id` alias is invented: system resolves uniquely by username and
Domain 1.

The complete Phase 4.6A SQL dependency closure is therefore:

```text
reused from server-runtime:
    domain
    entity
    drumate
    privilege
    sys_conf
    uniqueId()

owned by platform bootstrap:
    organisation
```

## Bootstrap and validation contract

`target/control-plane/bootstrap/` exposes separate `bootstrap()` and
`validate()` operations. Validation only inspects state. Bootstrap performs:

```text
resolve
→ reject conflicts
→ create safely missing objects in a transaction
→ validate the result
```

Fresh state creates the whole closure. Valid state returns with
`changed = false`. Partial state is completed only when an existing identity
is unambiguous; for example, an existing unique guest may receive a missing
`guest_id` reference. Conflicts fail with `PLATFORM_BOOTSTRAP_CONFLICT` before
identity mutation. Examples include an incompatible Domain 1, a noncanonical
nobody UID, a guest reference that resolves to nobody, multiple named
identities, inconsistent principal rows, or a non-distinct system identity.

The operation is idempotent. Repeated runs preserve the organisation, guest
and system opaque IDs and do not duplicate identities.

## Validation evidence

The disposable kernel lifecycle now performs:

```text
install intrinsic runtime schemas
→ observe absent platform invariants
→ run control-plane bootstrap
→ validate organisation/nobody/guest/system
→ start server-runtime
→ allocate an anonymous regsid through bootstrap.authn
```

The integration test verifies that the anonymous cookie persists
`ffffffffffffffff`, restarting `server-runtime` does not change platform rows,
and the database contains no MFS tables, user databases, Hub/DMZ/role tables,
`mfs_init_folders` or `desk_create_hub`. Static checks also reject provisioning
in the runtime and MFS/Hub/Team/filesystem calls in the bootstrap.

## Phase 4.6B module contract

Phase 4.6B uses a private transitional CommonJS module at
`target/modules/system-mfs/`. The control plane remains the lifecycle owner:
installing the module creates only module-owned schema, while provisioning is
an explicit request for one organisation/principal context.

The public lifecycle operations are deliberately separate:

```text
install()                       mutating, module schema only
validate_installation()        read-only installation inspection
provision({ organisation_id,
            principal_id })    mutating, explicit and idempotent
validate_provisioning(context) read-only context inspection
capability_available(context)  deterministic installed/provisioned answer
```

Installation never enumerates or provisions Drumates. Provisioning requires an
existing, unambiguous principal in the requested organisation and never creates
or repairs a platform identity. Validation never installs schema, repairs a
namespace or creates filesystem state.

The authoritative capability state is the module-owned
`system_mfs_provisioning` registry in the Yellow Page database. It records the
organisation, principal, per-context database, stable root identifier, schema
version and lifecycle status. Its state is cross-checked against the actual
context database, tables, routines, root row and owner permission. Therefore
`entity.db_name`, `entity.home_dir` and `entity.home_id` are never capability
signals. The Phase 4.6A placeholder values remain unchanged; the MFS database
locator lives in the MFS registry.

The deterministic states are:

```text
not-installed        module installation marker/schema absent
installed            module installed, context has no registry or database
provisioning          incomplete mutation; not capability-available
provisioned           registry and complete namespace agree
partial               registry/database/object state is incomplete
conflicting           identity, locator, version or root state disagrees
```

Provisioning writes `provisioned` only after the context namespace validates.
An interrupted or failed operation remains explicitly non-ready and is not
silently repaired or destructively rebuilt. Repeating a valid provisioning
request is a no-op and preserves the database and node identifiers.
When a runtime database account is configured on the provisioning adapter, the
module grants that account only context-database DML and routine execution;
this access grant is part of provisioning, not runtime startup.

## Historical MFS dependency closure and selected slice

The historical factory path creates a database per Drumate, loads the large
Drumate factory template, initializes MFS folders, creates filesystem paths and
then often creates Hubs. That full path is not the MFS core. The selected slice
retains the historical per-principal database and `media`/`permission` namespace
model, root ownership, `mfs_init_folders`, `mfs_make_dir`, node resolution and
child listing. The procedures are reduced only where the current historical
versions have acquired dependencies outside this slice.

| Historical object/path | Direct and transitive dependencies | Classification | Phase 4.6B decision |
|---|---|---|---|
| `common/tables/media.sql` | Node identity, parent/path hierarchy and metadata | `SYSTEM_MFS_CORE` | Extract the compatible table shape needed by folders and listing. |
| `common/tables/permission.sql`, owner grant | Principal and root/node permission | `SYSTEM_MFS_CORE` | Extract root ownership only; sharing policy is excluded. |
| `mfs_make_dir` | `media`, path normalization, `yp.uniqueId()` and node attributes | `SYSTEM_MFS_CORE`; `uniqueId()` is `RUNTIME_INTRINSIC` | Extract with the same path/idempotency semantics and a module-local node result. |
| `mfs_init_folders` | Root lookup and `mfs_make_dir` | `SYSTEM_MFS_CORE` | Extract; no default principal is provisioned automatically. |
| `mfs_show_node_by` | `media`; current version also reaches `yp.entity`, Hub/vhost, DMZ, `user_permission`, `user_expiry`, `mfs_changelog` and `mfs_ack` | Core listing plus `HUB_CAPABILITY`, `TEAM_COMPATIBILITY`, and `OPTIONAL` notification state | Extract only direct-child MFS listing semantics. Exclude Hub/DMZ/new-file decoration. |
| `mfs_changelog`, `mfs_ack` | Global event stream, per-user read cursor and current listing decoration | `OPTIONAL` | Excluded from the minimal namespace. |
| `mfs_trash_init` | Root mutation and hidden trash folder through `mfs_make_dir` | `OPTIONAL` | Excluded; trash is not needed for root/create/resolve/list proof. |
| `Drumate.initFolders()` | Per-user database plus `mfs_init_folders` | `SYSTEM_MFS_CORE` orchestration | Replaced by explicit module provisioning, not identity bootstrap. |
| `drumate_create`, factory database creation | Factory pool, entity/vhost mutation, large Drumate template, MFS, chat, acknowledgement and filesystem paths | Mixed `PLATFORM_BOOTSTRAP`, `SYSTEM_MFS_CORE`, `TEAM_COMPATIBILITY`, `LEGACY` | Not reused. Platform identity already exists; the module creates only its context database. |
| `Drumate.createHub()` / `desk_create_hub` | Hub entity/database, vhost, Hub membership, storage and permission policy | `HUB_CAPABILITY` | Excluded completely. |
| Physical storage-root creation | Configured production MFS root and host filesystem | `OPTIONAL` for the folder-only slice | Excluded. Folder nodes in this slice require no physical payload directory. |
| Finder/media service layer | HTTP operations, UI behavior and broad media workflows | `FINDER` | Excluded. |
| Team rooms, DMZ, chat, conference and tasks | Distribution policy and collaboration schemas | `TEAM_COMPATIBILITY` | Excluded. |

This is an intentional compatibility cut, not a new filesystem design: the
vertical proof executes extracted SQL against a real MariaDB namespace using
the historical root → folder → resolve/list model.

## Capability dependency contract

Backend descriptors may declare a flat `requires` array. The runtime checks
those names through an injected capability resolver after service authorization
and before worker loading. It does not know how MFS is installed and
never installs or provisions a capability. Missing installation and missing
context provisioning fail with a deterministic `CAPABILITY_UNAVAILABLE` error
that names `system-mfs`. No version solving, recursive installation or package
management is introduced.

## Validated Phase 4.6B boundary

`system-mfs` is a system/kernel module, not intrinsic runtime. It may require
organisation `1`, nobody, guest and system as preconditions, but must not create
them. The kernel remains independently bootable without MFS. A declared MFS
dependency fails deterministically when unavailable through the contract above.

Phase 4.6A adds no MFS, Hub/resource ACL, storage, Finder, Window Manager,
Marketing, generic provisioning engine, module lifecycle framework, npm
publication, ESM migration, Team migration or deployment packaging.

## Integration evidence and closure

The disposable Phase 4.6B test performs the complete lifecycle:

```text
runtime schemas + Phase 4.6A bootstrap
→ kernel boot and anonymous bootstrap.authn with canonical nobody
→ no system-mfs tables or context databases
→ MFS-dependent descriptor fails with CAPABILITY_UNAVAILABLE
→ module-relative installation, repeated without mutation
→ explicit provisioning of the selected system test principal
→ stable root ownership and unchanged identity placeholders
→ mfs_make_dir + mfs_node_attr + mfs_show_node_by
→ the same dependent service succeeds
→ runtime restart
→ persisted capability validation and no-op repeated provisioning
```

Focused tests also cover read-only validation, partial and conflicting states,
failed provisioning, stable identifiers, manifest isolation and forbidden
dependency absence. Phase 4, Phase 4.4, Phase 4.5 and Phase 4.6A integration
regressions pass. The standalone `server-runtime` repository and npm release
were not modified; extraction of the generic capability resolver belongs to a
later runtime release milestone.

Phase 4.6 is therefore `CLOSED / VALIDATED`. The next work is Phase 5 Marketing
only after explicit authorization.
