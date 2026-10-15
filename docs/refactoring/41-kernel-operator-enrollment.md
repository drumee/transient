# KB-01B — canonical first platform administrator enrollment

Status: **KB-01B — READY_FOR_TECHNICAL_REVIEW**.

## Ownership, revisions and published dependency

Implementation is in `drumee/transient`, branch `refactor/mapping`, starting
from clean approved `7c2e3b0a3ea5d75623c67faa123e48d6eb9b1052`. No kernel,
runtime, Infra Layer, Debian or immutable source implementation is changed.
KB-01B does not resume IL-4 or publish a package/image.

| Commit | Checkpoint |
|---|---|
| `3e0bb2f81355c856f38880e7c9513eea5b54a4e0` | Canonical enrollment, dedicated SQL store, additive singleton schema, filesystem credential provider, unit/SQL tests |
| `6856ea491bbde55d146e92f68b9b206355c6585d` | Reject caller transactions and non-InnoDB identity tables |
| `908f65300f4a017f86f0a2dce5ee63d60f6b61ec` | Non-echoing input, provider/hook error redaction, actual two-process concurrency and reproducible PTY probe |
| `47d1c7d9750287852f342790c2788bcca1182bf8` | Explicit owner-authorized credential delivery to controlling TTY only |
| `dfaf3268278c05711dca51668de568ddf2a1c159` | Fixture uses published authority, canonical enrollment and platform-authorized Hub creation; first clean lifecycle qualification |
| `4424fde877eb12a719d6057449ba11aa245244fd` | Immutable durable providers; completed enrollment cannot generate a missing credential anew |
| `d15d70179a13064fcf50bcfa89152afed771a7bc` | Final fixture source pin and clean-checkout qualification revision |

All implementation commits are pushed without rewriting history. This report
and final provenance updates are recorded by the subsequent closure commit.

Registry verification before implementation confirmed:

```text
Package: @drumee/server-runtime@0.1.0-alpha.4
gitHead: f961f6214432c2e6dbbcde2b926544c076935950
dist.integrity: sha512-bOZ/v6/4mQ/FPa8iE21polPx2PjJWFYTKqTz+2duqxI2ljpviemNgOtpwkxF4j/1Xn/1aVIxdvVCc8Tch2ctEQ==
dist.tarball: https://registry.npmjs.org/@drumee/server-runtime/-/server-runtime-0.1.0-alpha.4.tgz
next: 0.1.0-alpha.4
latest: 0.1.0-alpha.1
```

The control plane and distribution pin that exact npm release with registry
SRI in their locks. There is no source-copy or alpha.3 fallback. Alpha.3 is
retained only under the explicit development alias server-runtime-legacy to
preserve the old diagnostic. Existing system-mfs source remains pinned at
`53101c4a995ffca9118f795ab5d4c7c731200a2f`. Fixture projections acquire only
allowlisted Git blobs from immutable transient source `4424fde877eb12a719d6057449ba11aa245244fd`.

## Public version-1 contract

Implementation: `target/control-plane/operator-bootstrap/lib/` (CommonJS,
private transitional control-plane module, no standalone publication).

| API | Purpose and side effects |
|---|---|
| installOperatorSchema(options) | Explicit authorized additive DDL before enrollment DML; refuses incompatible/partial existing state |
| enrollInitialOperator(options) | Authorized one-time human identity and remit creation, or an unchanged idempotent replay |
| validateInitialOperator(options) | Read-only SQL/bootstrap/authority/initial-identity validation; no repair or credential creation |
| createFileCredentialProvider(options) | Immutable filesystem provider for one of three acquisition modes; persists material before SQL |
| retrieveInitialCredential(options) | Explicit operator-authorized protected delivery, returning a transient password Buffer to trusted code |
| promptPassword(options) | Raw non-echoing TTY acquisition with confirmation; no interactive-to-automatic fallback |

Enrollment options use backend snake_case:

