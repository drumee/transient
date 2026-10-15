# IL-4 — Distribution qualification checkpoint

KB-01 follow-up: [canonical operator bootstrap contract gate](39-kernel-operator-bootstrap.md).
KB-01 identified the missing minimal-runtime platform authority chain; IL-4
remains gated and has not resumed.

Canonical Infra Layer evidence: `35fe3d0e6b6311d43940338b65a7e5ae74c0d222`,
`docs/IL-4-validation-evidence.json`. Debian handoff:
`d035f9ed5af437c323d364dfbd732673f24f6c3e`.
The final development archive has integrity
`sha512-yQD6QsmHoI0sMtqCJvbPGwf5Nc527kpEJwsEbZkHwwAugfKqQnE5O/58yXSPfHmHLLxhbRyBXWZbeg2xnuxD1A==`.
Its runtime bytes match the final guard integration archive recorded below;
only PROVENANCE differs. This remains private development metadata, not alpha.2.

Status: **IL-4 — INTEGRATION_BLOCKED**. The canonical first-human/operator
enrollment contract is missing. The approved IL-3 fixture remains unchanged;
its disposable accounts are not production installation defaults.

## Revisions and implemented checkpoints

| Repository | Branch | Starting revision |
|---|---|---|
| transient | refactor/mapping | `c5ee4591c87e7be2a7d91398cfcaa277787558e0` |
| infra-layer | main | `6516c70349cc02bacffac565b5e103e660f970aa` |
| debian | feat/container-distribution | `8a236e5d147a55cfd5580dcda0712cd6436ca93c` |
| debian | remote main inspected | `b8b0ebe7082e1ad2366f3a7997712f5da5bba127` |

Debian commit `4382c96d3362ed9eadce67cb59b18aaeb5e00ed9` adds a read-only
inventory and eight security tests under `profiles/minimal-kernel/`. Its
`dependency-manifest.json` records all 213 locked npm artifacts (53 production),
six direct Drumee revisions, seven private transitional modules and all 71
acquired source files. Exact source paths/revisions, blob IDs, SHA-256 file
digests, SHA-512 archive integrities, owners, roles, test references and license
metadata gaps are explicit. Transitive npm source commits absent from metadata
are not invented: locked version/integrity identifies the artifact.

Inventory generation reads immutable Git objects, not working-tree edits.
This is the IL-3 input inventory, not a qualified new build/install channel.
Private acquisition remains pinned to `5469b48109dbb20eacbbc9314a6772264b388843`
with provenance/notices retained; no private capability was extracted/published.
Several private package manifests omit license metadata; confirmation against
the original notices remains a release gate.

Infra Layer commits `070224b9048541f82ed819d65a458cc075b96d1f` and
`2d1f6aa6774f70f1d3cfc00f47a94ecf4133e314` fix valid unsorted distribution
resource input failing its own composition regeneration check. The final change
sorts only the distribution resource iteration and preserves the historical
infrastructure inventory prefix. Regression verifies input purity, permutation
equivalence, self-verification, legacy ordering and tamper rejection. Public
functions, types and contract versions remain unchanged.
Follow-up `adf56e04961c3974e0bd0ad481b1700a15d99c09` validates malformed
resource records before sorting, keeping stable diagnostics for null records
and invalid identity values; valid composition output remains unchanged.

## Real SQL investigation

Transient commit `96acf364841b7556e4bce34b96be592b6fc94a38` adds only
`tests/integration/infra-il4/sql-boundary.test.js` and ignore rules. No kernel,
historical source, ACL or MFS implementation changes.

The probe uses the fixture's pinned real platform/runtime/Hub/system-mfs owners
on disposable MariaDB 11.4, a dynamic loopback-only TCP port and tmpfs data.
Credentials are generated into private temporary files; only its labelled
container and temporary directory are removed afterward. Seven TAP tests
including the parent pass:

- Canonical bootstrap creates exactly nobody/guest/system with empty credential
  fingerprints, preserves them on repeat and rejects nonempty-password logins.
- A scoped provisioner installs actual manifests, creates a Hub through the
  authenticated control plane and provisions system-mfs. Anonymous creation is
  rejected by the real control plane.
- A separate restricted runtime authenticates/resumes sessions, invokes canonical
  OTAK expiry, resolves actual ACL and creates/reads an MFS directory through
  existing stored routines.
