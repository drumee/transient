# Phase 4.9 — Finder stabilization and standalone extraction

Phase 4.8 is definitively CLOSED / VALIDATED.

Phase 4.9 is now AUTHORIZED.

This phase has two sequential objectives:

```text
1. STABILIZE FINDER THROUGH REAL KERNEL USE
2. EXTRACT FINDER AS A STANDALONE CAPABILITY
```

Do NOT perform these two objectives in reverse order.

Do NOT extract Finder before its real-use contracts have been exercised and stabilized.

Do NOT reopen Phase 4.8 unless a concrete regression blocks Phase 4.9.

Do NOT publish any npm package unless explicitly authorized in a later instruction.

---

# 1. Canonical baselines

## transient

Repository:

```text
/home/somanos/github/transient
```

Branch:

```text
refactor/mapping
```

Current canonical HEAD at Phase 4.9 opening:

```text
2033335491d84b1dc07a5b36bc18de17f9affaba
```

Phase 4.8 closure record:

```text
docs/refactoring/26-phase4.8-finder-integration.md
```

## standalone server-runtime

Repository:

```text
/home/somanos/github/server-runtime
```

Branch:

```text
main
```

Current canonical HEAD:

```text
d17ecee8c645f1d14a7e2ef45a2f3542a27c0763
```

## standalone system-mfs

Repository:

```text
/home/somanos/github/system-mfs
```

Branch:

```text
main
```

Current canonical HEAD:

```text
a7f7395bdbc79560aed072219b87c0b81c004bce
```

## standalone window-manager

Repository:

```text
/home/somanos/github/window-manager
```

Branch:

```text
main
```

Current canonical HEAD:

```text
e294979dfcb59f73af19975e40f890a0b366cd8c
```

## standalone ui-runtime

Repository:

```text
/home/somanos/github/ui-runtime
```

Branch:

```text
main
```

Current canonical HEAD:

```text
5366d904356b414e87848a0bc8870b612e6c748a
```

---

# 2. Architectural principles

All decisions in Phase 4.9 MUST preserve the Drumee architectural priorities:

```text
1. SECURITY FIRST
2. RESOURCE LIFETIME MUST BE EXPLICIT AND BOUNDED
3. PERFORMANCE AS BEST EFFORT
4. GRANULAR WHEN POSSIBLE
```

Decision order:

```text
security
    ↓
correctness / transactional integrity / bounded lifecycle
    ↓
performance
    ↓
granularity / maintainability
    ↓
convenience
```

Historical Drumee code is architectural evidence, not code to copy blindly.

---

# 3. Phase 4.9 objective

Phase 4.9 must prove that Finder is not merely functional inside the Phase 4.8 integration test environment.

It must prove that Finder is:

```text
usable in realistic kernel scenarios

stable across repeated lifecycle transitions

correct under multi-window use

correct under real transfer/media/sync flows

independent from transient-only implementation details

extractable as a standalone UI capability

re-integrable into the kernel through explicit contracts
```

The phase is therefore:

```text
real use
    ↓
stabilization
    ↓
contract freeze
    ↓
standalone extraction
    ↓
consumer validation
    ↓
kernel reintegration validation
```

---

# 4. Protected Phase 4.8 invariants

Phase 4.9 MUST preserve all validated Phase 4.8 contracts.

Do NOT redesign the following unless a reproducible Phase 4.9 blocker proves a defect:

```text
runtime ACL ownership

Session.uid() trusted identity

system-mfs effective-permission primitive

public MFS identity {hub_id,nid}

logical MFS / host-filesystem separation

media.orig invariant

derived media representations

HLS routing and bounded control-plane handling

FileIo + X-Accel-Redirect + Nginx heavy-data delivery

download offline archive architecture

upload bounded binary data plane

sparse upload staging

payload_ref privacy

MFS sync recipient filtering

one SQL object per file

procedure-first shard-local operations

generic runtime stop() safeguard
```

Phase 4.9 is not an excuse to reopen these designs.

