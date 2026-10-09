# Phase 2 server runtime extraction

This is a private, transitional CommonJS workspace for the first
application-neutral Drumee backend runtime. It is not a public API, a package
to publish, or an approved final repository boundary.

It deliberately contains descriptor discovery, `module.method` resolution,
public/private worker selection, lazy worker loading, frontend plugin path
resolution, and the smallest approved authentication/Domain-ACL seam. Generic
database, cache, logging, configuration, and transaction primitives remain in
the current `@drumee/server-essentials` dependency.

The approved private seam is limited to `scope: "domain"` → Yellow Page
`domain_permission`, with real `session_signin`/`regsid` session handling.
Hub lifecycle, shard allocation, provisioning and Team router policy are
excluded. Phase 4.8B adds only an injected `scope: "hub"` authorization seam:
the runtime validates the authenticated session and opaque Hub selection,
delegates ACL/shard/capability readiness to the control plane resolver, then
passes the resulting internal `hub_context` to the worker. The runtime never
creates a Hub or trusts a client-supplied database locator.

Hub descriptors use the existing `permission.src` field. The same injected
current-Essentials `permissionValue` converter used by descriptor discovery is
required by `HubAuthorizer`; no `access` string or numeric hierarchy is added.
The resolved bit is checked before the Worker class is loaded or instantiated,
and the authorized context carries both `asked_permission` and the effective
cumulative `privilege`. Contextual MFS authorization remains a separate
pre-execution check. A service descriptor declares `requires:
["system-mfs"]`; the runtime authorizes every source/destination Hub
independently, verifies that capability is ready, and injects immutable
per-request `hub_context`/`hub_contexts`. It then requires the corresponding
node permission from the MFS backend. A Hub privilege never substitutes for an
MFS node privilege, and no mutable process-global Hub is used.

## Phase 4.5 export boundary

The private `npm pack` artifact contains only the runtime executable closure:
`lib/`, `acl/`, `service/`, `schemas/`, this README and provenance. It excludes
tests, `sources/**`, Team code, build output and temporary artifacts. Its
`schemas/SCHEMA_MANIFEST.json` is the executable contract that deterministically
drives the intrinsic Yellow Page SQL install order and idempotent Phase 4.4
upgrade entrypoints. Package identity, paths and files are validated before
installation. Installing these SQL files does not provision an
organisation or create `system`, `nobody` or `guest`; that remains an external
organisation-provisioning responsibility.

The package name and boundary are still transitional and are not a public API
or publication commitment.

## Phase 4.6B transitional capability seam

ACL descriptors may declare a flat `requires` array. `ServiceDispatcher`
checks those names through an injected `CapabilityResolver` after authorization
and before worker loading. The resolver has no MFS knowledge and never
installs or provisions modules. An absent or context-unavailable requirement
fails deterministically with `CAPABILITY_UNAVAILABLE`.

This smallest generic runtime change is validated only in `transient`. It must
be extracted and released through a later standalone `server-runtime`
milestone; Phase 4.6B does not modify or publish that repository.

## Phase 4.8 upload input boundary

The generic JSON service body remains limited to 64 KiB. Hosts may opt a
specific service into the separate binary receiver, which authorizes bounded
query metadata before ingestion, applies an optional ownership preflight,
streams `application/octet-stream` with backpressure into a server-generated
tempfile, enforces a hard byte ceiling during receipt, and removes every
failed or unclaimed tempfile. The runtime has no MFS-specific upload logic.