- Runtime cannot create unrelated or other Hub databases, read/alter an unrelated
  schema, create SQL users, alter mysql.global_priv, install yp tables, change
  identity credentials/privileges or delete Hub ACLs.

The probe explicitly inserts a disposable human for this experiment, as IL-3
acceptance did. This is not an installer or proof of canonical first-operator
enrollment. Scoped provisioner/runtime grants are a tested starting policy;
whole-method coverage, exact dynamic per-Hub grants, restored SQL definers,
credential transitions and restricted-role browser recovery remain to qualify.

## Missing contract and concrete owner decision

| Actual owner / file | Existing behavior | Missing contract |
|---|---|---|
| `target/control-plane/bootstrap/lib/index.js::bootstrap` | Organisation 1 and three reserved identities | First-human enrollment |
| `target/control-plane/bootstrap/lib/store.js::createPrincipal` | System area/status, empty fingerprint, internal helper | Authorized human credentials/privileges/idempotency |
| `target/control-plane/hub-lifecycle/lib/index.js::sessionPrincipal` | Requires authenticated human; rejects reserved identities | Consumes existing identity, does not enroll it |
| server-runtime alpha.3 `acl/yp.json`, `lib/session.js`, intrinsic `phase4-schema.sql::session_signin` | Sign-in against existing credentials | No first-account provisioning API |
| fixture `lib/initialize.js:27–48` | Direct disposable owner/reader/outsider inserts | Acceptance-only, unsuitable production initialization |

The owner is the minimal-kernel **control plane in transient**, not Infra Layer
or Debian. IL-4 prohibits silently changing kernel identity/provisioning policy.
No such implementation was added to work around this boundary.

Proposed separate approval: a narrow
`target/control-plane/operator-bootstrap` operation accepting explicit
authorization, organisation/domain, operation ID, human identity attributes
and a protected credential reference. It must own canonical credential and
administrative privilege policy, transactional identity/idempotency ownership,
reserved/conflicting identity rejection, safe interruption recovery, unchanged
credentials on repeat and read-only redacted validation. Required tests include
first/repeated/conflicting/interrupted enrollment, actual authentication,
authorized Hub creation and unauthorized rejection. Debian invokes the approved
job; it does not own that identity SQL. Extraction/publication remains separate.

## Debian integration and release boundary

Debian `docs/minimal-kernel-il4.md` contains the detailed migration and SQL role
matrix. Preserve current release 1.0.57 Team roles: role-app uses historical
server-pod/PM2 and schemas/populate uses Organization/factory pools. Minimal mode
must be explicit, provide selected real host/frontend and approved kernel jobs,
and consume the canonical versioned Infra Layer lifecycle. No duplicate
planner/renderer/activation or placeholder installer was introduced.

Keep `config/drumee.yaml` authoritative with explicit profile-specific schema
and dispatch. Do not reinterpret legacy TLS/secret-generation semantics as
Infra Layer v2. Minimal `drumee-ctl` backup/restore must delegate coordinated
canonical recovery, not legacy database-only commands. SMTP remains excluded
from qualified full recovery until spool restoration is tested; automatic TLS
scheduling stays disabled until explicitly configured and qualified.

On 2026-10-15 the registry still lists stage and alpha.1; next/latest point to
alpha.1, which lacks lifecycle APIs. Alpha.2 is only the proposed future
candidate. No candidate is declared release-qualified, and no release version,
tag, dist-tag or image was published. Production install/operator commands,
complete SQL isolation, restricted-role recovery and IL-4 testbox acceptance
are gated on the missing first-operator contract. Keep the IL-3 fixture until
Debian passes equivalent or stronger acceptance; no divergent copy was created.

## Commands and executed evidence

