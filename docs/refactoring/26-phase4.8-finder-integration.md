# Phase 4.8 — Finder integration

Status: **implemented and validated** on 2026-09-29. This phase integrates a
real Finder but does not extract or publish a standalone Finder package.

## Fixed evidence baseline

Historical behavior was recovered only from the authorized snapshots:

```text
ui-team      17d1d4a03a135c33b44bbb22054fa2d140bbc1a6
server-team  7fb16c449ed09258c501e88e3c87a4d71c51a941
```

Both snapshots were imported with subtree history and are recorded in
`SOURCE_MANIFEST.md`. Production code was decomposed rather than copied from
the historical composite folder window, media core, transfer services or Desk
Window Manager.

## Implemented boundaries

```text
FinderWindow → Finder → MfsClient → mfs-service → system-mfs
                       └→ MfsSync ← runtime.Websocket
Finder → transfer controllers → MfsTransferClient → mfs-transfer
                                                 → mfs-service
                                                 → system-mfs
```

- `Finder` is a real LETC widget and owns `{hub_id,nid}` location, navigation,
  listing, selection, marquee, optimized items, drag/drop, synchronization and
  transfer entry points. Its main entry has no Window Manager import.
- `FinderWindow` is a separate thin adapter around
  `@drumee/window-manager@0.1.0-alpha.2`; it projects Finder title state and
  owns no MFS semantics.
- structural UI and progress views use Skeletons; repeated directory tiles are
  raw delegated HTML owned by `ItemList`.
- `MfsClient` and `MfsTransferClient` expose separate semantic APIs.
- `MfsSync` binds once to `runtime.Websocket`, routes recipient-safe deltas by
  current `{hub_id,nid}` scope, suppresses duplicate operation echoes and
  reconciles open scopes after reconnect.
- `mfs-service` owns validation, principal context, operation authorization,
  filesystem orchestration and recipient-safe mutation publication through an
  injected runtime transport adapter.
- `mfs-transfer` owns temporary chunks, resumable sessions, integrity checks,
  archive jobs and requester-scoped progress. It has no direct dependency on
  `system-mfs`.
- the standalone `system-mfs` working tree owns generic filesystem primitives
  and canonical-content adoption. No second implementation remains under
  `target/modules/system-mfs`.

## Finder interaction and performance

`FinderSelection` is the only selection authority for item clicks, delegated
checkboxes, marquee membership and drag payloads. Marquee selection uses a
five-pixel threshold, normalized rectangles, lazy cached item bounds and only
mutates membership on boundary crossings. Bounds are invalidated by scrolling,
resize, navigation and listing replacement.

The first page is bounded to 100 items and subsequent pages are explicit.
`ItemList` renders dense tiles without a Widget per item, delegates tile and
checkbox events, and uses a shared `IntersectionObserver` for near-viewport
preview activation. Browser validation renders 250 deterministic entries while
the Finder retains only five structural children, including two optional
transfer-progress widgets.

Finder-to-Finder dragging derives its entire payload from the source Finder's
selection. Equal hubs invoke MOVE; different hubs invoke COPY. Window drag and
resize remain owned by Window Manager and do not activate Finder marquee.
Dropping onto the displayed Finder content is the required Phase 4.8 target;
the richer direct-on-folder-tile workflow remains deferred to Phase 4.9.

## Transfers

Upload scanning fully materializes a `BundleEntry` forest before network work.
Multiple folders and loose files can share one operation; explicit empty
directories survive. Directory creation is parent-first, file and chunk work
is bounded, failed chunks retry, and existing chunk indexes support session
resume. Temporary bytes are assembled by `mfs-transfer`, authorized by
`mfs-service`, and atomically adopted by `system-mfs.commitFile` into canonical
storage before the normal `node.created` event is published.

Downloads accept canonical multi-root identities. `mfs-service` authorizes the
roots and asks `system-mfs` for a recursive manifest; `mfs-transfer` alone
builds and serves the ZIP. Small jobs complete inline, larger jobs expose
requester-only progress, status, cancel, retrieve and release operations.
Transfer progress is not sent through MFS synchronization.

