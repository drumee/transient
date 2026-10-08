# Provenance

Phase 4.8B is a new application-neutral control-plane capability derived from
the verified lifecycle gap, not a copy of Team provisioning.

- Yellow Page `entity`, `uniqueId()` and Hub ownership semantics are traced to
  pinned `sources/schemas` and `sources/setup-schemas` evidence.
- Hub ACL bits and cumulative words are injected from the pinned current
  `sources/server-essentials/lib/lex/constants.js` contract. Historical
  `server-core/lib/acl.js` and Hub/MFS `user_permission`, `permission_grant`,
  `permission_revoke`, `permission_set` and `change_owner` implementations
  establish the `granted privilege & requested permission` evaluation and the
  admin-gated ACL-management boundary.
- The implementation deliberately separates shard allocation, ACL and durable
  plans from historical `desk_create_hub`, filesystem and Team policy.
- The module manifest normalization extends existing Drumee
  `SCHEMA_MANIFEST.json` inventories without introducing `capacities.json`.
- `system-mfs` remains an external trusted provisioner for an already assigned
  shard; no MFS SQL is owned here.