```js
const operator = require('./target/control-plane/operator-bootstrap/lib');
const intent = {
  contract_version: 1, database, domain: 'drumee.lan', organisation_id: 1,
  operation_id: 'deployment-first-admin-1',
  identity: { username: 'admin', email: 'admin@drumee.lan' },
  authorization: {
    authorized: true, scope: 'initial-operator',
    operation_id: 'deployment-first-admin-1',
    domain: 'drumee.lan', organisation_id: 1
  }
};
await operator.installOperatorSchema(intent);
const result = await operator.enrollInitialOperator({
  ...intent,
  credential_provider: operator.createFileCredentialProvider({
    mode: 'automatic', file: '/operator-owned-private-directory/credential.json'
  })
});
// result: {contract_version, valid, uid, operation_id, policy, changed}
// No password, fingerprint, raw SQL or infrastructure credential is returned.
```

Authorization is a trusted installation-host decision, not a public bearer
token or an anonymous HTTP JSON assertion. The distribution must authorize its
operator before constructing it. This module has no HTTP enrollment endpoint.
Domain, organization and operation must match the authorization exactly.
Organization is canonical 1; domain must be explicit, valid lowercase hostname;
operation is an opaque 8..128-character ASCII token. Username is an explicit
lowercase ASCII human login, with reserved nobody/guest/system rejected. Email
is required by the current canonical schema, ASCII, at most 128 characters.
Unknown identity-policy fields such as a caller-supplied remit are rejected.

## Human identity and authority

The principal is a normal drumate: entity type drumate, area personal, status
active, domain/organization 1. UID comes from canonical uniqueId(). The API
sets canonical SHA-512 fingerprint semantics required by session_signin and
assigns the published runtime's named PLATFORM_ADMINISTRATOR remit **15**.
It neither invents another hash nor checks passwords against its marker.
Authentication always uses the existing runtime SQL/session implementation.

The independent remit requires all operator/support/manager/root bits
1/2/4/8. Domain membership is the minimal bit 1, not organization administrator
63 or 127. This also agrees with historical drumate_create's default privilege
1 (immutable schemas revision cb838e255600a4ec3797dc7ac13659ad9d187421), without
importing that historical provisioner. Domain-read permission bit 2, Domain
admin bit 16, Hub privileges and MFS resource permissions are separate.
Platform authority does not confer their checks or bypass them.

Reserved identities and credentials are untouched. Enrollment creates no Hub,
MFS namespace, schema shard, application data or filesystem workspace. The
logical entity path is metadata only. Subsequent Hub creation is performed
through a real authenticated session and the existing HubLifecycle can_create
policy invoking PlatformAuthorizer. The SQL/MFS probe also demonstrates that a
platform administrator cannot cross into an unrelated Hub; even Hub-admin
membership alone supplies no MFS node grant.

## Acquisition, persistence and explicit delivery

Exactly test, interactive and automatic are supported. All use identical
identity/privilege DML. Test/automatic generate 32 cryptographic random bytes
encoded base64url, once per installation resource. The distribution supplies a
stable explicit identity, such as admin; no Unix username is mapped to it.
No test password or historical acceptance credential is reused.

Interactive acquisition accepts either a private owned regular-file descriptor
(>=3) or a TTY. The TTY enters raw mode before prompting, confirms the password,
restores terminal mode, and rejects missing secure input, cancellation and
mismatch. An actual PTY test verifies absence of echo and restoration. There
are no password CLI arguments or ordinary environment variables. Supported
initial passwords are valid UTF-8, 16..128 bytes, without NUL/newline.

All initial providers are immutable instances of this module's filesystem
provider. Arbitrary callbacks cannot substitute ephemeral material. Additional
provider implementations require a separate durability contract; no generalized
secret-platform abstraction is introduced.

The resource parent is explicitly supplied, owned by the process/operator and
0700. Ancestors/leaf cannot be symlinks; unsafe writable ancestors are rejected,
with the normal sticky temporary-directory boundary supported. Resource reads
use O_NOFOLLOW and fstat, require a regular 0600 owner file and exactly one link.
The JSON binds operation, organization, domain, identity, mode and checksum.
The checksum detects corruption; it is not encryption or proof against an
attacker controlling the owner UID. Tempfile write/fsync, non-overwriting atomic
link, directory fsync and a short exclusive lock precede SQL enrollment.
Existing content is never truncated or overwritten.

