# Phase 4.9 — Finder stabilization on the authorized Hub lifecycle

Status: **CLOSED / VALIDATED / NOT PUBLISHED** on 2026-10-09.

This is the canonical Phase 4.9 implementation record for the sequence
4.8B → 4.9 → Oxymotion validation. Reports 27 and 29 describe an earlier
standalone Finder milestone; they do not establish the Hub integration proved
here.

## Boundaries and prepared versions

| Component | Delivery boundary | Prepared version |
|---|---|---|
| Hub lifecycle | private `target/control-plane/hub-lifecycle` workspace | `0.0.0-phase4.8b` |
| server runtime | standalone `drumee/server-runtime` | `0.1.0-alpha.3` |
| system MFS | standalone `drumee/system-mfs` | `0.1.0-alpha.2` |
| Finder | standalone `drumee/finder` | `0.1.0-alpha.3` |
| Window Manager | standalone `drumee/window-manager` | existing `0.1.0-alpha.2` |

No package was published. The Hub control plane deliberately remains a
transitional private package: its final repository is not implied by its
current hosting, while lifecycle ownership remains outside server-runtime and
system-mfs.

## Authorized request contract

```text
opaque {hub_id, nid} selection
→ authenticated KernelSession
→ HubAuthorizer / lifecycle resolveAuthorized()
→ canonical Hub permission bit + ready system-mfs capability
→ immutable per-request hub_context or hub_contexts
→ MFS node user_permission()
→ worker execution
```

The browser cannot supply a database name, SQL host, credential or filesystem
path. The runtime discards such physical parameters and uses only the internal
descriptor returned by the lifecycle. Each source/destination Hub is resolved
independently; there is no mutable global active Hub.

The creator remains durable owner. Granted privilege words and requested bits
come from `@drumee/server-essentials`: `read=3`, `write=7`, `delete=15`,
`admin=31`, `owner=63` versus requested `read=2`, `write=4`, `delete=8`,
`admin=16`, `owner=32`. Plain write cannot manage ACL. The public ACL page's
`write = 8` conflicts with executable `permission.write = 4`; current
constants and the historical `privilege & asked_permission` evaluation are
authoritative.

MFS retains its second authorization layer. List/read/download require read;
mkdir/upload require destination write; rename/remove require delete; move
requires source delete and destination write; copy requires source read and
destination write. Hub admin/owner does not bypass node ACL.

Long-running transfer entrypoints re-enter runtime authorization rather than
trusting a transfer identifier. WebSocket publication filters recipients with
current Hub rights before producing the recipient-safe event projection.

Descriptor-level and service-level `requires` are merged with explicit
permission capabilities. For Hub scope, that union is checked against every
server-authorized Hub context before a platform provider and before Worker
construction. Platform component availability never substitutes for a Hub
capability in `ready` state. For MFS scope, `system-mfs` is always added even
when `requires` is absent or empty; source and destination Hubs are checked
independently.

WebSocket delivery is fail-closed. A publisher with a transport but no
authorization callback is invalid. The official event authorizer resolves the
current recipient session, rechecks Hub read and node read, and projects out
resources the recipient cannot see. Candidate socket enumeration is not an
authorization decision, and an authorization exception results in no delivery.

## Schema contract

`system-mfs` now ships one manifest, at
`server/schemas/SCHEMA_MANIFEST.json`. Its existing metadata, ordered object
inventory, schema version and checksums are preserved, with:

```json
{
  "inherit": "installed",
  "requires": []
}
```

Finder is UI-only and therefore invents no Finder SQL schema. Its server
service descriptors require `system-mfs`; capability readiness is enforced by
the runtime. An application with Hub SQL and MFS dependence uses its own
canonical manifest, for example:

```json
{
  "module": "fixture-own",
  "schemaVersion": "1",
  "inherit": "own",
  "requires": ["system-mfs"],
  "objects": []
}
```

The lifecycle retains read-only support for the old `schemas/` path while
packages migrate. It does not merge two manifests or maintain competing
capacity metadata.

## Finder stabilization

Existing navigation, breadcrumbs/history, grid, marquee/checkbox selection,
drag/drop, same-Hub move, cross-Hub copy, recursive and mixed upload (including
empty folders), chunk progress/cancel/retry contracts, multi-selection folder
download and scoped synchronization remain covered.

Phase 4.9 adds compact-list rendering, modifier/range selection, keyboard
navigation and activation, bounded host context-command requests,
same-Hub-move undo, and explicit conflict error/reconciliation behavior. Undo
does not claim cross-Hub copy rollback because destination identities are
server-assigned. Trash/share/Hub-administration UI and a rich conflict-dialog
system remain outside Finder's application-neutral boundary.

Move undo snapshots its source location before the first asynchronous transfer
step. Later navigation cannot alter the inverse operation. Failed moves create
no undo entry, and an inverse denied after an ACL change remains retryable after
view reconciliation. `MfsClient.copy()` keeps its public `nodes` argument but
emits the backend's canonical `sources` wire field.

## Validation levels

Three evidence levels are retained and named explicitly:

1. deterministic unit/in-memory fixtures for interaction timing, undo, event
   projection and negative authorization paths;
2. direct runtime integration through the dispatcher, real KernelSession,
   lifecycle and MariaDB shards;
3. a Chromium end-to-end path using the packaged Finder clients, authenticated
   HTTP transport, runtime WebSocket, lifecycle-created Hubs and provisioned
   MariaDB shards.

The third level proves simultaneous A/B windows, listing/navigation/mkdir,
same-Hub move, cross-Hub copy, a real ACL denial, chunk upload and byte
retrieval, delivery to an authorized second client, suppression after durable
ACL revocation, and absence of physical database locators in browser exchanges.

## Persistence and availability

The MariaDB validation creates distinct A/B Hubs through the lifecycle,
provisions system-mfs automatically, and executes MFS work through the runtime
dispatcher with real KernelSession instances. It restarts MariaDB using the
same durable volumes, reloads the lifecycle from a second code checkout and
finds the same hubs, shards, owners, ACL, frozen plans, capability states and
sentinel/MFS data. Failed or incomplete shards are never reassigned.

During an upgrade, already-ready capabilities remain usable; the unavailable
capability fails closed. Deactivation does not delete data. `installed` Hubs
receive later active Hub contributors through new paginated plans; `own` Hubs
follow only the creator/dependency closure.

## Oxymotion handoff

The next phase must not let Oxymotion choose a physical shard or a provisioning
policy from browser input. Its official adapter should back `hubResolver` and
`hubContext` with the lifecycle and per-request runtime context. Its sole
`server/schemas/SCHEMA_MANIFEST.json` should declare `inherit: "own"` and
`requires: ["system-mfs"]`; Oxymotion owns and provisions every `oxy_` object.
Validation must repeat two-Hub isolation, canonical ACL, capability readiness,
restart persistence and cross-Hub denial. No Oxymotion code was changed here.