---

# 5. Finder architecture to preserve

Finder is a reusable MFS browsing capability.

It owns:

```text
current logical location {hub_id,nid}

navigation history

breadcrumb

bounded directory listing

FinderItem / item rendering

FinderSelection

SelectionMarquee

checkbox selection semantics

drag source semantics

drop-target semantics

TransferPolicy

MfsClient

MfsSync

upload entry points

download entry points

transfer progress presentation
```

FinderWindow is only the Window Manager adapter.

It owns:

```text
window lifecycle

window chrome

focus

z-order

geometry

move/resize

close/minimize/maximize

title projection
```

Required dependency direction:

```text
@drumee/window-manager
          ▲
          │
    FinderWindow
          │
          ▼
        Finder
          │
          ▼
   runtime/MFS services
```

Forbidden:

```text
Finder → FinderWindow

Finder → @drumee/window-manager

Finder → historical Desk Wm

Finder → global Desk ownership
```

---

# 6. Phase 4.9 is not a feature-expansion phase

Do NOT introduce unrelated products or modules.

Excluded unless strictly required by a reproducible Finder defect:

```text
Team

Chat

Meetings

Notifications

Tasks

Sharing UX

DMZ UI

Hub administration

global Desk ownership

business-specific modules
```

Do not broaden Phase 4.9 into a general Drumee modernization effort.

---

# 7. Step 1 — Real-use stabilization before extraction

Before creating a standalone Finder repository/package, exercise the current Finder implementation in realistic kernel scenarios.

The goal is to find contract/lifecycle defects that isolated tests may not reveal.

Do not manufacture speculative refactors.

Only correct problems supported by:

```text
reproducible runtime behavior

integration-test failure

browser-test failure

resource leak evidence

contract ambiguity

dependency leakage

real lifecycle bug

security or performance regression
```

---

# 8. Required real-use scenarios

Exercise Finder through actual runtime/browser integration for at least the following scenarios.

## Navigation

```text
open root
enter nested folders
back
forward
up
breadcrumb navigation
refresh/reconcile current folder
navigate repeatedly between hubs where supported
```

Verify history remains local to the Finder instance.

---

# 9. Multi-window Finder use

Open multiple FinderWindow instances simultaneously.

Validate:

```text
independent locations
independent navigation histories
independent selections
independent marquee state
independent transfer progress
independent lifecycle
shared runtime WebSocket without duplicated subscriptions
correct title projection
correct window focus/z-order behavior
```

Closing one FinderWindow MUST NOT break another.

---

# 10. Standalone Finder mounting

Mount Finder without FinderWindow.

Prove it can operate in a plain host container with:

```text
ui-runtime
required service transport
MFS clients
sync transport
transfer clients
```

No Window Manager dependency may leak into this mode.

---

# 11. Selection stabilization

Validate current Phase 4.8 semantics:

```text
normal click replaces selection
checkbox toggles membership
marquee uses replacement-style membership
drag payload comes only from FinderSelection
```

Phase 4.9 MAY add carefully bounded stabilization for:

```text
Ctrl/Cmd additive selection
Shift range selection
keyboard selection
```

ONLY if these are implemented as Finder-local behaviors with tests and without reintroducing historical global selection state.

If not required for stabilization, document them as deferred.

---

# 12. Marquee and geometry stabilization

Exercise:

```text
forward marquee
reverse marquee
scroll during/after marquee
resize window
navigation during prior cached bounds
list replacement
layout changes
preview activation/deactivation
```

Preserve:

```text
5 px activation threshold
lazy bounds
bounds invalidation
shared IntersectionObserver behavior
```

Fix stale geometry only if reproduced.

---

# 13. Dense grid performance

Finder uses raw delegated HTML for dense repeated file tiles.

Preserve this exception.

Do not replace every item with a full Widget merely for purity.

Validate with realistically large bounded listings.

At minimum verify:

```text
first page remains bounded
pagination/load-more remains explicit
structural Widget count stays low
delegated events remain correct
preview observer remains shared
selection remains correct under rerender
```

