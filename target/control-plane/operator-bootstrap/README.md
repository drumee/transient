# KB-01B — Canonical initial operator enrollment

Private CommonJS installation-time control plane. Runtime dependency is the
published `@drumee/server-runtime@0.1.0-alpha.4`, registry integrity pinned in
package-lock. Legacy alpha.3 remains a diagnostic test alias only.

`enrollInitialOperator(options)` and `validateInitialOperator(options)` provide
version-1 enrollment and read-only validation. `installOperatorSchema(options)`
applies the separately authorized additive migration before enrollment DML.
No HTTP registration endpoint, alternate authentication system or Hub creation
is installed by this module.

## Invocation

Supply `contract_version: 1`, a dedicated MariaDB `database.connection`,
`domain`, `organisation_id: 1`, stable `operation_id`, and
`identity: {username, email}`. Supply trusted installation authorization:
`{authorized: true, scope: "initial-operator", operation_id, domain,
organisation_id: 1}`. This is a host authorization decision, never an anonymous
client claim. Validate canonical platform bootstrap and KB-01A first; the API
rejects missing or inconsistent prerequisites without repair. Distributions
projecting the module elsewhere may inject the same canonical `platform`
bootstrap validator. Pooled query facades are rejected.

Create `credential_provider` with
`createFileCredentialProvider({mode, file, password_fd, input, output})` and
pass it to enrollment. Result fields are contract_version, valid, uid,
operation_id, policy, changed. No password or fingerprint is returned.

## Credentials

Exactly three modes share the same SQL policy: `test`, `interactive`,
`automatic`. Test/automatic generate 32 cryptographic random bytes encoded
base64url once per resource. Interactive reads a private owned regular-file
FD (>=3) or uses a raw, non-echoing TTY prompt with confirmation. Without a
secure input channel it fails; there is no generation fallback. No password
argument, environment variable or implicit Unix administrator is accepted.
The host supplies explicit username/email; automatic installations may use
username `admin`.

The operator must provide an existing owned 0700 parent directory. Files are
0600, owner-only, with no symlink ancestors/leaf or extra hardlinks. Unsafe
writable ancestors are rejected. An exclusive writer lock, non-overwriting
atomic file link, fsync and intent checksum protect creation. Credentials bind
the operation/domain/organization/identity/mode and persist before SQL.
Existing material is reused; malformed state or stale locks fail closed,
requiring explicit operator investigation. No stale-lock takeover occurs.

Explicit retrieval is `retrieveInitialCredential({file, authorization:
{authorized:true, scope:"retrieve-initial-credential", operation_id}})`.
It returns a password Buffer to the trusted process for protected delivery;
clear it after use. Never write it to ordinary stdout, Docker/CI logs or
reports. Enrollment only reports success; the distribution reports the
resource location and operator retrieval procedure. Preserve the resource in
protected backups. Initial delivery is separate from future account recovery.
Buffers are cleared where feasible; immutable JavaScript/JSON strings cannot
be reliably zeroized. Operator UID/root compromise is outside this boundary.

## SQL policy and crash behavior

A single versioned `initial_operator_enrollment` row is locked FOR UPDATE
through principal creation, canonical SHA-512 fingerprint, remit assignment,
completion marker and commit. Every statement uses the same native dedicated
connection. The normal human drumate has personal/active state, independent
PLATFORM_ADMINISTRATOR remit 15 and basic Domain privilege 1. It receives no
implicit Hub/MFS rights. Reserved identities remain unchanged.

Concurrent identical requests create once and replay the same UID. Changed
operation/identity/credential commitments conflict. Existing administrators,
username/email collisions and corrupt state fail closed. Replays preserve
UID/password/remit; they never reset credentials or restore a revoked grant.

Before commit, failures roll back the whole enrollment. After commit, a lost
acknowledgment is recovered from the persistent credential resource and marker.
DDL is separate and nontransactional. A crash between creating the table and
seeding its guard requires explicit investigation; an existing empty table is
never silently adopted. Validation is read-only and rejects enrollment-state
drift; later authenticated identity maintenance/recovery is separate. Arbitrary
privileged DBA SQL is outside enrollment-writer mutual exclusion.

## Tests and ownership

Run `npm ci --ignore-scripts --no-audit --no-fund`, `npm test`, and
`npm run test:integration`. Tests use uniquely owned disposable MariaDB,
private generated credentials and loopback dynamic ports. Real authentication,
separate-connection concurrency, disconnect rollback, commit acknowledgment
loss, all interruption checkpoints, canonical Hub provisioning and per-resource
MFS denial are covered. The IL-3 fixture consumes a pinned source projection;
reader/outsider creation remains strictly disposable test-only setup.

No npm publication, permanent deployment, Infra Layer policy or Debian-owned
SQL enrollment is introduced. See
[report 41](../../../docs/refactoring/41-kernel-operator-enrollment.md).
