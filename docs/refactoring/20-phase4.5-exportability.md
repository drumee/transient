# Phase 4.5 — runtime exportability lock

Phase 4.5 locks the validated Phase 4.4 boundary as two private,
transitional CommonJS npm artifacts. It is not a publication, final API or
repository split, and it introduces no Phase 5 application capability.

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

`server-runtime/schemas/SCHEMA_MANIFEST.json` is the package-relative schema
contract. Manifest version 1 identifies the package and `phase4.5-runtime-schema-1`,
and installs in this exact order:

1. `schemas/yellow-page/phase4-schema.sql` — identity, provisioned-principal
   lookup, cookie session and Domain privilege base.
2. `schemas/yellow-page/phase4.4-websocket.sql` — OTAK/socket closure and the
   idempotent upgrade from the previous Phase 4.4 shape.

The upgrade entry points are the same ordered pair. The WebSocket migration
invalidates legacy pre-`ctime` and NULL-`ctime` OTAKs, repairs nullable cookie
UIDs only to a verified provisioned nobody principal, repairs recoverable
socket UIDs and discards orphaned transient sockets before non-null constraints
are enforced. Installing this schema never provisions an organisation or
creates `system`, `nobody`, `guest`, Drumates, Hubs, storage or MFS.

The disposable fixtures under `target/os/schemas/yellow-page-auth/` therefore
remain test-only provisioning inputs; they are intentionally absent from the
tarball.

## Executable evidence

`scripts/test-env/kernel/phase4.5-validation.sh` is the standard gate. Its
artifact test runs `npm pack --json`, audits each tarball, installs it under a
fresh `/tmp` consumer, and asserts `require.resolve()` is under that consumer's
`node_modules`. The UI consumer executes the genuine `Kind.loadPlugin →
bootstrap.plugin → loadJS → registerAddons` coordination without a source
alias.

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

The normal source-based regression commands follow in the same gate. A final
`git diff --exit-code -- sources/` proves the immutable historical baseline
was not altered. Tarballs and consumers are temporary artifacts only; no npm
package is published.

## Out of scope

This lock does not add a package installer, module lifecycle, provisioning,
Hub ACL/shards, MFS, Finder, Window Manager, Team decomposition, Debian
packaging or Marketing. Those remain explicit later-phase decisions.
