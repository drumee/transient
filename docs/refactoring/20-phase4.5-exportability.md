# Phase 4.5 — runtime exportability lock

Phase 4.5 locks the validated Phase 4.4 boundary as two private,
transitional CommonJS npm artifacts. It is not a publication, final API or
repository split, and it introduces no later application capability. The
former Phase 5 label is superseded by the canonical post-Phase 4.6 roadmap.

## Package boundary

| Artifact | Version | Included | Deliberately excluded |
| --- | --- | --- | --- |
| `@drumee/server-runtime-extraction` | `0.0.0-phase4.5` | `lib/`, ACL descriptors, workers, intrinsic `schemas/`, README and provenance | tests, `sources/**`, Team, MFS, Hub, deployment, temporary files and generated artifacts |
| `@drumee/ui-runtime-extraction` | `0.0.0-phase4.5` | CommonJS `src/`, browser entry and retained SCSS, README and provenance | tests, `sources/**`, Team, MFS/Finder/Desktop/Window Manager, generated bundles and build tooling |

Both manifests use explicit `files` and CommonJS `exports`. The server has one
direct production dependency (`websocket`). Its generic MariaDB and Redis
collaborators are injected by the runtime host rather than imported from
`@drumee/server-essentials`; removing the stale peer declaration prevents
accidental installation of a monorepo/hoisted dependency. The UI package
declares Backbone, Marionette, DOMPurify, jQuery and lodash. `ui-build` remains
the separate owner of Webpack and build metadata.

## Intrinsic runtime schemas

`server-runtime/schemas/SCHEMA_MANIFEST.json` is the executable,
package-relative schema contract. The kernel harness validates its owner and
package version against the installed artifact, validates every path below the
package root, rejects traversal/absolute/repository paths and missing files,
then sorts the integer `install[].order` values and installs in this exact
order:

1. `schemas/yellow-page/phase4-schema.sql` — identity, provisioned-principal
   lookup, cookie session and Domain privilege base.
2. `schemas/yellow-page/phase4.4-websocket.sql` — OTAK/socket closure and the
   idempotent upgrade from the previous Phase 4.4 shape.

The harness likewise reads `upgrade.entrypoints` from the installed artifact;
there is no second current-schema list in `up.sh`. The WebSocket migration
invalidates legacy pre-`ctime` and NULL-`ctime` OTAKs, repairs nullable cookie
UIDs only to a verified provisioned nobody principal, repairs recoverable
socket UIDs and discards orphaned transient sockets before non-null constraints
are enforced. Installing this schema never provisions an organisation or
creates `system`, `nobody`, `guest`, Drumates, Hubs, storage or MFS.

The disposable fixtures under `target/os/schemas/yellow-page-auth/` therefore
remain test-only provisioning inputs; they are intentionally absent from the
tarball.

## Platform invariants are not schema provisioning

Phase 4.5 closes the exportability boundary but does not claim that schema
installation alone produces a valid Drumee instance. The platform contract
requires these canonical identities/context values:

```text
DEFAULT_ORG_ID = 1
NOBODY_UID = ffffffffffffffff
```

Organisation `id = 1` and nobody `uid = ffffffffffffffff` are canonical.
Guest and system are also mandatory, mutually distinct identities, but their
IDs remain generated/provisioned and resolved through existing configuration;
this phase introduces no hardcoded guest or system ID.

`server-runtime` may know, resolve and require these invariants and fail clearly
when they are absent. It does not create or silently repair them during startup,
request handling or schema installation. The complete conceptual lifecycle is:

```text
install runtime package
→ install intrinsic runtime schemas
→ bootstrap platform invariants
→ valid minimal Drumee instance
```

Phase 4.5 covers the first two steps and their validation. Platform bootstrap
is the next-phase orchestration responsibility, not part of the runtime schema
manifest or the disposable provisioning fixtures.

## Executable evidence

`scripts/test-env/kernel/phase4.5-validation.sh` is the standard gate. Its
artifact test runs `npm pack --json`, audits each tarball, installs it under a
fresh `/tmp` consumer, and asserts `require.resolve()` is under that consumer's
`node_modules`. The UI consumer executes the genuine `Kind.loadPlugin →
bootstrap.plugin → loadJS → registerAddons` coordination without a source
alias. Dependency auditing starts from every `package/*.js` tar entry and reads
the corresponding installed file. The current external-import sets are exactly
`websocket` for the server and Backbone, Marionette, DOMPurify, jQuery and
lodash for the UI.

The same test passes both archives through `KERNEL_SERVER_RUNTIME_TGZ` and
`KERNEL_UI_RUNTIME_TGZ`. The disposable kernel harness extracts them below
`.tmp/test-env/kernel/package-input`, builds the runtime image from those
extracted package files, and mounts only the installed server artifact's SQL
for clean installation and for the `e8e7bac8e` upgrade (including a repeated
migration). The external fixture remains separately responsible for test
organisation provisioning. The established Phase 4 and Phase 4.4 integration
tests then prove Hello, Domain ACL, principal semantics, regsid lifecycle,
cross-site frontend behavior, OTAK claim/expiry, WebSocket Origin and Redis
targeted push against the packaged runtime inputs.

Focused manifest tests reject traversal, absolute/repository paths, missing
files, package identity/version mismatches, non-integer or duplicate install
orders and duplicate paths. A static coupling assertion prevents `up.sh` from
regaining a second current-schema filename list.

The normal source-based regression commands follow in the same gate. A final
source guard proves both a pristine checkout under `sources/**` and committed
tree equality. The immutable validation snapshot is the shared transient
commit `ba532969ecac093faad8be05bdb22403464bd4bb`, the last controlled
provenance import and therefore the complete post-import `sources/**` tree.
This monorepo commit is not a substitute for the per-repository upstream SHAs
retained in `SOURCE_MANIFEST.md`. A direct two-endpoint diff against the commit
avoids any dependency on a local tag or merge-base semantics. Tarballs and
consumers are temporary artifacts only; no npm package is published.

## Out of scope

This lock does not add a package installer, module lifecycle, provisioning,
Hub ACL/shards, MFS, Finder, Window Manager, Team decomposition, Debian
packaging or Marketing. Phase 4.6 was the next planned boundary for the minimal
platform-bootstrap contract and `system-mfs`. The former Phase 5 Marketing
continuation is superseded by
[`23-kernel-roadmap.md`](23-kernel-roadmap.md); this historical Phase 4.5 lock
does not implement any later milestone.
