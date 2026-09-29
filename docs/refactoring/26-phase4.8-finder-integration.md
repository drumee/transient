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
