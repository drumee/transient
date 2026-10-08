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
    CLOSED / VALIDATED / PUBLISHED

Phase 4.7
    Window Manager UI capability
    independent from system-mfs
    CLOSED / VALIDATED / NOT PUBLISHED

Phase 4.8
    Finder / File Manager implementation and integration
    UI depends on Window Manager
    backend depends on system-mfs
    no final standalone Finder extraction

Phase 4.8B
    generic Hub lifecycle and authorized server context
    schema propagation through canonical module manifests
    CLOSED / VALIDATED

Phase 4.9
    real Finder usage and kernel stabilization
    stabilize Finder public contracts
    extract and validate standalone Finder

After Phase 4.9
    end-to-end validation with Oxymotion
    then kernel maintenance, integration, compatibility and evolution

Oxymotion
    separate consumer and owner of Marketing/business capabilities
```

Repository and release milestones do not renumber feature phases. No phase
starts merely because its predecessor closes; explicit authorization remains
required.

## R2 — standalone system-mfs extraction (closed / validated / published)

R2 extracts the validated Phase 4.6B implementation without adding MFS
features. The standalone repository/package owns its code, schemas, schema
manifest, metadata, tests, documentation and provenance. It remains dependent
only on Node.js built-ins, caller-supplied adapters and documented
runtime/platform SQL contracts.

After R2, the standalone `drumee/system-mfs` repository is authoritative.
Phase 4.8 removed the former synchronized integration copy under
`target/modules/system-mfs/`; integration resolves the standalone working copy
directly and audits that no second production implementation exists.

The generic capability resolver introduced in the transitional runtime during
Phase 4.6B remains validated packaging debt. A later runtime extraction/release
milestone must synchronize it into the standalone `server-runtime` repository.
R2 neither redesigns that seam nor modifies the standalone runtime repository.
The completed extraction and isolation evidence is recorded in
[`24-r2-system-mfs-extraction.md`](24-r2-system-mfs-extraction.md).

## Phase 4.7 — Window Manager (closed / validated)

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

Phase 4.7 owned extraction from historical UI evidence, the minimum generic
application/window lifecycle, `ui-runtime` integration, MFS-independent
validation, standalone extraction and standalone validation. It closed with
`@drumee/window-manager@0.1.0-alpha.2` validated and published from the
standalone `~/github/window-manager` repository.

The standalone checkout is authoritative. Phase 4.8 was subsequently
authorized explicitly; its closure does not authorize Phase 4.9.

## Phase 4.8 — Finder implementation and integration (closed / validated)

Finder is the first substantial system application. Its intended dependency
structure is:

```text
UI:       FinderWindow → Finder → ui-runtime
          FinderWindow → window-manager
Backend:  Finder → mfs-service → system-mfs
          Finder → mfs-transfer → mfs-service
```

Finder is independently mountable and does not require Window Manager.
FinderWindow is the optional adapter to the standalone Window Manager.
Browser code reaches `system-mfs` only through the MFS frontend/service
boundary. Finder requires no Team, chat, conference, tasks, Team rooms, DMZ
collaboration behavior or Team-specific desktop policy.

Phase 4.8 implemented Finder, its Window Manager adapter, `mfs-service`,
`mfs-transfer`, the generic standalone `system-mfs` increment and real-browser
integration evidence. The detailed closure record is
[`26-phase4.8-finder-integration.md`](26-phase4.8-finder-integration.md).
Finder remains in the integration workspace; standalone extraction is not part
of this phase.

## Phase 4.8B — Hub lifecycle and schema propagation (closed / validated)

Phase 4.8B provides the application-neutral lifecycle missing between an
authenticated principal and module data in a private Hub: idempotent Hub and
shard assignment, Yellow Page registration, read/write Hub ACL, immutable
schema plans, ordered/resumable trusted provisioners and an authorized server
context. `server-runtime` consumes the context but does not own lifecycle;
`system-mfs` provisions only its own objects in the assigned shard.

The sole module schema contract remains `SCHEMA_MANIFEST.json`, extended with
`inherit` and `requires`. The detailed implementation and validation record is
[`30-phase4.8b-hub-lifecycle.md`](30-phase4.8b-hub-lifecycle.md).

## Phase 4.9 — Finder stabilization and standalone extraction

Phase 4.8B is now the mandatory predecessor to this phase. Existing Finder
standalone extraction/publication artifacts and the historical Phase 4.9
closure report remain auditable repository facts, but they are not accepted as
the current phase-gate proof. Finder must be revalidated against the 4.8B Hub
context before Phase 4.9 can close in the revised sequence.

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