```sh
# Fresh standalone Infra Layer checkout at implementation 2d1f6aa…
npm ci
npm test
npm run test:integration
npm run test:package

# Transient
node --test tests/integration/infra-il4/sql-boundary.test.js
node --test target/foundation/server-runtime/test/*.test.js target/modules/host-filesystem/test/*.test.js target/modules/mfs-service/test/*.test.js target/modules/mfs-transfer/test/*.test.js target/modules/media-service/test/*.test.js
# Fixture directory and unchanged standalone Finder, each separately
npm test

# Debian isolated clone
node --test profiles/minimal-kernel/inventory.test.js
node profiles/minimal-kernel/inventory.js validate
bash tests/run-all.sh
```

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Infra Layer unit/security | 124 | 0 | 0 |
| Nginx/kernel/Chromium | 17 | 0 | 0 |
| Native infrastructure services | 17 | 0 | 0 |
| Infrastructure lifecycle | 16 | 0 | 0 |
| HTTPS/renewal/init jobs | 4 scenarios | 0 | 0 |
| Runtime/FileIo/MFS/transfer/media | 68 | 0 | 0 |
| Current standalone Finder npm test | 31 | 0 | 0 |
| Existing fixture units | 4 | 0 | 0 |
| New SQL boundary probe | 7 including parent | 0 | 0 |
| Debian inventory | 8 | 0 | 0 |
| Debian legacy lightweight checks | 330 checks | 0 | no reported skips |

Repeated runs are not additional unique tests. Finder's current full suite is
31 tests, versus the earlier 27 core tests. Normal pinned GitHub acquisition
worked in the clean Infra Layer clone; no sibling Git transport rewrite was
used. Package audit confirms 38 allowlisted files, zero runtime npm dependencies
and a successful offline packed consumer. An initial SQL test typo used a
nonexistent expiry_time column; invoking the canonical runtime method fixes the
probe, whose complete rerun passes. Initial sandbox-limited tests were rerun
with normal subprocess/permission access; the table reports successful runs.

Full real IL-3 compatibility was rerun from a fresh clone at this checkpoint's
`96acf364841b7556e4bce34b96be592b6fc94a38` with a local npm pack of Infra Layer
`2d1f6aa6774f70f1d3cfc00f47a94ecf4133e314`, integrity
`sha512-epjbLJrHxjAT+7ayv1h0BDSlhU8p6KKuotsvgbQZxB+aOa1/sdn/VN1eSDLRA4zZVZQcplwH53Z0IOShLf2wIQ==`.
The test-only override used `npm install --no-save --package-lock=false` after
npm ci, leaving the owning fixture/lock unchanged. It is not registry alpha.1.
All 25 grouped checks pass: 9 fresh, 8 restart and 8 isolated restore, with three
Chromium stages and actual interrupted Redis rotation recovery. This preserves
the approved fixture behavior, not a new production enrollment policy.
Owned project `drumee-il3-kernel-498823b7` used loopback HTTPS 46345/DNS 38657;
the restored project used separate high ports. Owned containers/networks/images
and private deployment/backup state were cleaned. Exact image IDs and CA
fingerprint are recorded in the run report; no credential values are reported.

No new IL-4 remote/LAN acceptance is claimed. Report 37's LAN/browser/recovery
results remain prior approved evidence. No testbox, existing infrastructure,
customer data, host trust/resolver/firewall or unrelated Docker resources were
changed. No Oxymotion or permanent stack deployment occurred.

## Final guard rerun and operational retry

The clean standalone command sequence was repeated at implementation
`adf56e04961c3974e0bd0ad481b1700a15d99c09`: all 124 units, 17 gateway,
17 services, 16 lifecycle tests, four HTTPS scenarios and packed-consumer checks
pass again. Repeated runs do not increase unique test counts.

The first fixture run against that guard stopped after nine groups with
`DOCKER_LIFECYCLE_COMMAND_FAILED`; its resources were cleaned. Cause remains
unestablished. A sequential retry with temporary test-only error classification
passed all 25 groups, actual interrupted Redis rotation and three browsers,
including SQL/MFS/ACL restoration; no Docker error classifier fired. No kernel
or production behavior was modified for that retry. This unreproduced failure
remains disclosed as an operational diagnostic limitation.

Successful final project `drumee-il3-kernel-6faacb7e` used loopback HTTPS 45625
and DNS 36623, with separate restored high ports. Owned resources were cleaned.
Its integrated archive has SRI
`sha512-yDUjkDIOotn3ujPV/zzWflwemWO/lEA1XYtharBZkWwH/Udc/ZBxK1Omzz0sxkvWhfPerIJwLpTYOxpD24XTlA==`.
The final documentation archive at source
`574a9307f57de813a54e678ccca3fa436fdf5076` has the SRI at the top of this report;
archive comparison proves runtime bytes identical, only PROVENANCE changed.
Image IDs and complete attempt/artifact evidence are pinned in the canonical
Infra Layer JSON record above.
