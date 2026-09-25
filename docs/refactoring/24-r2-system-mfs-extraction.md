# R2 — standalone system-mfs extraction

Status: **CLOSED / VALIDATED**

R2 extracted the validated Phase 4.6B module without adding MFS behavior. The
source boundary was `target/modules/system-mfs/` at transient commit
`078e71378a52acd06478d9df556a7cd5b4d6a223`, including the corrected data,
method and SQL naming contracts.

## Standalone ownership

```text
repository:  drumee/system-mfs
local path:  ~/github/system-mfs
package:     @drumee/system-mfs
version:     0.1.0-alpha.1
commit:      cd87db7085bc8dd40614af7fa37cdd1a76ffc5a0
module type: CommonJS
```

The extraction used `git subtree split` so the standalone repository retains
the relevant transient history. It owns `lib/**`, `schemas/**`, the schema
manifest, package metadata, README, provenance, license, CI definition and
tests. The implementation and SQL files are unchanged from the validated
Phase 4.6B boundary; R2 added only standalone packaging, documentation and
validation assets.

The package has no runtime npm dependency. Runtime inputs are Node.js
built-ins, the caller-supplied database adapter and documented SQL contracts.
It has no dependency on transient, `sources/**`, `target/**`, parent
`node_modules`, `NODE_PATH`, Team repositories or historical absolute paths.

## SQL and lifecycle contract

The Yellow Page database must provide `uniqueId()`, `entity`, `drumate` and
`organisation`. The package owns `system_mfs_installation` and
`system_mfs_provisioning`. Each provisioned context database owns `media`,
`permission`, `mfs_clean_path`, `mfs_node_attr`, `mfs_make_dir`,
`mfs_init_folders` and `mfs_show_node_by`.

The explicit `not-installed`, `installed`, `provisioning`, `provisioned`,
`partial`, `conflicting` and `failed` states remain unchanged. Capability
availability comes only from module-owned lifecycle state and validated MFS
objects. Platform identity placeholders remain outside this decision.

The public API remains `MfsError`, `MfsNamespace`, `SqlMfsStore`, `install()`,
`provision()`, `validateInstallation()`, `validateProvisioning()` and
`capabilityAvailable()`. JavaScript data fields remain `snake_case`, historical
method names remain unchanged and SQL routine parameters and local variables
remain `_snake_case`.

## Artifact and standalone validation

`npm test`, executed from the standalone repository, passes nine tests. The
suite proves package-relative schema resolution, isolated artifact loading,
installation and provisioning lifecycle behavior, read-only validation,
idempotency, deterministic conflicts, unavailable failed provisioning and the
real namespace API. Its disposable MariaDB 11.4 test exercises the actual SQL
installation, provisioning and namespace operations against minimal explicit
runtime/platform SQL fixtures.

`npm pack` produces `drumee-system-mfs-0.1.0-alpha.1.tgz` with ten files:

```text
LICENSE
PROVENANCE.md
README.md
lib/errors.js
lib/index.js
lib/store.js
package.json
schemas/SCHEMA_MANIFEST.json
schemas/context/001-mfs-core.sql
schemas/yellow-page/001-capability-state.sql
```

The packed artifact is installed in an isolated temporary directory with
`NODE_PATH` empty and no reference to files outside the artifact. Its npm SHA-1
is `8c107a79dfebcf22dc03fd20c778321fa398a112`; its integrity is
`sha512-5mwDVkeqMG773h99b+9xPHe7S+zFTAFcK+NWKaruBZpPWpowi+kSpq0nplV0uMfO5BNYXkX+GojG1pZyoPsojw==`.

Publication was not authorized and was not performed. The repository is
release-ready for an explicit `npm publish --tag next --access public` from its
clean `main` branch after publication authorization.

The closing transient regression run passed:

```text
server-runtime package:     32/32
platform-bootstrap package:  7/7
system-mfs package:           9/9
Phase 4:                      1/1
Phase 4.4:                    1/1
Phase 4.5:                    1/1
Phase 4.6A:                   1/1
Phase 4.6B:                   2/2
```

The first Phase 4.4 attempt reached its disposable MariaDB readiness timeout
while the image initialized. After explicit cleanup, the unchanged test passed
on rerun. No product change was made for that environmental retry.

## Transient integration and authority

The standalone repository is authoritative after R2. Transient's Phase 4.6B
integration resolves `~/github/system-mfs` by default, or the explicit
`KERNEL_SYSTEM_MFS_ROOT` override, and copies only package assets into its
disposable kernel container.

`target/modules/system-mfs/` remains temporarily as a synchronized integration
fixture so historical transient commits and local package regressions remain
reproducible. It is not an independent implementation. Changes must originate
in the standalone repository, be synchronized deliberately into the fixture,
and pass `node scripts/check-system-mfs-sync.js`, which compares both complete
file inventories and contents while excluding repository and generated
artifacts. This explicit authority and verification rule prevents uncontrolled
dual ownership.

The generic capability resolver validated in transient during Phase 4.6B is
separate runtime packaging debt. A later authorized runtime extraction/release
milestone must synchronize it into standalone `server-runtime`. R2 did not
modify that repository and this debt does not alter the standalone MFS
contract.

R2 closes without authorizing or implementing Phase 4.7. Window Manager is the
next planned capability and remains **NOT AUTHORIZED**.
