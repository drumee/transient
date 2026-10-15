# KB-01A — canonical platform authority correction

Historical KB-01A closure. [KB-01B report 41](41-kernel-operator-enrollment.md)
now records canonical first-operator enrollment using the published alpha.4.
The source-revision and no-enrollment statements below describe the original
KB-01A checkpoint, whose evidence remains preserved.

Status: **KB-01A — READY_FOR_TECHNICAL_REVIEW**.

The independent platform authorization contract is restored in canonical
server-runtime. Real SQL/session/dispatcher probes validate the correction
and preserve Domain, Hub and MFS isolation. No initial administrator enrollment
is implemented and IL-4 remains paused for its separately approved work.

## Revisions and ownership

| Repository / branch | Starting revision | Corrective / integration revision |
|---|---|---|
| drumee/server-runtime / main | `fc7d9de3f3e63baea8258885e55efe8e242904d0` | implementation `bfcbf66ecdef9d0ed1a3be054ed9c60329894b3c`; policy/migration documentation and immutable consumed source `a6c4dbf24b036255ea0dbfe70dbe80a402c990b0` |
| drumee/transient / refactor/mapping | `53432be57421147a3b282b4258f48507edb34913` | probes and lock `6033269963323dbc1b6c4360d3bbe53f99b26784`; this report is recorded by the subsequent documentation commit |

Source commits are pushed without rewriting history or release tags.
Transient consumes the canonical source archive; it does not update
`target/foundation/server-runtime` or create a second implementation.
Existing platform bootstrap, Hub lifecycle, MFS modules and IL-3 fixture are
unchanged. `sources/**` is unchanged.

The existing npm alpha remains byte-for-byte unchanged. Corrected source
retains package metadata `0.1.0-alpha.3` without claiming registry alpha.3 has
these APIs. KB-01B must use the exact corrected source artifact, or a future
separately approved release, rather than the old registry version alone.

Corrected archive:
`https://codeload.github.com/drumee/server-runtime/tar.gz/a6c4dbf24b036255ea0dbfe70dbe80a402c990b0`.
Lockfile integrity:
`sha512-Yyasa5Wm7PNh+jgBn0lk7JCIlUMoSIERT+4z/anIKNYDH4HbSmJ0p0uYocHM7gbd1su4dkrtbyEXD+Q14ruP6w==`.

## Historical evidence and selected policy

The evidence in report 39 remains valid for the old runtime. Historical
server-core `lib/acl.js::{check_remit,check_preprocess}` at
`bf7c396b14614f247507f771f72e98184ed931b4` dispatches scope `plateform` to an
independent `get_remit(uid)` lookup, with an any-bit intersection. Schemas
`cb838e255600a4ec3797dc7ac13659ad9d187421` separately store `drumate.remit`.
Current Essentials `b9460ba442c9962471a592c49ce36b01e0327ff5` defines remit
bits 1/2/4/8, a cumulative ROOT word 127, and domain-owner word 63.
Historical SQL `RETURNS BOOLEAN` is MariaDB's signed tinyint alias; the
diagnosis does not assume nonzero values are coerced to 1.

| Contract | Exact semantics |
|---|---|
| Platform permission | operator=1, support=2, manager=4, root=8 |
| PLATFORM_ADMINISTRATOR | named minimal complete remit mask **15**, requiring all four evidenced platform permissions |
| Platform check | `(grant & required) === required` for source and optional destination; never merely nonzero intersection |
| Root bit 8 | grants a root-only operation; does not imply bits 1, 2 or 4 |
| Stored legacy word 127 | preserved; covers 15, but 127 is not a supported requested permission mask |
| Domain privilege 63 | read exclusively by DomainAuthorizer/domain_permission; supplies no platform grant |
| Hub privilege / MFS resource ACL | independently checked for the selected Hub and every source/destination resource; no platform bypass |

Supported scope is `platform`; `plateform` is an explicit compatibility alias.
Descriptors accept named platform permissions, `PLATFORM_ADMINISTRATOR`, or
integer masks 1..15. Generic domain strings `read`/`admin`, cumulative request
words 63/127, zero, malformed values and unsupported bits fail explicitly.
Old Team descriptors are not imported or automatically reinterpreted.

The selected policy is not a role table, new identity kind or authentication
system. It grants nothing by itself. The future authorized enrollment job may
assign this exact independent remit to a human drumate after its own review.

## Canonical code changes

All implementation paths below are relative to server-runtime source `a6c4dbf`:

| Path | Responsibility |
|---|---|
| `lib/platform-authorizer.js` | dedicated human-session authorizer, policy constants, supported platform permission namespace |
| `lib/permission.js` | optional `platformAuthorizer` integration before public-api fast path; no domain/Hub/MFS fallback |
| `lib/descriptor-registry.js` | resolves platform descriptor permissions in their own namespace |
| `lib/yellow-page-store.js` | `platformRemit(uid)` calls canonical `get_remit` on every decision |
| `lib/platform-schema.js` | explicit additive migration execution and separate read-only schema validation |
| `lib/platform-authority.js`, `lib/index.js` | public exports; existing APIs preserved |
| `platform-authority.d.ts`, package subpath | precise declarations for `@drumee/server-runtime/platform-authority`; no partial root declaration masking old APIs |
| `schemas/yellow-page/platform-authority-v1.sql` | versioned guarded additive column/function migration |
| `schemas/SCHEMA_MANIFEST.json` | fresh-install order 30, additive-only upgrade inventory |
| `test/platform-authority.test.js`, `test/platform-mariadb.test.js` | exhaustive bitmask unit checks and real SQL/session/dispatcher integration |
| `test/artifact.test.js` | package includes migration/declarations, independent installed-consumer API verification |
| `docs/KB-01A-platform-authority.md`, README, PROVENANCE | policy, ownership, compatibility, prerequisites and historical attribution |

No new production dependency: existing websocket dependency is unchanged.
Pinned MariaDB connector 3.5.4 is development-only.

## Schema and upgrade contract

Schema version: `kb01a-platform-authority-1`. Upgrade prerequisite:
`phase4.5-runtime-schema-1`, exactly the qualified IL-3 base schema.
The manifest's upgrade entrypoint is **only** `platform-authority-v1.sql`.
Fresh installation retains orders 10 and 20 and appends order 30. Earlier
Phase 4.4 installations must complete their prior identity/session/OTAK
upgrade before this migration. Do not replay destructive fresh-install routine
scripts against an existing installation.

The additive script creates absent `drumate.remit` with default 0 and absent
`get_remit`; no identity, fingerprint, domain privilege, Hub or MFS data is
updated. Compatible signed historical tinyint columns and grants 0..127 are
preserved. Invalid ranges, null/default/generated column inconsistencies,
non-InnoDB identity storage, wrong ID shape or uniqueness, incompatible
function signature/body/security are rejected rather than overwritten.
The new lookup uses SQL SECURITY INVOKER, NOT DETERMINISTIC, READS SQL DATA,
and returns zero for a missing principal. The historical incompatible function
requires a separately approved migration, never DROP/CREATE replacement here.

`installPlatformAuthority({database})` is explicit execution through a native
DELIMITER-aware selected connection. DDL commits independently; no claim of
transactional multi-statement schema change is made. An interruption after
column creation leaves an additive retryable state. A controlled maintenance
window is required; this API is not a concurrent deployment scheduler.
`validatePlatformAuthority({database})` is read-only and fails closed.

Installer/diagnostic metadata access must expose routine definitions and
identity metadata; installation needs ALTER/CREATE ROUTINE. Runtime lookup
needs SELECT on `drumate(id,remit)` plus EXECUTE on `get_remit`, demonstrated
with a restricted actual SQL account that cannot read fingerprint. The host
validates the installed provider before serving administrative descriptors.
Custom injected stores are trusted composition providers, not client inputs.

## Authentication and dispatch guarantees

`PlatformAuthorizer` requires a completed normal authenticated human session,
consistent UID/domain and nonreserved drumate identity. Pending OTP, anonymous,
nobody, guest and system sessions are denied. Missing provider or lookup,
malformed grant and unsupported permissions produce stable redacted denials.
`public-api` cannot authorize a platform operation. No Domain/Hub authorizer
supplies a fallback. A new database lookup on every authorization observes
revocation without issuing another session. An already authorized in-flight
operation is not retroactively canceled.

`session_signin`, fingerprint hashing, session issuance, OTP semantics,
DomainAuthorizer, HubAuthorizer, existing MFS authorization, transport and base
SQL files have no implementation changes. The actual old-schema file digests
are checked by the SQL suite before the upgrade test, so the test does not
substitute a simplified old installation.

## Real integration evidence

Transient's private probe explicitly keeps the old registry alpha.3 under
`@drumee/server-runtime-legacy` and tests the corrected archive independently.
The SQL fixture uses actual canonical bootstrap, sessions, ModuleRegistry,
HubLifecycle, SqlHubStore, system-mfs installation/provisioning, MfsService,
MfsPermissionBackend, real SQL and the corrected runtime dispatcher.

Disposable human setup uses SQL INSERTs and explicit grant assignments only
inside probes. It is not first-operator enrollment or production provisioning.
The Hub creation policy invokes the real PlatformAuthorizer on the authenticated
session. A domain admin without remit cannot create a Hub under that policy.
An authorized human creates its own Hub/module namespace. A second human
temporarily receives an explicit test grant to create another Hub, then loses
that grant. The first platform administrator cannot list or copy into the
second Hub; even Hub-admin membership alone supplies no MFS resource grant.
After platform revocation its existing own-Hub MFS permissions still work.
Reserved identity snapshots and bootstrap validation remain unchanged.

## Executed validation

All final suites: **192 passed, 0 failed, 0 skipped**. Counts include TAP
parent tests; repeated clean-checkout executions are not added again.

| Suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Canonical runtime npm test, including 8 new authority cases and packed consumer | 56 | 0 | 0 |
| Canonical runtime real MariaDB migration/session/dispatcher | 16 | 0 | 0 |
| Transient operator probes: historical + corrected unit contracts | 8 | 0 | 0 |
| Transient real SQL bootstrap/Hub/MFS + historical diagnostic | 16 | 0 | 0 |
| Existing platform-bootstrap + Hub lifecycle units | 17 | 0 | 0 |
| Existing runtime/auth/WebSocket/HostFilesystem/FileIo/MFS/transfer/media regressions | 68 | 0 | 0 |
| Existing system-mfs filesystem/schema granularity/module units | 7 | 0 | 0 |
| Unchanged IL-3 distribution fixture units | 4 | 0 | 0 |

Canonical validation was repeated from a fresh independent GitHub clone at
`a6c4dbf24b036255ea0dbfe70dbe80a402c990b0`, with clean npm ci:

```sh
git clone --single-branch --branch main https://github.com/drumee/server-runtime.git /tmp/drumee-kb01a-clean-runtime
git -C /tmp/drumee-kb01a-clean-runtime rev-parse HEAD
cd /tmp/drumee-kb01a-clean-runtime
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:platform:integration
npm pack --dry-run --ignore-scripts --json
```

The revision check preceded testing; reruns must checkout the exact SHA if
main moves. Packed-consumer validation uses the installed package, clears
NODE_PATH and verifies root and typed-subpath APIs. Tarball allowlist inspection
found production source, schema, declaration, license and documentation only,
no generated secrets, test state, node_modules or local-path dependencies.
The allowlist contains 33 files. Dry-run package SHA-512 (not a publication):
`sha512-HH/crY0nu7KwMcSkgFMBkQHuX5Q8p/ErVWEpKC/h3+4ycDUR6Y/LX0D1I1FbO/h1VxWyWbrIlwOaFzOdYY8nKg==`.

The transient probe was also reproduced with `npm ci`, `npm test` and
`npm run test:integration` in a fresh detached clone at integration commit
`6033269963323dbc1b6c4360d3bbe53f99b26784`: 8 unit and 16 SQL TAP tests pass
again, without failures/skips or a sibling checkout. Both clean working trees
remain unchanged after validation, and no KB-01A Docker containers remain.

From transient root, the probe and unchanged regressions were run with:

```sh
npm install --ignore-scripts --no-audit --no-fund --prefix target/control-plane/operator-bootstrap
cd target/control-plane/operator-bootstrap
npm test
npm run test:integration
# From repository root:
node --test target/control-plane/bootstrap/test/bootstrap.test.js target/control-plane/hub-lifecycle/test/hub-lifecycle.test.js
node --test target/foundation/server-runtime/test/auth-domain.test.js target/foundation/server-runtime/test/binary-upload.test.js target/foundation/server-runtime/test/hub-authorization.test.js target/foundation/server-runtime/test/mfs-authorization.test.js target/foundation/server-runtime/test/server-runtime.test.js target/foundation/server-runtime/test/websocket-push.test.js target/modules/host-filesystem/test/host-filesystem.test.js target/modules/mfs-service/test/service.test.js target/modules/mfs-transfer/test/transfer.test.js target/modules/media-service/test/media.test.js
node --test /home/somanos/github/transient/target/control-plane/operator-bootstrap/node_modules/@drumee/system-mfs/test/filesystem.test.js /home/somanos/github/transient/target/control-plane/operator-bootstrap/node_modules/@drumee/system-mfs/test/sql-granularity.test.js /home/somanos/github/transient/target/control-plane/operator-bootstrap/node_modules/@drumee/system-mfs/test/system-mfs.test.js
cd target/distributions/minimal-kernel-il3
npm test
```

Absolute paths above record the actual invocation, not a runtime dependency.
For another clone, substitute its repository root. An initial relative test
invocation failed before discovery and was rerun with these explicit paths.
During development one canonical SQL test initially selected no public worker
for an anonymous request, so dispatch stopped before authorization. Its fixture
was corrected to expose the worker for both modes; the unchanged dispatcher
then exercised and denied the anonymous request as required. Final suites have
no failures or skips; no production behavior was weakened to satisfy a test.

## Safety, compatibility and remaining work

Docker tests use unique owner-labelled containers, digest-pinned MariaDB,
tmpfs database storage and random loopback-bound ports. Administrative passwords
are generated per run in private temporary files; adapter failures are
sanitized, and no credentials or sensitive SQL appear in diagnostics. Cleanup
checks ownership and removes only the test's container and temporary directory.
No existing volumes, databases, network settings or services were modified.

No testbox access/deployment, npm/image publication, tag rewrite, Infra Layer
change, Debian SQL enrollment, system trust change or Oxymotion work occurred.
The full IL-3 HTTPS/browser/restart/backup/restore acceptance was not rerun:
HTTP, FileIo, WebSocket and lifecycle implementations are unchanged; this
correction qualifies the new SQL/session/authorization branch and the listed
regressions, not a new distribution release. Existing IL-3 fixture source is
preserved and has not been switched to KB-01B enrollment.

Remaining: review this platform policy/provider contract; authorize KB-01B
transactional first-human enrollment, credential acquisition/handoff and
durable exclusivity/crash recovery; subsequently integrate its source-pinned
job into the distribution under separate approval. No automatic KB-01B or
IL-4 continuation is authorized by this technical closure.