Performance regressions are blockers.

---

# 14. Drag/drop stabilization

Validate:

```text
same-hub Finder → Finder = MOVE
cross-hub Finder → Finder = COPY
multi-selection drag
checkbox-created selection drag
marquee-created selection drag
drop on Finder content
source and destination in different windows
source Finder closed after operation start
sync echo after optimistic operation
```

Current transfer rule remains:

```text
source.hub_id === destination.hub_id
    → MOVE

source.hub_id !== destination.hub_id
    → COPY
```

Do not change this policy in Phase 4.9 unless explicitly authorized.

---

# 15. Direct drop onto folder tiles

Historical mapping deferred richer direct-on-folder-tile behavior to 4.9.

Implement it only if it can be done cleanly within Finder boundaries.

Target:

```text
drag selected items
    ↓
hover/drop on folder tile
    ↓
destination = folder tile {hub_id,nid}
    ↓
TransferPolicy
    ↓
MOVE/COPY
```

Required protections:

```text
cannot drop folder into itself
cannot create ancestor/descendant cycle
invalid destination rejected
destination permission enforced by backend ACL
optimistic UI reconciles with committed sync event
```

If implementation would destabilize extraction, defer with explicit rationale.

---

# 16. Upload real-use stabilization

Exercise the finalized upload architecture through Finder:

```text
single small file
single multi-chunk file
multiple files
multiple folders
mixed folders + loose files
empty nested directories
retry
resume
cancel
upload into different Finder windows
close Finder during active upload
reopen/navigate while transfer remains active
```

Preserve:

```text
bounded structured control plane
application/octet-stream data plane
server-owned chunk geometry
sparse staging
runtime ACL
transfer ownership
bounded concurrency
```

No JSON byte arrays may reappear.

---

# 17. Download real-use stabilization

Exercise:

```text
single file
multiple files
folder
multiple roots
large archive
cancel
release
close Finder during preparation
retrieve after preparation completes
multiple simultaneous downloads
```

Preserve:

```text
offline filesystem archive generation
bounded worker lifecycle
FileIo
X-Accel-Redirect
Nginx data plane
```

Do not return archive Buffers to Finder.

---

# 18. Media representation stabilization

Finder must use explicit representation services.

Validate:

```text
image preview/thumb
media.orig
document preview representation
video representation
HLS where relevant
```

Finder MUST NOT:

```text
derive physical paths
select arbitrary generators
download full originals just to produce normal thumbnails
```

Preview activation should remain near-viewport and bounded.

---

# 19. Sync stabilization

Exercise MfsSync with multiple live clients and multiple Finder instances.

Validate:

```text
create
upload
rename
update
remove
move
copy
```

for:

```text
same Finder
second Finder same folder
second Finder same hub/different folder
different hub
second browser/runtime client
```

Preserve:

```text
recipient-safe events
scope registration using logical MFS identities
operation_id echo suppression
reconnect reconciliation
```

No global broadcast shortcut.

---

# 20. Reconnect behavior

Explicitly test:

```text
WebSocket disconnect
mutations while disconnected
reconnect
Finder scope reconciliation
no duplicate rows
no lost rows
selection remains valid or is safely reduced
```

Reconnection must refresh affected open scopes where required.

---

# 21. Rename/update/remove edge cases

Exercise:

```text
selected item renamed remotely
selected item removed remotely
current folder renamed
current folder removed or becomes inaccessible
item moved out of current folder
item copied into current folder
```

Finder state must remain coherent.

Fail closed when current location becomes unauthorized or unavailable.

---

# 22. Transfer + sync convergence

Optimistic UI and committed sync must converge.

Use `operation_id` / echo identity.

Verify:

```text
optimistic create/move/copy/upload
own committed event arrives
duplicate suppression
remote-client event still applied
failed optimistic operation rolls back/reconciles
```

No double insertion.

---

# 23. Lifecycle stabilization

Exercise repeated:

