# Phase 4.9 — Finder stabilization and standalone extraction

Status: **CLOSED / VALIDATED / STANDALONE PUBLISHED** on 2026-10-05.

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

The extraction gate was satisfied by the transitional contract freeze now
preserved as `/home/somanos/github/finder/CONTRACTS.md`. It freezes construction/dependencies,
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

## Standalone extraction

The frozen subtree was extracted with history to:

```text
/home/somanos/github/finder
branch: main
HEAD: 730aa30 (fix: converge optimistic moves with committed sync)
package: @drumee/finder@0.1.0-alpha.1
```

Core exports are deliberately limited to `Finder`, `FinderTransferPolicy`,
`MediaClient`, `MfsClient`, `MfsSync`, `MfsTransferClient`, and
`registerFinderKinds`. `FinderWindow` is exported only from
`@drumee/finder/window`. `@drumee/ui-runtime >=0.1.0-alpha.2 <0.2.0` is a peer;
`@drumee/window-manager` has the same range and is an optional peer.

The package contains browser capability code, skeletons, skin and documents.
It contains no backend implementation, SQL, server-runtime, system-mfs,
FileIo, host-filesystem, media generator or archive worker. The packed clean
consumer resolves only declared package entries, mounts both core Finder and
FinderWindow in Chromium, and rejects transient/historical/backend modules in
the Webpack graph.

During the initial Phase 4.9 execution, the preferred GitHub repository did
not exist and an authorized creation attempt failed because the available
GitHub credential lacked `CreateRepository` permission. That external action
was subsequently resolved. The canonical standalone repository is now
publicly available at `https://github.com/drumee/finder`, its default branch is
`main`, and that branch resolves to
`730aa309939f956d76f70beeed5d9e46846c0574`. No repository creation or history
rewrite was performed during the post-closure verification.

## Reintegration

Transient commit `a1e08d44e` removes `target/modules/finder` and points kernel
validation at the standalone source boundary (overridable with
`KERNEL_FINDER_ROOT`). No second production Finder implementation remains.
Commit `7bc3c6c24` proves an optimistic same-hub MOVE is visible before service
completion, the committed sync echo creates no duplicate, and pending
operation state returns to zero. Cross-hub COPY remains server-committed
because the backend assigns destination identities.

## Final validation

All results below are from the extracted/reintegrated boundary:

| Suite | Result |
|---|---:|
| standalone Finder, including packed browser consumer/bundle boundary | 19/19 |
| standalone server-runtime | 43/43 |
| standalone ui-runtime | 26/26 |
| standalone Window Manager | 6/6 |
| transient server-runtime | 39/39 |
| transient mfs-transfer | 7/7 |
| Phase 4.9/4.8 focused unit/integration/browser validation | 46/46 |
| real Nginx ZIP, `media.orig`, binary upload and oversize rejection | 4/4 |
| standalone system-mfs artifact/filesystem/MariaDB/SQL suite | 9/9 |
| Phase 4.6B and Phase 4.7 regression suite | 3/3 |

The Finder browser scenario includes a 250-row paginated directory with five
structural children, one shared preview observer per Finder, explicit
near-viewport representation URLs, one shared MfsSync binding, reconnect
refresh coalescing, five repeated mount/destroy cycles, idempotent double
destroy and zero leaked Finder registrations. Upload chunks remained bounded
`Blob` values; archive bytes never entered Finder or Node HTTP memory.

Security validation retained trusted `Session.uid()`, runtime ACL decisions,
transfer ownership, recipient-safe sync, allowlisted media representations,
logical public identities and private physical paths. Backend authorization
continues to enforce destination permission and ancestor-cycle safety.

## Package evidence

Final `npm pack --ignore-scripts --json` result:

```text
filename:       drumee-finder-0.1.0-alpha.1.tgz
packed size:    18,853 bytes
unpacked size:  69,363 bytes
file count:     27
sha1:           bfd8a4fbf49591aef285f3da8a87e34bf039a638
sha512:         7+T1wF5G+Kyjr4ZuXmwN7xzZfhdZmGsIiPXz7BEPhLr/DKiCUxOapYU0AoBrUBeUrfTSTf4C59khXxtsEViDww==
```

## Post-closure standalone publication

The separately authorized release action published the already validated
artifact from Finder Git HEAD
`730aa309939f956d76f70beeed5d9e46846c0574` to the public npm registry:

```text
package:         @drumee/finder@0.1.0-alpha.1
registry:        https://registry.npmjs.org/
published:       2026-10-05T15:15:54.966Z
intended tag:    next = 0.1.0-alpha.1
registry tags:   next = 0.1.0-alpha.1
                 latest = 0.1.0-alpha.1
sha1:            bfd8a4fbf49591aef285f3da8a87e34bf039a638
sha512:          7+T1wF5G+Kyjr4ZuXmwN7xzZfhdZmGsIiPXz7BEPhLr/DKiCUxOapYU0AoBrUBeUrfTSTf4C59khXxtsEViDww==
```

The registry-reported `gitHead`, file count, unpacked size, shasum and
integrity match the validated Phase 4.9 artifact exactly. npm reports both
`next` and `latest`; the intended prerelease channel is `next`, and no tag was
manipulated after publication.

A clean temporary consumer installed `@drumee/finder@next`,
`@drumee/ui-runtime@0.1.0-alpha.2`, and
`@drumee/window-manager@0.1.0-alpha.2` exclusively from npm. Both Finder entry
points resolved under that consumer's `node_modules`. Its Webpack bundle
contained no transient, backend, system-mfs or historical Team dependency;
headless Chromium mounted core Finder and FinderWindow and released both sync
registrations during destruction.

This release changes distribution state only. It does not reopen Phase 4.9 or
alter Phase 4.8 architecture.

## Repository heads and invariants

Validated implementation heads before this closure record:

```text
transient       7bc3c6c24  refactor/mapping
finder          730aa30    main
ui-runtime      5366d904356b414e87848a0bc8870b612e6c748a  main
window-manager  e294979dfcb59f73af19975e40f890a0b366cd8c  main
server-runtime  d17ecee8c645f1d14a7e2ef45a2f3542a27c0763  main
system-mfs      a7f7395bdbc79560aed072219b87c0b81c004bce  main
```

`sources/**` is unchanged. `server-runtime`, `system-mfs`, `ui-runtime`, and
Window Manager required no commits. Generic runtime `stop()` is unchanged.
Phase 4.8 ACL, session, permission, upload, download, media/HLS,
host-filesystem, FileIo/Nginx and SQL ownership/granularity architecture is
preserved.

All mandatory Phase 4.9 closure conditions are satisfied. The external GitHub
repository follow-up recorded during initial closure is resolved: the public
`drumee/finder` repository, default branch `main`, contains canonical Finder
HEAD `730aa309939f956d76f70beeed5d9e46846c0574`.
