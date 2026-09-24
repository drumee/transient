# Drumee minimal-kernel architecture

This file is the short stable-rule index. Detailed evidence and phase contracts
remain under `docs/refactoring/`, especially
[`06-target-architecture.md`](docs/refactoring/06-target-architecture.md),
[`07-migration-plan.md`](docs/refactoring/07-migration-plan.md),
[`20-phase4.5-exportability.md`](docs/refactoring/20-phase4.5-exportability.md),
[`22-r1-runtime-release.md`](docs/refactoring/22-r1-runtime-release.md)
and [`21-phase4.6-system-mfs.md`](docs/refactoring/21-phase4.6-system-mfs.md).

- `sources/**` is immutable imported evidence.
- Runtime packages remain CommonJS; the browser architecture has no SSR.
- `server-runtime` is the minimal intrinsic backend runtime and owns only its
  intrinsic runtime schemas and migrations.
- `ui-runtime` is the minimal non-MFS LETC/browser runtime.
- Packages and repositories must not rely on hidden cross-repository imports,
  parent `node_modules`, `NODE_PATH`, `target/**` or `sources/**`.
- Modules own their code, schemas, migrations and provisioning knowledge. A
  bootstrap/control-plane orchestrator decides when, where and for whom module
  provisioning runs.
- `DEFAULT_ORG_ID = 1` and `NOBODY_UID = ffffffffffffffff` are canonical
  platform invariants. Guest and system remain distinct provisioned identities.
- Runtime consumes platform invariants; it does not provision or repair them.
- The Phase 4.6A control-plane bootstrap owns idempotent creation and read-only
  validation of organisation `1`, nobody, guest and system. It reuses the
  intrinsic identity tables but remains outside `server-runtime`.
- `system-mfs` is the first system/kernel module, not intrinsic runtime.
- Finder is a future system application and is not the MFS engine.
- Marketing is the first business application and consumes MFS.
- R0 extracts repositories; R1 owns the first npm release. Neither introduces a
  feature phase.
- Phase 4.6 is closed and validated: 4.6A owns platform bootstrap, while 4.6B
  provides the independently installed and explicitly provisioned
  `system-mfs` module. Kernel boot and authentication remain MFS-independent.
- Backend descriptors may declare flat capability names. Runtime checks them
  through an injected, application-neutral resolver and never installs or
  provisions a capability. The transitional runtime change must be extracted
  into a later `server-runtime` release milestone; no standalone repository or
  npm package was changed in Phase 4.6B.
- MFS readiness is recorded in module-owned lifecycle state and validated
  against its context database. `entity.db_name`, `entity.home_dir` and
  `entity.home_id` are not capability signals.
- No later milestone or phase starts without explicit authorization.