```text
mount
navigate
start transfer
cancel transfer
close
destroy
remount
```

Validate cleanup for:

```text
DOM listeners
window listeners
runtime WebSocket bindings
IntersectionObserver
ResizeObserver if used
timers
drag state
marquee state
transfer subscriptions
progress listeners
```

Finder destruction must be idempotent.

No Finder-specific listener/subscription should survive destruction unless explicitly shared and reference-counted.

Do NOT redesign generic runtime `stop()`.

---

# 24. Resource ownership map

Before extraction, document ownership explicitly.

At minimum:

```text
Finder
    local navigation/selection/rendering state

FinderSelection
    selected logical items

SelectionMarquee
    pointer geometry interaction

DragController
    active drag lifecycle

TransferPolicy
    MOVE/COPY decision

UploadController
    local upload orchestration

DownloadController
    local download orchestration

MfsClient
    structured semantic calls

MfsTransferClient
    structured + binary transfer calls

MfsSync
    logical mutation subscription/reconciliation

FinderWindow
    window-manager adapter only
```

No responsibility should have two owners.

---

# 25. Contract-freeze gate

Do NOT extract Finder until stabilization is complete.

Create a written contract freeze.

At minimum freeze:

## Finder public construction contract

Dependencies required to instantiate Finder.

## Location contract

```js
{ hub_id, nid }
```

## Public node contract

At minimum:

```js
{
  hub_id,
  nid,
  parent,
  filetype,
  filename
}
```

Do not expose physical storage fields.

## Service clients

Freeze the methods Finder consumes.

## Sync event contract

Freeze the event shapes Finder consumes.

## Transfer contract

Freeze upload/download/move/copy client APIs.

## Window adapter contract

Freeze the minimal FinderWindow ↔ Finder interaction.

---

# 26. No physical backend leakage into Finder

The standalone Finder package MUST NOT know:

```text
db_name
db_host
fs_host
home_dir
mfs_root
storage_ref
payload_ref
archive path
upload tempfile path
```

It operates only on logical contracts.

---

# 27. No server implementation inside Finder package

The standalone Finder package MUST NOT include:

```text
system-mfs implementation
mfs-service implementation
mfs-transfer implementation
server-runtime implementation
SQL
FileIo
host-filesystem implementation
archive workers
media generators
```

It consumes those capabilities through public runtime/service contracts.

---

# 28. Standalone repository creation

After the contract-freeze gate passes, extract Finder into a standalone repository.

Preferred repository:

```text
drumee/finder
```

Preferred local path:

```text
/home/somanos/github/finder
```

If the repository does not exist, create it only if repository creation is available and authorized by the current environment.

If remote creation is unavailable, prepare the standalone local repository and report the exact missing remote action.

Do not fabricate repository state.

---

# 29. Standalone package identity

Preferred npm package name:

```text
@drumee/finder
```

Prepare a prerelease package version consistent with the existing alpha line.

```text
DO NOT publish npm during Phase 4.9 unless explicitly authorized later.
```

Package preparation and `npm pack` validation are allowed.

---

# 30. Standalone package dependencies

Finder should depend on the smallest stable surface.

Expected direction:

```text
@drumee/ui-runtime
    ↑
@drumee/finder core
```

The FinderWindow adapter may depend on or peer against:

```text
@drumee/window-manager
```

Do not force Window Manager as a hard dependency for core Finder mounting.

Preferred export structure:

```text
@drumee/finder
    core Finder capability

@drumee/finder/window
    FinderWindow adapter
```

or an equivalent package-local structure.

The core entry MUST remain Window Manager independent.

---

# 31. Dependency policy

Use peer dependencies when the host should provide a singleton runtime capability.

Avoid bundling duplicate UI runtimes.

Align ranges with the currently validated standalone package versions.

Do not publish.

---

# 32. Standalone source structure

Prefer a clear capability-oriented structure, for example:

```text
lib/
  finder.js
  finder-item.js
  finder-selection.js
  selection-marquee.js
  item-list.js
  drag-controller.js
  transfer-policy.js
  mfs-client.js
  mfs-sync.js
  upload-controller.js
  download-controller.js
  mfs-transfer-client.js
  finder-window.js

skeleton/
skin/
test/
README.md
PROVENANCE.md
package.json
```

Adapt to the actual source architecture rather than forcing filenames mechanically.

---

# 33. Provenance

Create/maintain `PROVENANCE.md`.

Record:

```text
Phase 4.8 transient source commit:
2033335491d84b1dc07a5b36bc18de17f9affaba

historical ui-team snapshot:
17d1d4a03a135c33b44bbb22054fa2d140bbc1a6

historical server-team snapshot:
7fb16c449ed09258c501e88e3c87a4d71c51a941
```

Also record which code was:

```text
adapted
rewritten
retained conceptually
excluded
```

---

# 34. Standalone Finder tests

The standalone repository must test at least:

```text
core mount without Window Manager
FinderWindow mount with Window Manager
navigation
selection
checkbox selection
marquee
drag policy
same-hub MOVE
cross-hub COPY
upload controller contract
binary transfer-client contract
download controller contract
MfsSync reconciliation
destroy/remount lifecycle
```

Use mocked service boundaries for package-unit tests.

Do not duplicate server integration tests inside the standalone package unnecessarily.

---

# 35. Browser consumer test

Create a packed/consumer-style browser test similar to the established Window Manager packaging validation.

Prove a clean consumer can install/use the prepared Finder package with its declared dependencies.

Validate:

```text
package resolves
core Finder mounts
FinderWindow adapter mounts
no transient path imports
no historical ui-team imports
no Desk WM imports
no source-tree absolute paths
```

---

# 36. Bundle-boundary test

Inspect the browser bundle/dependency graph.

Reject accidental inclusion of:

```text
server-runtime
system-mfs
SQL
Node fs/path modules
server-team
server-core
historical Desk code
```

except development/test-only tooling outside the browser bundle.

---

# 37. No transient-only imports

After extraction, standalone Finder production source MUST NOT import from:

```text
/home/somanos/github/transient/...
target/modules/...
sources/...
```

All production dependencies must resolve through package-local or declared package imports.

---

# 38. Kernel reintegration

After standalone tests pass, change transient to consume the standalone Finder package/source boundary.

Do NOT keep two production Finder implementations.

Target:

```text
transient kernel
    ↓
@drumee/finder
    ↓
@drumee/ui-runtime
    +
optional FinderWindow adapter
    ↓
@drumee/window-manager
```

Delete/retire duplicated transient production Finder implementation only after the standalone package is proven.

Keep transitional test fixtures only when clearly marked.

---

# 39. Reintegration validation

Run the complete kernel Finder scenarios again using standalone Finder.

Prove there is no behavior difference caused by extraction.

At minimum rerun:

```text
navigation
selection
marquee
drag/drop
multi-window
upload
download
media preview
MfsSync multi-client
reconnect
lifecycle
```

---

# 40. Regression protection for Phase 4.8

All Phase 4.8 backend validation must remain green after Finder extraction.

At minimum rerun:

```text
server-runtime tests
ui-runtime tests
window-manager tests
system-mfs tests
mfs-transfer tests
Phase 4.8 validation script
real Nginx upload/download/media tests
SQL granularity test
MariaDB integration test
```

Do not weaken Phase 4.8 tests to make Phase 4.9 pass.

---

# 41. Real-use smoke application

Create or reuse a minimal kernel smoke application/page that exercises real Finder usage.

It should support:

```text
open Finder
open second Finder
navigate
select
drag between Finders
upload
download
preview
close/reopen
```

This may be test-only infrastructure.

Do not create a product UI unrelated to validation.

---

# 42. Error handling stabilization

Exercise and normalize Finder-visible behavior for:

```text
permission denied
node not found
destination invalid
transfer expired
upload cancelled
download failed
network disconnected
sync reconnect
media representation unavailable
```