`removeNode` is an authorized hard filesystem delete. Trash, restore,
retention, changelog and acknowledgement remain excluded.

## Validation evidence

The Phase 4.8 suites prove:

- standalone Finder mounting and managed FinderWindow mounting with the real
  standalone UI runtime and Window Manager in Chromium;
- navigation/back/up, title projection, bounded grid rendering, checkbox and
  forward/reverse marquee selection, multi-item marquee and checkbox drags,
  same-hub move, cross-hub copy, window drag/resize isolation and destruction;
- two independent real runtime WebSocket clients, multiple Finders, scoped
  create/rename/remove/move/copy/upload deltas, idempotent echo handling and
  reconnect reconciliation;
- real server-runtime descriptor dispatch for `mfs-service` and
  `mfs-transfer`;
- mixed recursive upload with empty directories, bounded chunk concurrency,
  retry/resume, progress, cancellation, integrity failure cleanup and canonical
  commit;
- recursive mixed multi-root ZIP creation, asynchronous progress, cancellation,
  retrieval and release;
- standalone `system-mfs` unit, artifact and disposable-MariaDB validation;
- no Finder dependency on Desk Wm, global selection, Team/Chat or server-side
  `@drumee/system-mfs` in the browser bundle.

Phase 4.9 remains responsible for real-use stabilization, richer interaction
UX and standalone Finder extraction/publication.

## Canonical system-mfs realignment and final closure

Status: **CLOSED / VALIDATED** on 2026-09-30. The canonical standalone
`system-mfs` baseline is `a7f7395bdbc79560aed072219b87c0b81c004bce`;
the corresponding transient integration baseline is
`95b142a400c009cec4b65553f148151d6b412fa9`. The documentation commit containing
this closure is the final transient Phase 4.8 HEAD and is reported with the
external closure record.

The final backend chain is:

```text
Input → Session.uid()/trusted current hub → service ACL
      → resolved entity/vhost shard → shard.user_permission()
      → GRANTED → mfs-service/mfs-transfer → system-mfs procedures
      → explicit public DTO → Output/sanitize → HTTP/WebSocket
```

Public MFS identity remains `{hub_id,nid}`. `db_name`, `db_host`, `fs_host`,
`home_dir`, `mfs_root`, `storage_ref` and transfer `payload_ref` are internal.
The client cannot replace Session uid with `uid`, `principal_id`, `owner_id` or
`user_id`. A missing identity resolves to canonical nobody; validated token
identities are consumed through the same server-owned `Session.uid()` contract.
When a public resource omits `hub_id`, only Session's trusted current hub may
fill it. Provisioning accepts `{hub_id}` or trusted `{host}`, resolves
`entity`/`vhost`, and installs into the existing hub or drumate shard. It never
derives or creates `mfs_<principal_id>` databases.

### Ownership map

| Owner | Objects/responsibility |
|---|---|
| `system-mfs` | `media`, `permission`, `mfs_clean_path`, `parent_permission`, `user_permission`, `user_expiry`, tree procedures, shard provisioning, filesystem transactions, canonical-content adoption |
| server ACL | service permission descriptors, source/destination resource resolution, final GRANTED/DENIED decision |
| Yellow Pages/platform | `uniqueId`, `entity`, `vhost`, hub/drumate shard assignment, sessions and trusted identity |
| `Input` | canonical request/header/body/upload normalization and initial tempfile ownership; no authorization |
| `Session` | trusted uid, current hub and host context |
| `mfs-service` | semantic validation after ACL grant, filesystem orchestration, explicit HTTP and WebSocket projection |
| `mfs-transfer` | resumable transfer state, chunks, archives, deterministic tempfile ownership and requester-scoped progress |
| `Output` | all normal structured HTTP responses and the final sanitizer barrier |

`acl_check`, `acl_array_check_next` and service policy remain server-owned.
`permission_grant`, `permission_revoke`, `permission_set` and `permission_tree`
remain permission-administration dependencies rather than duplicated MFS
authorities. `filecap`, `disk_usage`, trash, changelog, search, acknowledgement,
DMZ and Team policy remain excluded.

### SQL file/object map

