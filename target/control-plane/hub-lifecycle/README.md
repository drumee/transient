# Phase 4.8B Hub lifecycle (transitional)

This private CommonJS workspace hosts the transitional generic Hub control
plane. It is not a final public package or repository boundary and must not be
published. It owns Hub lifecycle, Yellow Page registration, shard assignment,
Hub ACL, immutable schema plans and resumable module provisioning. It owns no
MFS or application SQL.

## Public creation contract

```js
await lifecycle.createPrivateHub({
  session,                 // trusted, fully authenticated server session
  creator_module,          // established by the server route/module
  specification: {
    idempotency_key,       // scoped to organisation + principal + module
    name
  }
});
// => { hub_id, status }
```

The public specification rejects shard/database hosts, credentials, filesystem
paths, `creator_module` and `inherit`. Reusing a key with the same request
returns the same Hub. Reusing it with different public attributes fails with
`HUB_IDEMPOTENCY_CONFLICT`.

The internal resolver accepts `{hub_id,uid,organisation_id,permission,
capabilities}` and returns the physical descriptor only after authentication,
organisation, entity type, shard existence, ACL and capability-readiness
checks. `write` implies `read`; `read` does not imply `write`. The creator gets
read+write. Further grants require an already authorized write context.

## Canonical schema manifest

New modules place their only schema manifest at:

```text
server/schemas/SCHEMA_MANIFEST.json
```

Existing package metadata, schema versions, migrations, ordered inventories
and checksums remain authoritative. Phase 4.8B adds:

```json
{
  "inherit": "own",
  "requires": ["system-mfs"]
}
```

Missing `inherit` means `installed`; missing `requires` means `[]`.
`installed` selects every installed and active Hub contributor plus the creator.
`own` selects the creator and the transitive closure of its requirements.
Only the creator's `inherit` is evaluated. Dependencies must already be
installed and active; they are never enabled implicitly.

An optional requirement object may pin the dependency's existing
`schemaVersion`, for example `{ "module": "system-mfs", "schemaVersion":
"phase4.8-system-mfs-2" }`. This reuses the existing manifest version and does
not create a competing version system.

Hub contributions are ordered `provision`/`migrations`/`install` entries whose
target is `hub`, or legacy entries whose `schemaClass` is `common`/`hub`.
`yellow-page`, `platform`, `principal` and `drumate` targets are not propagated
to Hub shards. Object keys are ownership claims; different modules cannot
claim the same target/type/name.

Legacy `schemas/SCHEMA_MANIFEST.json` is accepted read-only during migration.
This is how the current standalone `system-mfs` artifact participates: its
missing fields normalize to `installed` and `[]`, and its `common` provision
inventory is a Hub contribution. New fixtures demonstrate the canonical path.

## Durable execution

The SQL registry persists the request key, Hub/entity row, private shard
locator, ACL, creator/policy, immutable plan snapshot, artifact/checksum
references, per-capability target/applied version, attempt/error and object
ownership. A plan never changes after creation. Registry changes create later
upgrade plans.

Handlers are trusted functions registered from installed server modules. They
receive an internal authorized descriptor and must be idempotent across a
crash after SQL success but before the control plane records success. Successful
steps are skipped. Failure preserves the Hub, shard, completed capabilities and
data; retry continues the same plan on the same shard.

Existing Hubs remain usable during upgrades for capabilities already `ready`.
Services requiring the currently failing/new capability are denied. Removal or
deactivation never drops schema or data. `installed` Hubs receive newly active
Hub contributors through paginated upgrade plans; `own` Hubs follow only their
creator/dependency closure. If the creator is unavailable, planning fails
closed while already-ready data remains intact.