Ordinary retries, restart and recreation preserve the resource. A completed SQL
marker forbids resource creation: a missing file fails without generating a
replacement, rather than leaving a new unusable password beside an old account.
An explicit candidate with changed credentials conflicts. Stale locks, malformed
JSON/checksum/ownership/mode and extra links fail closed; no stale-lock takeover
or automatic repair is attempted. The operator must investigate partial writes
or restore protected backup material.

The normal installation reports success and the configured resource location,
not its contents. The dedicated retrieval procedure is:

```sh
node target/control-plane/operator-bootstrap/scripts/retrieve.js \
  --authorize-retrieval --resource /operator-owned-private-directory/credential.json \
  --operation-id deployment-first-admin-1
```

This checks ownership/operation binding and requires an interactive input and
controlling TTY. It writes the secret only to /dev/tty, never ordinary stdout,
and refuses a noninteractive invocation without fallback. The explicit flag
acknowledges delivery; OS ownership authorizes access. Trusted distribution code
may instead use retrieveInitialCredential and a protected delivery channel.
Never log or terminal-record that channel. Buffers are cleared where feasible;
immutable JavaScript/JSON strings cannot be reliably zeroized. Keep the only
automatic credential copy until authorized delivery and backup. This is not
account recovery, password rotation or an authentication backdoor.

## SQL schema, connection and concurrency

The additive version is kb01b-initial-operator-1, declared in
schemas/SCHEMA_MANIFEST.json. installOperatorSchema requires an idle dedicated
native MariaDB connection via database.connection, autocommit enabled, valid
canonical bootstrap, the KB-01A migration and authentication procedures.
Entity, drumate, privilege and the enrollment table must be InnoDB. A pooled
query facade or caller transaction is refused. No DDL runs during enrollment.

The singleton initial_operator_enrollment row is seeded explicitly at schema
installation. Schema shape, engine, key metadata and singleton version are
validated. A pre-existing empty/inconsistent table is not silently adopted.
Because MariaDB DDL commits independently, an interruption between CREATE TABLE
and guard seed requires explicit operator investigation. No DROP/reinitialization
or destructive repair is implemented.

Enrollment acquires SELECT FOR UPDATE on row 1. The same dedicated connection
performs all entity, fingerprint, remit, Domain-membership and completion-marker
DML, final validation and COMMIT. It never switches to pool-level queries.
The marker binds operation, UID, identity commitment and credential fingerprint;
it contains no plaintext password. Unique singleton, operation and UID keys
support durable exclusivity. An existing full remit grant anywhere without a
matching completion record is conservatively refused, including legacy state
requiring operator review; no existing account is adopted.

Two real deployment processes were raced, in addition to separate-connection
tests. Only one creates the initial administrator. Genuinely identical
operation/identity/credential commitments replay the same UID, without writes
to account credentials or privileges. Different requests conflict. A lock in
one Node process is not the identity concurrency mechanism. All canonical
first-enrollment writers must use this guard; arbitrary privileged DBA SQL is
outside this mutual-exclusion guarantee.

Installer SQL permissions include CREATE for the new table and guard INSERT;
enrollment needs SELECT on bootstrap/identity/enrollment metadata, EXECUTE on
uniqueId, INSERT on entity/drumate/privilege and UPDATE on remit/marker. Runtime
authority metadata validation requires routine-definition visibility. These are
privileged control-plane/job permissions, not a reason to grant ordinary runtime
accounts global administration. The disposable IL-3 broad SQL fixture remains
test-only; production least-privilege separation is still IL-4 work.

## Interruption and drift semantics

Tested boundaries: before credential preparation; prepared credential; before
transaction; principal inserted; fingerprint inserted; remit/Domain privilege
assigned; marker written; before commit; after commit before acknowledgment.
Precommit failures leave no committed human/partial administrator. Prepared
credentials remain available for retry. An actual connection destruction after
fingerprint insertion verifies server-side rollback, followed by enrollment on
a new connection. A lost postcommit acknowledgment is retried through a new
provider/connection with unchanged UID, fingerprint, remit and resource bytes.

