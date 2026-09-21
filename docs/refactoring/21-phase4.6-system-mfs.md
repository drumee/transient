# Phase 4.6 — platform bootstrap contract and system-mfs

Phase 4.6 is in progress after the closed Phase 4.5 exportability lock.

```text
4.6A platform bootstrap implemented and validated
4.6B system-mfs remaining and not authorized
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

## Remaining Phase 4.6B boundary

`system-mfs` is a system/kernel module, not intrinsic runtime. It may require
organisation `1`, nobody, guest and system as preconditions, but must not create
them. The kernel remains independently bootable without MFS. A future declared
MFS dependency must fail deterministically when unavailable; its contract is
deferred to the explicitly authorized Phase 4.6B implementation.

Phase 4.6A adds no MFS, Hub/resource ACL, storage, Finder, Window Manager,
Marketing, generic provisioning engine, module lifecycle framework, npm
publication, ESM migration, Team migration or deployment packaging. Phase 4.6B
must not start without explicit authorization.
