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
- `mfs-service` owns validation after runtime authorization, filesystem
  orchestration and recipient-safe mutation publication through an injected
  runtime transport adapter. Its narrow permission backend exposes logical
  resources and effective permission; it is not an ACL authority.
- `mfs-transfer` owns bounded resumable upload sessions, sparse staged payloads,
  integrity checks, offline archive jobs and requester-scoped progress. It has
  no direct dependency on `system-mfs` and never keeps a completed upload or
  archive Buffer.
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
resume. Upload metadata travels through the bounded structured service path;
chunk bytes travel through a separate bounded binary HTTP path. Runtime Input
first streams each body to a private tempfile, then `mfs-transfer` copies it to
the server-owned offset in one sparse staged payload. The completed payload is
authorized by `mfs-service` and atomically adopted by `system-mfs.commitFile`
into canonical storage before the normal `node.created` event is published.

Downloads accept canonical multi-root identities. The runtime ACL authorizes
every root, `mfs-service` asks `system-mfs` for a recursive manifest, and
`mfs-transfer` starts a finite offline archive process using host-filesystem
references. The ZIP remains a filesystem artifact. Retrieval re-enters runtime
ACL, preserves requester ownership, and delegates delivery through FileIo,
`X-Accel-Redirect` and Nginx. Progress, status, cancel, retrieve and release
remain requester-scoped; transfer progress is not MFS synchronization.

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
- recursive mixed multi-root ZIP creation outside the HTTP process,
  asynchronous progress, cancellation, FileIo/Nginx retrieval and release;
- standalone `system-mfs` unit, artifact and disposable-MariaDB validation;
- no Finder dependency on Desk Wm, global selection, Team/Chat or server-side
  `@drumee/system-mfs` in the browser bundle.

Phase 4.9 remains responsible for real-use stabilization, richer interaction
UX and standalone Finder extraction/publication.

## Canonical system-mfs realignment and corrective final closure

Status: **CLOSED / VALIDATED** on 2026-09-30 after the corrective architectural
pass required by `28-phase4.8-corrective-architectural-closure.md`. The canonical standalone
`system-mfs` baseline is `a7f7395bdbc79560aed072219b87c0b81c004bce`;
it was audited and not modified. The standalone runtime correction is
`c4eb77474` with HLS route evidence in `36c8d8075`. The corresponding transient
implementation commits are `561db9347` and `b66d480cb`; progressive-HLS
lifecycle evidence was appended in `e3bb79387`. The final repository HEAD is
reported with the external closure record.

The final backend chain is:

```text
Input → Session.uid()/trusted current hub → descriptor + runtime ACL
      → MFS backend resolves every logical source/destination
      → shard.user_permission() supplies effective privilege
      → runtime compares required/effective → GRANTED or DENIED
      → GRANTED only: mfs-service/mfs-transfer → system-mfs procedures
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
| server runtime ACL | service permission descriptors, required/effective comparison, final GRANTED/DENIED decision, worker-after-GRANTED ordering |
| Yellow Pages/platform | `uniqueId`, `entity`, `vhost`, hub/drumate shard assignment, sessions and trusted identity |
| `Input` | canonical request/header/body/upload normalization and initial tempfile ownership; no authorization |
| `Session` | trusted uid, current hub and host context |
| `mfs-service` | logical source/destination resolution, effective-permission backend, semantic validation after ACL grant, filesystem orchestration, explicit HTTP and WebSocket projection |
| host-filesystem | opaque logical-content/representation to confined physical-artifact mapping; physical paths remain private |
| media-service | invariant original lookup, explicit derived representations, bounded HLS worker and small-playlist control plane |
| `mfs-transfer` | capacity/TTL-bounded resumable state, chunks, offline archive workers, deterministic tempfile ownership and requester-scoped progress |
| `Output` | structured responses, bounded small control artifacts and the final sanitizer barrier |
| FileIo / Nginx | heavy artifact headers/internal redirect and actual byte delivery |

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
| download | every root read, including persistent endpoints | `mfs_enumerate_tree`; offline archive and bounded artifact ownership stay in `mfs-transfer`; FileIo/Nginx deliver bytes |

`user_permission()` is the MFS-specific effective privilege primitive. Tests
cover account-wide, explicit-node, wildcard, nobody normalization, parent
inheritance, `no_traversal` and zero permission. It does not decide which
permission a service requires; descriptors and runtime ACL remain the final
service-level authority.

### Media, filesystem and delivery invariants

`media.orig` resolves only the canonical stored artifact for images, Office
documents and videos. `preview`, `thumb`, `document` and `video` are explicit
allowlisted representations; callers cannot supply a generator or physical
path. Long-form video may start one tracked finite HLS worker per logical node.
Input normalizes only known logical master/stream/segment routes. Node may
process bounded playlists; segments and other heavy media use FileIo/Nginx.

Download preparation uses an offline child plus the external ZIP program. The
HTTP process retains only logical roots, owner, status, expiry, artifact
metadata and a finite worker handle. Fixed job capacity, TTL cleanup,
cancel/failure/release cleanup and shutdown cleanup bound all temporary state.
The generic runtime `stop()` implementation was not changed; its broader
lifecycle review is explicitly deferred.

### Validation record

The final corrective commands all passed from committed implementation heads:

```text
system-mfs:
  npm test                                                        9/9
    includes artifact, procedure-backed disposable MariaDB,
    effective-permission and one-object-per-SQL-file validation

