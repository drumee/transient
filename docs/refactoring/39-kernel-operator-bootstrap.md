# KB-01 — canonical first platform administrator: contract gate

Historical diagnostic at `53432be57421147a3b282b4258f48507edb34913`.
[KB-01A](40-kernel-platform-authority.md) now supplies the canonical runtime
correction and real SQL/Hub/MFS validation. This report retains the original
blocking evidence. First-administrator enrollment is still not implemented;
KB-01B and IL-4 resumption require separate review/approval.

Status: **KB-01 — CONTRACT_BLOCKED**. The requested enrollment cannot correctly
grant platform administration through the selected minimal runtime. No fake
administrator, independent privilege authority or enrollment API was shipped.

## Starting state and completed checkpoint

Repository: `https://github.com/drumee/transient`, branch `refactor/mapping`.
Approved/actual starting HEAD: `4f6919f8248dc733dff16ee355cdef5b93ebf252`,
clean working tree. No branch switch, history rewrite or sibling repo change.

Test checkpoint `87a869eed880dbce656e04c592ffd09ad3c2d291` adds a private
CommonJS probe, its exact dependency lock and executable tests under
`target/control-plane/operator-bootstrap/`. The package intentionally has no
production entry point. Canonical server-runtime was inspected at
`fc7d9de3f3e63baea8258885e55efe8e242904d0`; its published alpha.3 is pinned
with registry SHA-512 integrity in the new lockfile. The probe also tests the
unchanged transitional runtime at this repository baseline.

## Actual privilege and authentication model

Three distinct mechanisms must not be conflated:

| Mechanism | Producer/storage | Consumer | Scope |
|---|---|---|---|
| Domain privilege | `yp.privilege(uid,domain_id,privilege,is_authoritative)` | `domain_permission()` and `DomainAuthorizer` | One organisation/domain |
| Hub/MFS privileges | Hub ACL and module-owned shard permissions | HubAuthorizer/MFS permission backend | Explicit Hub/resource, actual ACL checks |
| Historical platform remit | `yp.drumate.remit` | `get_remit(uid)`, historical `Acl.check_remit()` | Platform services, separate from domain privileges |

Historical source evidence, pinned in SOURCE_MANIFEST:

- `sources/server-core/lib/acl.js:148–170`: scope **plateform** dispatches to
  `check_remit`; `:266–273` calls `yp.get_remit(uid)` and tests requested bits.
- `sources/schemas/yellow_page/tables/drumate.sql:6`: independent `remit` column.
- `sources/schemas/yellow_page/procedures/directory/get_remit.sql`: selects
  `drumate.remit`. It is not a wrapper around domain_permission.
- `sources/server-team/acl/devel.json`: actual historical platform descriptors
  use plateform. These Team services are evidence, not imported kernel services.
- `sources/server-essentials/lib/lex/remit.js`: ROOT cumulative word 127 and
  DOM_OWNER 63; Constants.REMIT_ROOT is a distinct root permission bit 8.
  Neither is interchangeable with Hub/domain admin permission bit 16.

Authentication itself is available and works: the actual `session_signin`
matches `fingerprint=SHA2(password,512)`, issues/resolves a cookie and normal
KernelSession, checks configured reserved identities and exposes a human
`kind='drumate'`. There is no justification for another password/session system.

The current platform bootstrap correctly creates only organisation 1 and the
reserved nobody/guest/system principals. Its system helper writes empty
fingerprints and system status; these semantics must not be copied to a human.
HubLifecycle requires an authenticated human and applies its injected can_create
policy. It is not a platform-role resolver. The IL-3 fixture's organisation-1
can_create policy is acceptance policy, not proof of platform administration.

## Exact missing runtime contract

Affected owner: **drumee/server-runtime**, selected alpha.3/source commit above.
The matching files under `target/foundation/server-runtime` have the same gap:

1. `schemas/yellow-page/phase4-schema.sql` omits `drumate.remit`.
2. `schemas/SCHEMA_MANIFEST.json` includes uniqueId/domain_permission but no
   get_remit or additive platform authority migration.
