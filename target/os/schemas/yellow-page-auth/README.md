# Phase 4 Yellow Page provisioning fixtures

The intrinsic Phase 4/4.4 runtime SQL lives in
`target/foundation/server-runtime/schemas/` as of Phase 4.5. It is packaged
with the transitional server-runtime npm artifact and its install order is
defined by `schemas/SCHEMA_MANIFEST.json`.

This directory now contains only disposable integration-test provisioning
fixtures:

- `phase4-fixture.sh` creates deterministic provisioned `system`, `nobody`,
  `guest`, and Domain-ACL test identities after the runtime schema is
  installed.
- `phase4-fixture-e8.sh` does the equivalent for the previous
  `e8e7bac8e` schema shape, for the upgrade characterization test.

Fixtures are deliberately outside the runtime package. Runtime schema
installation does not provision an organisation, Drumates, Hubs, factory
pools, storage, MFS or any Team state. The test data remains source-derived
from the pinned `schemas` import (`cb838e255600a4ec3797dc7ac13659ad9d187421`)
and only proves the externally owned organisation-provisioning contract.