server-runtime:
  npm test                                                       39/39

transient:
  npm test (target/foundation/server-runtime)                    35/35
  scripts/test-env/kernel/phase4.8-validation.sh
    corrective Phase 4.8 unit/integration/browser suite          35/35
    real Nginx ZIP + media.orig data-plane suite                   2/2
    standalone system-mfs suite                                   9/9
  node --test phase4.6b + phase4.7 regressions                     3/3
  (standalone window-manager) npm test                             6/6
```

The Nginx test validates an actual ZIP signature/content and an unchanged
2 MiB original media artifact at the client. Unit/integration evidence also
proves `X-Accel-Redirect`, no whole-archive Node Buffer, worker-not-called on
DENIED, trusted `Session.uid()`, multi-source/cross-hub ACL, cleanup on
cancel/failure/release/expiry, and HLS playlist/segment routing.

This corrective closure made no change under `sources/**` or `system-mfs`,
published no npm package, preserved generic `stop()` unchanged and did not
start Phase 4.9.

## Upload data-plane corrective closure

Status: **CLOSED / VALIDATED** after the focused upload correction. This pass
did not reopen Phase 4.8 and did not change download, media, HLS, Finder
semantics outside upload transport, or generic runtime `stop()`.

The final upload boundary is deliberately split:

```text
metadata/control
    -> bounded structured request (64 KiB remains enforced)
    -> trusted Session.uid()
    -> runtime ACL against the logical destination

binary bytes
    -> application/octet-stream request
    -> ACL and transfer-owner preflight
    -> bounded streaming Input receiver
    -> server-generated private tempfile
    -> exact-offset write into one sparse staged payload
```

The server chooses and returns the upload chunk size and enforces both that
geometry and an independent maximum chunk size. Index, offset, actual tempfile
length, expected final-chunk length and bounded chunk count are validated
server-side. Finder passes a Blob directly to the granular `uploadBinary()`
transport; production upload code no longer calls `arrayBuffer()` or serializes
`Array.from(Uint8Array(...))` into JSON.

`mfs-transfer` preallocates one staged payload, accepts chunks in any order,
writes each chunk at `index * chunk_size` with stream backpressure and records
accepted byte lengths by index. Repeated indexes safely overwrite the same
range. `upload_status` exposes only bounded public metadata: transfer id,
status, received indexes, declared size and chunk size. It exposes neither
tempfile nor staging paths.

On completion, every expected index and the staged size are checked. Requested
SHA-256 integrity is computed by streaming the staged file sequentially, never
from chunk arrival order and never by buffering the complete payload. An
internal `payload_ref` then crosses the existing boundary:

```text
mfs-transfer -> mfs-service.commitUpload() -> system-mfs.commitFile()
```

The client cannot submit `payload_ref`. Canonical content survives successful
adoption while transfer staging and the reference are invalidated. Incoming
Input tempfiles transfer ownership exactly once and are deleted after adoption
into staging; rejection, abort, stream failure, bad geometry, hash mismatch,
commit failure, transfer abort, TTL expiry and shutdown clean their owned
temporary resources. Runtime ACL remains the final GRANTED/DENIED authority
and is re-evaluated by normal dispatch; transfer ownership is an additional
check based on trusted `Session.uid()`.

The real integration path starts an upload over JSON, sends a multi-chunk
payload through actual HTTP binary bodies (including chunks larger than 64
KiB), delivers chunks out of order, resumes, repeats a chunk, completes through
canonical system-mfs adoption, and retrieves byte-identical content through
the unchanged media.orig/FileIo/Nginx path. A body larger than the server
maximum is rejected with cleanup. Runtime tests separately prove the JSON
limit remains effective, the binary path bypasses JSON parsing, authorization
and ownership preflight prevent worker/body processing, interrupted bodies
remove partial tempfiles, and internal paths are absent from public output.