3. `lib/yellow-page-store.js` exposes domainPermission, no platform-remit lookup.
4. `lib/permission.js::createAuthorizer()` routes domain, hub and mfs (plus the
   existing public-api fast path). Both plateform and platform return
   `UNSUPPORTED_PERMISSION_SCOPE`; there is no injected platform authorizer.
5. `lib/index.js` exports no platform authorizer. Merely adding an enrollment
   table/policy label in the control plane would not make a grant visible to
   canonical kernel authorization.

Writing 63 in domain privilege enrolls an organisation owner, not the requested
platform administrator. Writing 127 there remains domain-scoped. Using a root
cumulative word as a DomainAuthorizer request is also wrong: domain_permission
returns a nonzero intersection, so a 63 domain owner passes a 127 request.
Using an unnamed extra domain bit or treating organisation 1 as globally
authoritative would invent policy and silently reinterpret existing contracts.

`PLATFORM_ADMINISTRATOR` is therefore a **required, currently unsupported policy**,
not an implemented numeric constant. The absent authority contract must be
resolved by the runtime owner before KB-01 can assign a valid canonical grant.

## Executed real SQL evidence

The probe starts a fresh uniquely labelled MariaDB using the existing pinned
IL-3 digest. It has a dynamic 127.0.0.1-only port, tmpfs data and a random private
temporary administrative credential file. It installs the actual package-owned
runtime manifests with the native MariaDB client (including DELIMITER handling),
then invokes the unchanged canonical platform bootstrap on a dedicated connector
connection. No historical Team SQL or live database is used.

Actual engine/runtime results:

- information_schema reports no drumate.remit/get_remit. SELECTs fail with MariaDB
  1054 (column absent) and 1305 (function absent), rather than inferred source gaps.
- Two disposable active human counterexamples with random credentials and domain
  words 63/127 authenticate through the unchanged session_signin, obtain normal
  sessions and resume through SessionManager. Wrong passwords fail.
- Domain admin authorization succeeds for both, while domain_permission against
  another domain is zero. A cumulative 127 domain request also passes for 63,
  confirming it cannot identify platform administration.
- Actual ServiceDispatcher calls with those real authenticated sessions deny
  both platform scope spellings with PERMISSION_DENIED /
  UNSUPPORTED_PERMISSION_SCOPE before loading any worker.
- All reserved identity credentials and privilege rows remain byte-for-byte
  unchanged; wrong-password sign-in remains rejected and bootstrap validates.

The test-only SQL counterexamples are explicitly not an enrollment job or a
proposed administrator policy. No production administrator was created.
The connector reduces failures to stable codes/errno and Docker errors to a
stable probe code; SQL parameters, credentials and raw daemon errors are not
reported. Credentials are not CLI arguments/environment values, Git files,
image layers or package inputs. The owned container and temporary files are
removed after the test. Root TCP is enabled solely in that disposable,
loopback-published test engine, not as a deployment recommendation.

The probe's SQL connection is dedicated, not pooled. Its test-only identity
INSERTs use one connection with START TRANSACTION/COMMIT/ROLLBACK; intrinsic DDL
is installed separately beforehand. This describes the probe, not a validated
future enrollment transaction or crash-recovery guarantee.

## Smallest proposed canonical correction

Require a separate runtime/control-plane correction decision before continuing:

1. Restore the narrow platform-remit schema closure as an **explicit versioned
   additive runtime migration**: the dedicated grant field and source-derived
   get_remit lookup. Do not install the full historical schema or replay the
   intrinsic DROP/CREATE scripts as an upgrade strategy.
2. Add a canonical store lookup and authenticated platform authorizer, wired
   into createAuthorizer like the existing Domain/Hub authorizers. Decide the
   canonical scope spelling/legacy alias explicitly; preserve fail-closed behavior
   when the provider/migration is missing, a session is unsigned/OTP-pending,
   the principal is reserved or the grant is absent/revoked.
3. Specify the exact PLATFORM_ADMINISTRATOR remit/allowed-operation policy
   using canonical root/permission semantics, distinct from domain and Hub
   privileges. A human remains active/personal drumate. Platform authority must
   not imply bypassing Hub/MFS resource authorization.