Finder should not expose raw backend stack traces or physical paths.

---

# 43. Conflict handling scope

Advanced conflict UX remains out of scope unless already required by a blocking scenario.

Do not implement a large conflict-resolution subsystem.

For Phase 4.9, acceptable behavior is:

```text
operation fails
    ↓
surface bounded error
    ↓
reconcile/refresh affected scope
```

Document richer conflict UX as future work.

---

# 44. Undo scope

Undo remains excluded.

Do not introduce operation journals or rollback infrastructure.

---

# 45. Menus and context actions

Context menus/advanced menus remain out of scope unless required to make an existing Finder operation usable.

Do not expand Finder into a full historical Desktop file manager during 4.9.

---

# 46. List modes

Historical row/simple list modes remain optional/deferred.

The dense grid is the required baseline.

Do not block extraction on alternative view modes.

---

# 47. Keyboard accessibility

If keyboard navigation is already partially present or trivially stabilizable, test it.

Otherwise document keyboard-selection enhancements as deferred.

Do not create an unrelated accessibility redesign during this phase.

---

# 48. Performance validation

Collect deterministic evidence for:

```text
bounded item rendering
bounded preview activation
no per-item heavy Widget explosion
no duplicated WebSocket subscriptions per rerender
no unbounded transfer state in Finder
no large binary buffering in browser/runtime beyond bounded chunks
no large download buffering in Node
```

Do not require microbenchmarking unless a regression is observed.

---

# 49. Memory/lifecycle validation

Repeated mount/destroy cycles should not cause unbounded growth in:

```text
event listeners
runtime sync bindings
observer registrations
timers
active drag state
transfer subscriptions
```

Use deterministic counters/instrumentation where practical.

Do not redesign generic runtime lifecycle infrastructure.

---

# 50. Security validation

Confirm standalone extraction does not weaken:

```text
Session.uid() authority
runtime ACL
transfer ownership
recipient-safe sync
representation allowlists
logical-only public identity
private physical paths
binary upload preflight
```

The Finder package itself must not make authorization decisions.

---

# 51. README

The standalone Finder README should explain:

```text
what Finder is
what Finder is not
core vs FinderWindow adapter
required runtime contracts
mounting example
location/node identity
selection model
transfer behavior
sync behavior
media preview behavior
lifecycle/destroy behavior
package status
```

Keep examples minimal and package-local.

---

# 52. API surface

Export only deliberate public APIs.

Avoid exporting internal helper classes unless consumers truly need them.

Prefer a small stable surface such as:

```text
Finder
FinderWindow
MfsClient
MfsTransferClient
MfsSync
TransferPolicy
```

and expose lower-level controllers only when justified.

Record public exports in tests.

---

# 53. Versioning

Prepare a prerelease version consistent with current package maturity.

Do not publish.

Record:

```text
package version
peer dependency ranges
npm pack filename
package size
unpacked size
file count
```

`npm pack` is allowed for validation.

`npm publish` is forbidden without explicit later authorization.

---

# 54. Git discipline

Use append-only commits.

Do not rewrite Phase 4.8 history.

Suggested Phase 4.9 commit structure:

```text
transient:
    test(finder): exercise Phase 4.9 real-use stabilization
    fix(finder): stabilize <specific reproduced issue>
    docs(refactor): freeze Finder contracts for extraction

finder:
    feat: extract standalone Finder capability
    test: validate standalone Finder consumer
    docs: record Finder provenance and contracts

transient:
    refactor(finder): consume standalone Finder capability
    test(refactor): validate standalone Finder integration
    docs(refactor): close Phase 4.9
```

Only create fix commits for actual reproduced defects.

---

# 55. Do not publish automatically

Explicit invariant:

```text
NO npm publish
```

At the end of Phase 4.9, prepare publication evidence if useful, but stop before publication.

A later explicit instruction will authorize publication if desired.

---

# 56. Phase documentation

Create a new canonical phase document:

```text
docs/refactoring/27-phase4.9-finder-stabilization-extraction.md
```

