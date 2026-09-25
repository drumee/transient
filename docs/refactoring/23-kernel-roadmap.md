# Canonical kernel roadmap after Phase 4.6

This document is the authoritative roadmap for the Drumee minimal-kernel
project after the validated Phase 4.6 boundary. Earlier plans that named
Marketing as Phase 5 or used Marketing to drive Phase 6 stabilization are
superseded.

## Project boundary

This project remains dedicated to the Drumee kernel: `server-runtime`,
`ui-runtime`, platform bootstrap, system modules, Window Manager,
`system-mfs`, Finder, integration, compatibility, maintenance and evolution.

Marketing is not part of this project roadmap. A future separate **Oxymot**
project will own Marketing and its business schemas and workflows, including
Profile, Source, Crawl, Document, Claim, Evidence, Review, campaigns, content
and measurement. This roadmap does not create Oxymot or implement its business
logic.

## Authoritative sequence

```text
Phase 4.6
    platform bootstrap + system-mfs
    CLOSED / VALIDATED

R2
    standalone system-mfs extraction
    CLOSED / VALIDATED

Phase 4.7
    Window Manager UI capability
    independent from system-mfs
    validate and extract as a standalone module/package

Phase 4.8
    Finder / File Manager implementation and integration
    UI depends on Window Manager
    backend depends on system-mfs
    no final standalone Finder extraction

Phase 4.9
    real Finder usage and kernel stabilization
    stabilize Finder public contracts
    extract and validate standalone Finder

After Phase 4.9
    kernel maintenance, integration, compatibility and evolution

Oxymot
    separate future project for Marketing and business capabilities
```

Repository and release milestones do not renumber feature phases. No phase
starts merely because its predecessor closes; explicit authorization remains
required.

## R2 — standalone system-mfs extraction (closed / validated)

R2 extracts the validated Phase 4.6B implementation without adding MFS
features. The standalone repository/package owns its code, schemas, schema
manifest, metadata, tests, documentation and provenance. It remains dependent
only on Node.js built-ins, caller-supplied adapters and documented
runtime/platform SQL contracts.

After R2, the standalone `drumee/system-mfs` repository is authoritative. Any
copy retained under `target/modules/system-mfs/` is a synchronized integration
fixture, not an independently owned implementation. Its synchronization and
verification mechanism must remain explicit.

The generic capability resolver introduced in the transitional runtime during
Phase 4.6B remains validated packaging debt. A later runtime extraction/release
milestone must synchronize it into the standalone `server-runtime` repository.
R2 neither redesigns that seam nor modifies the standalone runtime repository.
The completed extraction and isolation evidence is recorded in
[`24-r2-system-mfs-extraction.md`](24-r2-system-mfs-extraction.md).

## Phase 4.7 — Window Manager

Window Manager is a generic UI capability, not an MFS capability:

```text
ui-runtime
    ↓
window-manager
    ↓
multi-window applications
```

It must support applications such as CRM, analytics, campaign editors,
settings, dashboards and administration tools without requiring `system-mfs`,
Finder, Team, Hub or chat.

Phase 4.7 owns extraction from historical UI evidence, the minimum generic
application/window lifecycle, `ui-runtime` integration, MFS-independent
validation, standalone extraction and standalone validation. It must close
with Window Manager available as a standalone module/package.

Phase 4.7 is not authorized by this roadmap update or by R2.

## Phase 4.8 — Finder implementation and integration

Finder is the first substantial system application. Its intended dependency
structure is:

```text
UI:       ui-runtime → window-manager → Finder
Backend:  server-runtime → system-mfs → Finder
```

Finder may require Window Manager on the UI side and `system-mfs` on the
backend side. It must not require Team, chat, conference, tasks, Team rooms,
DMZ collaboration behavior or Team-specific desktop policy. Finder is a file
manager, not a collaboration suite.

Phase 4.8 owns implementation, Window Manager integration, `system-mfs`
integration, minimal file-management workflows, integration tests and
architectural validation. Finder may remain in the kernel integration
workspace while these contracts evolve. Phase 4.8 does not perform the final
standalone Finder extraction.

## Phase 4.9 — Finder stabilization and standalone extraction

Finder, rather than a business application, is the first substantial real
consumer used to stabilize the complete kernel application platform. Actual
Finder usage may reveal issues in `ui-runtime`, Window Manager,
`server-runtime`, capability resolution, `system-mfs`, application loading,
multi-window behavior and real MFS operations. Only issues demonstrated by
that use should change kernel contracts.

After those contracts are stable enough, Phase 4.9 extracts Finder into its
own standalone repository/package. The artifact must prove package-relative
assets, isolated tests, no transient or `sources/**` dependency, no Team or
collaboration dependency, an explicit Window Manager UI dependency, an
explicit `system-mfs` backend dependency and clean integration back into the
kernel environment.

Phase 4.9 closes only when real Finder use has stabilized the relevant kernel
contracts, standalone Finder tests pass, standalone Finder works with
standalone Window Manager and standalone `system-mfs`, kernel integration
consumes it cleanly, and no uncontrolled duplicate ownership remains.

The required final proof is:

```text
stable kernel
+ standalone Window Manager
+ standalone system-mfs
+ standalone Finder
```

Finder standalone extraction belongs to Phase 4.9, not Phase 4.8.