4. Validate with real SQL/session/dispatch positives and negatives: platform
   administrator succeeds, domain owner alone fails, reserved/unauthenticated
   sessions fail, revoked grants fail, cross-Hub MFS denial remains enforced.
5. Supply an immutable runtime artifact/source revision containing that contract
   to the composition. Do not silently consume unchanged alpha.3 and claim support.

No generic role framework, public registration endpoint, new authentication
system or full Team administrative payload is needed. Implementing the missing
checks inside Infra Layer, Debian or an operator-owned shadow ACL table would
violate KB-01's explicit ownership and no-workaround requirements.

## Deferred KB-01 work and distribution handoff

After the canonical authority is available, KB-01 still must implement the same
authorized enrollment transaction for test/interactive/automatic acquisition;
secure non-echo/FD input; durable private automatic credential delivery;
versioned additive enrollment metadata; connection-affine transactions;
unique first-admin locking/exclusivity; conflicts; read-only validation and
all specified crash/retry boundaries. No enrollment modes or recovery behavior
are claimed implemented or tested by this contract probe.

Do not prepare or expose credentials before authority prerequisites validate.
Do not silently fall back to a domain administrator or auto-generate a password
for a non-TTY interactive request. Do not use Unix identity as Drumee identity.
Automatic credentials must eventually persist privately across interruption,
with explicit retrieval; account recovery remains outside KB-01.

Future SQL roles must remain separate: an explicit migration job owns additive
DDL/routine installation; the authorized enrollment job needs parameterized
identity/grant/enrollment-metadata DML and canonical validation reads; ordinary
runtime needs only its existing access plus the canonical platform grant lookup.
The enrollment job must not receive unrelated database/user administration or
Hub/shard creation privileges. Exact grants cannot be qualified until the
canonical migration and enrollment statements exist. No broad default grants
are introduced by this checkpoint.

The IL-3 fixture remains unchanged. It cannot truthfully replace its first
test owner with a canonical platform administrator until this contract exists.
Its reader/outsider preparation remains test-only and outside general enrollment.
Debian must later invoke the canonical job, never reproduce its SQL. Infra Layer
continues to handle protected infrastructure resources, not identity policy.

## Validation commands and counts

```sh
# target/control-plane/operator-bootstrap
npm ci --ignore-scripts --no-audit --no-fund
npm test
npm run test:integration

# transient root
node --test target/control-plane/bootstrap/test/*.test.js target/control-plane/hub-lifecycle/test/*.test.js
node --test target/foundation/server-runtime/test/*.test.js target/modules/host-filesystem/test/*.test.js target/modules/mfs-service/test/*.test.js target/modules/mfs-transfer/test/*.test.js target/modules/media-service/test/*.test.js
# unchanged fixture directory
npm test
# unchanged canonical system-mfs checkout, selected non-engine unit regressions
node --test test/filesystem.test.js test/sql-granularity.test.js test/system-mfs.test.js
```

| Executed suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| New KB-01 unit contract probes | 4 | 0 | 0 |
| New real MariaDB/runtime probes | 7 including parent | 0 | 0 |
| Existing platform bootstrap/Hub lifecycle | 17 | 0 | 0 |
| Existing runtime/FileIo/MFS/transfer/media | 68 | 0 | 0 |
| Selected system-mfs unit regressions | 7 | 0 | 0 |
| Existing IL-3 fixture units | 4 | 0 | 0 |

No passing enrollment, concurrent enrollment or enrollment-crash suite is
claimed. Those tests and a migrated full Docker/browser/recovery fixture were
not executed because implementation stops at the required privilege gate.
Prior IL-3/IL-4 fixture evidence remains prior evidence, not fresh KB-01 acceptance.

Only the new probe and documentation were added. `git diff -- sources/` and
diffs for intrinsic runtime, existing control plane, MFS and IL-3 fixture are
empty. No Infra Layer/Debian/runtime repository changes, package/image
publication, testbox access, permanent deployment or IL-4 resumption occurred.