Document:

```text
opening baselines
real-use scenarios
defects found
defects fixed
contract freeze
standalone architecture
dependency graph
repository/package identity
standalone tests
consumer tests
kernel reintegration
regression results
final HEADs
deferred items
```

---

# 57. Phase 4.9 closure conditions

Phase 4.9 may be declared:

```text
CLOSED / VALIDATED
```

only when all of the following hold:

```text
Finder has been exercised in realistic kernel/browser scenarios

multi-window behavior is stable

standalone Finder mounting works without Window Manager

FinderWindow remains a thin adapter

navigation history is instance-local

selection/marquee/drag state is instance-local

drag MOVE/COPY policy remains correct

upload uses the validated binary data plane

download uses the validated offline/Nginx data plane

media previews use explicit representations

MfsSync converges across multiple clients/finders

reconnect reconciliation works

Finder destruction cleans owned listeners/observers/subscriptions

contracts are explicitly frozen

standalone Finder repository/package exists

standalone production code has no transient-only imports

standalone production code has no server implementation

browser consumer/package test passes

transient consumes the standalone Finder capability

no duplicate production Finder implementation remains

kernel Finder integration passes using standalone Finder

Phase 4.8 backend regressions remain green

system-mfs remains unchanged unless a proven defect required change

server-runtime remains unchanged unless a proven Finder blocker required a minimal generic change

generic stop() remains unchanged

working trees are clean

no npm package was published
```

---

# 58. Explicit deferred scope after Phase 4.9

Unless actually required and completed during stabilization, record as deferred:

```text
advanced modifier/range selection

full keyboard file-manager navigation

alternative row/list views

large context-menu system

rich conflict-resolution UX

undo

trash/restore UI

sharing UI

Team/Chat integrations

Hub administration

Desk/global window ownership
```

Do not silently absorb these into Phase 4.9.

---

# 59. Final report

Return a complete report with:

```text
1. Opening baselines

2. Real-use scenarios executed

3. Reproduced defects

4. Stabilization changes

5. Lifecycle issues found/fixed

6. Multi-window validation

7. Navigation validation

8. Selection/marquee validation

9. Drag/drop validation

10. Upload validation

11. Download validation

12. Media/preview validation

13. MfsSync validation

14. Reconnect validation

15. Contract freeze

16. Standalone repository/package structure

17. Public API

18. Dependency graph

19. Provenance

20. Standalone tests

21. Browser consumer/packaging result

22. Kernel reintegration result

23. Phase 4.8 regression results

24. Performance evidence

25. Memory/lifecycle evidence

26. Security invariants

27. Deferred items

28. Repositories modified

29. Commit hashes

30. Final transient HEAD

31. Final finder HEAD

32. Final ui-runtime HEAD

33. Final window-manager HEAD

34. Final server-runtime HEAD

35. Final system-mfs HEAD

36. Working-tree status

37. npm pack result if performed

38. Explicit confirmation:
      no npm publication
      generic stop() unchanged
      Phase 4.8 architecture preserved
```

If one mandatory closure condition remains unsatisfied, do NOT declare Phase 4.9 closed.

Report the blocker precisely.

---

# 60. Final intended architecture

Phase 4.9 should end with:

```text
                    @drumee/ui-runtime
                          ▲
                          │
                   @drumee/finder
                    core capability
                          │
              ┌───────────┴───────────┐
              │                       │
              ▼                       ▼
        core Finder            FinderWindow adapter
                                      │
                                      ▼
                           @drumee/window-manager

core Finder
    ↓
logical service contracts
    ↓
server-runtime ACL
    ↓
mfs-service / mfs-transfer / media-service
    ↓
system-mfs / host-filesystem / FileIo / Nginx
```

The browser package remains logical and capability-oriented.

The backend remains the authority for:

```text
identity
authorization
filesystem semantics
transfer ownership
physical storage
media generation
heavy byte delivery
```

Finder remains a client capability, not a backend authority.