Conflicting username/email, existing administrator, bad authorization, wrong
organization/domain, missing platform/authentication schemas, invalid provider,
wrong/revoked remit and corrupted marker all fail closed. Errors use stable
OPERATOR_* codes without raw SQL, provider messages, credential values or paths.
Representative codes include AUTHORIZATION_REQUIRED, DEDICATED_CONNECTION_REQUIRED,
CONNECTION_NOT_IDLE, PLATFORM_INVALID, AUTHORITY_UNAVAILABLE, IDENTITY_CONFLICT,
ENROLLMENT_CONFLICT, STATE_CORRUPT and CREDENTIAL_PREPARATION_FAILED with the
OPERATOR_ prefix. Read-only validation returns diagnostic_codes on failure.

Validation intentionally checks the recorded initial identity/credential/grant.
It does not restore a revoked remit or silently reset a subsequently changed
password, MFA configuration or Domain privilege. Legitimate later account
maintenance and recovery need a separate authenticated contract.

## IL-3 fixture and recovery integration

The fixture calls canonical enrollment for il3-owner in test mode before normal
sign-in and Hub creation. Only reader/outsider remain explicit disposable SQL
setup. Its private operator-credential.json is mounted into the init job only;
neither gateway nor running kernel receives that credential resource. The
owner entry in principals.json contains UID/email, no password.

The fixture-only context endpoint now uses platform authority. An exploratory
run correctly denied its previous Domain-read request for the minimal member
identity (403); the test helper was corrected to require PLATFORM_ADMINISTRATOR,
without granting additional Domain privileges or relaxing kernel ACL. The
platform_info observation endpoint is also platform-scoped. Owner succeeds,
reader/outsider fail through actual HTTP/runtime dispatch.

Backup inventory includes acceptance credential state, SQL completion marker,
fingerprint/remit, identities, Hub/MFS ACL and content. Tests compare credential
resource bytes and canonical SQL/ACL/MFS digests before/after restart and isolated
restore, preserve the CA identity, and repeat real login and platform checks.
Old direct-SQL owner fixtures are not adopted or reset; use a fresh disposable
deployment or matching canonical backup. No production installer is added.

## Validation commands and results

Final applicable TAP suites: **218 passed, zero failures, zero skips**. Counts
include TAP parent/group tests; repeat clean-checkout runs are not added twice.

| Suite | Passed |
|---|---:|
| Control-plane unit tests, including retained KB-01/KB-01A evidence | 18 |
| Real MariaDB enrollment/concurrency/crash/auth/Hub/MFS plus retained probes | 31 |
| Canonical runtime unit/package/session/dispatcher/platform tests | 56 |
| Canonical runtime real MariaDB platform-authority tests | 16 |
| Existing platform bootstrap and Hub lifecycle units | 17 |
| Existing runtime/HostFilesystem/FileIo/MFS/transfer/media regressions | 68 |
| Existing standalone system-mfs applicable unit tests | 7 |
| Distribution fixture units (four preserved, one added) | 5 |

Additional non-TAP validation: real PTY no-echo/restoration; full Docker/HTTPS
fixture lifecycle with **28 grouped functional checks (10 fresh, 9 restart,
9 isolated restore)**, including three Chromium LETC/Finder/WebSocket checks
and actual interrupted Redis rotation recovery. The prior 25 functional groups
are preserved and one platform-dispatch group is added at each stage. Browser
documents/scripts/fetches succeed; an expected missing favicon remains 404,
with no JavaScript or required-resource loading failures. HTTPS requests validate
the local CA; disposable Chromium uses the existing scoped SPKI allowlist and
host mapping. This is not LAN-client/system-trust acceptance.

The final independent clone is pinned at d15d70179a13064fcf50bcfa89152afed771a7bc:

```sh
git clone --single-branch --branch refactor/mapping https://github.com/drumee/transient.git
cd transient
git checkout --detach d15d70179a13064fcf50bcfa89152afed771a7bc
npm ci --ignore-scripts --no-audit --no-fund --prefix target/control-plane/operator-bootstrap
npm test --prefix target/control-plane/operator-bootstrap
npm run test:integration --prefix target/control-plane/operator-bootstrap
npm run test:tty --prefix target/control-plane/operator-bootstrap
npm ci --ignore-scripts --no-audit --no-fund --prefix target/distributions/minimal-kernel-il3
npm test --prefix target/distributions/minimal-kernel-il3
npm run test:integration --prefix target/distributions/minimal-kernel-il3
```