Every module-owned SQL file defines exactly one object and appears once in
deterministic manifest order. Common SQL applies to both hub and drumate
shards; both class-specific overlay lists are explicit and currently empty.

| Schema class | Object type | Object/file |
|---|---|---|
| yellow-page | table | `system_mfs_installation` — `schemas/yellow-page/tables/system_mfs_installation.sql` |
| yellow-page | table | `system_mfs_provisioning` — `schemas/yellow-page/tables/system_mfs_provisioning.sql` |
| common | table | `media` — `schemas/common/tables/media.sql` |
| common | table | `permission` — `schemas/common/tables/permission.sql` |
| common | function | `mfs_clean_path` — `schemas/common/functions/mfs_clean_path.sql` |
| common | function | `parent_permission` — `schemas/common/functions/parent_permission.sql` |
| common | function | `user_permission` — `schemas/common/functions/user_permission.sql` |
| common | function | `user_expiry` — `schemas/common/functions/user_expiry.sql` |
| common | procedure | `mfs_create_node` — `schemas/common/procedures/mfs_create_node.sql` |
| common | procedure | `mfs_node_attr` — `schemas/common/procedures/mfs_node_attr.sql` |
| common | procedure | `mfs_make_dir` — `schemas/common/procedures/mfs_make_dir.sql` |
| common | procedure | `mfs_init_folders` — `schemas/common/procedures/mfs_init_folders.sql` |
| common | procedure | `mfs_show_node_by` — `schemas/common/procedures/mfs_show_node_by.sql` |
| common | procedure | `mfs_list_children` — `schemas/common/procedures/mfs_list_children.sql` |
| common | procedure | `mfs_rename` — `schemas/common/procedures/mfs_rename.sql` |
| common | procedure | `mfs_hard_remove` — `schemas/common/procedures/mfs_hard_remove.sql` |
| common | procedure | `mfs_move_nodes` — `schemas/common/procedures/mfs_move_nodes.sql` |
| common | procedure | `mfs_enumerate_tree` — `schemas/common/procedures/mfs_enumerate_tree.sql` |

The former Phase 4.6 monoliths were removed. The automated granularity test
rejects any SQL file with zero or multiple top-level table/function/procedure/
trigger definitions and rejects any unmanifested or duplicate path.

### Operation and authorization map

| Operation | ACL | Execution |
|---|---|---|
| list/get | source read | `mfs_list_children` / `mfs_node_attr` in the resolved shard |
| mkdir/upload commit | destination write | `mfs_make_dir` / `mfs_create_node` |
| rename/hard remove | source delete | `mfs_rename` / `mfs_hard_remove` |
| same-hub move | every source delete + destination write | transactional `mfs_move_nodes` |
| cross-hub copy | every source read + destination write | JS orchestration over source enumeration, destination procedures and canonical-content copy |
| download | every root read | `mfs_enumerate_tree`; archive ownership stays in `mfs-transfer` |

`user_permission()` is the MFS-specific effective privilege primitive. Tests
cover account-wide, explicit-node, wildcard, nobody normalization, parent
inheritance, `no_traversal` and zero permission. It does not decide which
permission a service requires; descriptors and runtime ACL remain the final
service-level authority.

### Validation record

The final clean-baseline commands all passed:

```text
system-mfs:
  node --test test/sql-granularity.test.js                         1/1
  npm test                                                        9/9
  node --test test/mariadb.test.js                                1/1

transient:
  node scripts/check-system-mfs-sync.js                           passed
  node --test target/modules/mfs-service/test/service.test.js
              target/modules/mfs-transfer/test/transfer.test.js   10/10
  node --test tests/integration/kernel/phase4.8-backend-dispatch.test.js
              tests/integration/kernel/phase4.8-transfer-boundary.test.js
              tests/integration/kernel/phase4.8-multi-client-sync.test.js  5/5
  node --test tests/integration/kernel/phase4.8-finder-browser.test.js     1/1
  node --test tests/integration/kernel/phase4.6b-system-mfs.test.js       2/2
  node --test tests/integration/kernel/phase4.7-window-manager.test.js    1/1
```

This closure made no change under `sources/**`, published no npm package and
did not start Phase 4.9.
