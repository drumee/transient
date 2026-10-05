# Phase 4.9 — Finder stabilization and standalone extraction

Status: **IN PROGRESS — contract freeze passed; extraction pending**

## Opening baselines

Recorded before modification on 2026-10-05:

| Repository | Branch | HEAD | Opening status |
|---|---|---|---|
| transient | `refactor/mapping` | `2033335491d84b1dc07a5b36bc18de17f9affaba` | authoritative Phase 4.9 specification untracked |
| server-runtime | `main` | `d17ecee8c645f1d14a7e2ef45a2f3542a27c0763` | clean |
| system-mfs | `main` | `a7f7395bdbc79560aed072219b87c0b81c004bce` | clean |
| window-manager | `main` | `e294979dfcb59f73af19975e40f890a0b366cd8c` | clean |
| ui-runtime | `main` | `5366d904356b414e87848a0bc8870b612e6c748a` | clean |

The preferred `/home/somanos/github/finder` repository did not exist.

## Real-use stabilization

The opening Phase 4.8 validation passed: 41 focused tests, four real Nginx
download/media/binary-upload tests, and nine standalone system-mfs tests.

The real runtime/Chromium fixture then exercised standalone and managed
Finder mounting, two FinderWindow instances, independent histories and
selections, forward/back/up/clickable breadcrumb navigation, a bounded
250-item grid, checkbox and forward/reverse marquee selection, same-hub MOVE,
cross-hub COPY, direct folder-tile drop, binary upload chunks, offline download
retrieval URLs, explicit media representation URLs, remote rename/remove,
current-folder invalidation, reconnect reconciliation, repeated destroy and
remount, and host-owned transfer-controller lifetime.

Reproduced defects and fixes:

- forward navigation was absent; instance-local forward traversal was added;
- open-folder rename events were not routed; MfsSync now matches the current
  logical node as well as parent scopes;
- download retrieval URLs were converted into empty Blob downloads; Finder now
  delegates the URL to FileIo/Nginx and rejects returned archive bytes;
- failed retrieval left a server artifact active; release now runs in `finally`;
- invalid upload geometry could leave active transfer state; validation now
  precedes active-state ownership;
- selected metadata could remain stale after a remote rename; canonical item
  replacement now updates selection;
- destruction and reconnect reconciliation were not explicitly idempotent or
  coalesced; owned listeners, observers, sync registration and controllers now
  have bounded cleanup;
- direct folder-tile drop was missing; it now uses the unchanged MOVE/COPY
  policy and rejects self-destination before backend ACL/cycle enforcement.

No backend, ACL, SQL, system-mfs, server-runtime, Window Manager, ui-runtime,
or generic `stop()` change was required.

## Contract freeze

The extraction gate is satisfied by
`target/modules/finder/CONTRACTS.md`. It freezes construction/dependencies,
`{hub_id,nid}` locations, the public node, service/media/transfer clients,
MfsSync events, FinderWindow interaction, and the resource ownership map.

The frozen dependency direction is:

```text
@drumee/ui-runtime <- Finder core -> logical runtime/service transports
@drumee/window-manager <- FinderWindow adapter -> Finder core
```

Production Finder has no physical storage, database, SQL, server-runtime,
system-mfs, Desk, Team, or backend implementation dependency.

## Deferred interaction scope

Modifier/range selection, full keyboard file-manager navigation, alternative
list modes, large context menus, rich conflict UX, undo, trash/restore UI,
sharing, Team/Chat integration, Hub administration, and Desk/global ownership
remain deferred. Backend-enforced ancestor-cycle detection remains authoritative.

## Extraction and closure

Standalone repository/package evidence, packed consumer validation,
reintegration results, full regressions, final heads and closure status will be
appended only after the sequential extraction gate completes.