Prerequisites: Node 22, Docker/Compose, Git/network for pinned acquisitions,
Python 3 for the real-PTY probe, dig and Chromium for acceptance. No sibling
checkout, cached historical runtime or prior installation is required. Sources
are acquired explicitly by the fixture's source script; frontend uses the
existing CommonJS/Webpack/LETC path. npm ci checks immutable archive integrities.
Source/Git integrity, runtime version and registry SRI are asserted by probes.

Existing regressions were executed with node --test against:
bootstrap/test/bootstrap.test.js; hub-lifecycle/test/hub-lifecycle.test.js;
target/foundation/server-runtime test auth-domain, binary-upload, hub-authorization,
mfs-authorization, server-runtime, websocket-push; and host-filesystem, mfs-service,
mfs-transfer, media-service unit files. system-mfs filesystem, sql-granularity
and system-mfs tests run from the locked development archive. Canonical runtime
npm test and npm run test:platform:integration were rerun in its unchanged
standalone checkout. Report 40 records the same baseline file/command inventory.

No mandatory KB-01B path is silently skipped. No new general Infra Layer service
qualification, SMTP-spool recovery or permanent LAN qualification is claimed.
An initial top-level npm invocation failed before test discovery and was rerun
with the explicit module prefix. The exploratory Domain-read fixture failure
described above was fixed in the distribution helper; final results exclude
failed exploration and count only successful applicable suites.

## Safety and remaining boundaries

All SQL/container experiments use disposable, uniquely owned resources,
loopback high ports and generated private credentials. Backup restoration targets
a new owned environment. Cleanup verifies project/image ownership and removes
only test-created containers/networks/images/durable test state; private local
diagnostic reports may remain. Unrelated running services/data are untouched.

No testbox connection or permanent deployment; no npm/image publication, tag
rewrite, Infra Layer identity policy, Debian SQL enrollment, historical schema
change, host DNS/CA/firewall change or Oxymotion work occurred. The standalone
runtime is consumed as published and remains unchanged. sources/**, canonical
bootstrap, Hub lifecycle, MFS and authorization implementations are unchanged.

Limits: local Unix filesystem provider only; a stale/interrupted lock or partial
DDL needs operator investigation; no automatic recovery/password reset; metadata
drift after later legitimate account changes needs its own contract; privileged
DBA/root/owner-UID compromise is outside this mechanism. The fixture is a disposable
minimal profile, not a production Debian installer or IL-4 release qualification.
Technical review of KB-01B is required before any IL-4 resumption.


## Final clean-checkout deployment evidence

The independent GitHub clone at `d15d70179a13064fcf50bcfa89152afed771a7bc`
completed the final module/TTY and whole Docker lifecycle successfully, with
an unchanged tracked working tree. Machine-readable sanitized evidence is in
[41-kernel-operator-enrollment.validation.json](41-kernel-operator-enrollment.validation.json).
No credential value, credential fingerprint or private key is included in that evidence.

```text
Project: drumee-il3-kernel-ab86f57d
Composition: 40b3fa473bb78dcde547f33f3331281d676fb43cb9610a230ad8d58346e0c28e
Kernel image: sha256:7fcdde6b2839081c3f5a016c4f08eb80adedd4682f83c731fa00deef92768840
Tools image: sha256:2a0e5595df115695e2fa100b15730371c1cec16e78d3a5264bd265bc2f0f44f6
HTTPS test binding: 127.0.0.1:34737
DNS test binding: 127.0.0.1:33139 (TCP/UDP)
Functional checks: 10 fresh + 9 restart + 9 isolated restore
Chromium: 3 successful runs
Interrupted Redis rotation: recovered
Initial credential bytes, SQL/ACL/MFS state, CA identity: preserved
Owned resources: cleaned
```

Images were built locally and removed by their owned harness; no registry
publication occurred. Private diagnostic directories remain local under /tmp.
These loopback tests do not claim LAN-wide DNS or permanent acceptance.

Only closure documentation/provenance changes follow the pinned implementation
qualification; there is no control-plane or fixture runtime-code drift.
