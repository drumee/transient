# IL-3 — approved distribution fixture and real-kernel acceptance

IL-4 follow-up: [distribution qualification checkpoint](38-infra-layer-il4-qualification.md).
The IL-3 fixture remains preserved; its disposable identities are not production
initialization defaults.

Status: **IL-3 — READY_FOR_TECHNICAL_REVIEW** for the documented minimal
Docker profile and supported compatibility boundaries. This is not release
approval, unrestricted provider support, or production/Oxymotion acceptance.

The owner approved this distribution fixture under IL-3 section 10 on
2026-10-15. Implementation lives in
`target/distributions/minimal-kernel-il3/`; acceptance lives in
`tests/integration/infra-il3/`. Infra Layer remains canonical in its standalone
repository. The historical transitional Infra Layer snapshot is unchanged.
No kernel/runtime/module source or immutable `sources/**` was modified.

## Ownership and executable composition

The fixture supplies the missing distribution-owned executable host, immutable
image identity, initialization job, frontend artifacts and recovery checks. It
consumes the existing version-2 infrastructure plan and the version-1 Distribution
contract through `@drumee/infra-layer/lifecycle`. It implements no competing
Compose installer, provisioning engine, file-transfer protocol or ACL policy.

`lib/host.js` composes actual server-runtime HTTP/session/Domain/Hub/MFS
authorization, descriptor discovery/dispatch, WebSocket/OTAK, actual Essentials
RedisStore, system-mfs, MfsService, MfsTransferService, MediaService and FileIo.
All kernel-facing listeners remain private: service/WebSocket 3101 and page 3102.
The fixture context service lists the authenticated creator's provisioned Hubs;
authorization and transfer decisions still run through the real kernel.

`lib/initialize.js` runs only as an explicit distribution initialization job:

1. Execute the intrinsic runtime manifest in order on a new owned Yellow Page
   database; do not replay routine replacement scripts during ordinary startup.
2. Invoke existing platform bootstrap and independent validation for organisation
   1, canonical nobody, and generated distinct guest/system identities.
3. Install the existing Hub lifecycle and system-mfs module lifecycle state.
4. Create generated disposable owner/reader/outsider principals with private
   persistent passwords; their SQL encoding matches unchanged `session_signin`.
   Existing identities with conflicting state fail closed.
5. Sign in through the real SQL session mechanism and call the existing
   `HubLifecycle.createPrivateHub()` and module-owned provisioning handler for
   two private Hubs. The reader is granted only the first Hub, with real Hub
   and MFS permission records. The outsider receives neither Hub.

The host validates provisioned state instead of creating it at startup. The
separate initialization validator does not create sessions, reset passwords,
repair conflicting identities or invent schemas. SQL queries are parameterized;
platform transactions use a single actual MariaDB connection. Shard queries use
separate connections, avoiding concurrent `USE` changes on the shared connection.
Only confirmed Hub-ID MFS resolution is used; no legacy vhost schema is imported.

The explicit fixture driver grants `infra_client` access to the owned `yp` and
`hub_` databases via the owned MariaDB container's local root socket. Root remains
localhost-only. This deliberately broad **test** grant policy is not a proposed
production privilege design. It is distribution-owned, not SQL inside Infra Layer.

## Revisions, artifacts and provenance

Starting transient branch/HEAD: `refactor/mapping`,
`5469b48109dbb20eacbbc9314a6772264b388843`.

| Change | Commit |
|---|---|
| Approved private host, jobs, Docker image and acceptance harness | 49d9d5985f1218be61704672a6f15f86719c2405 |
| Actual transfer/recovery validation and LAN browser coordinator | 7c4cc916a2c6b8dd2deffc9a6f01dbd701cfce28 |
| Allowlisted Git-object acquisition and retained Essentials license | c1f121e4c4024a257186af0548fefa4618a34cc3 |
| Browser observation before navigation | 96d8e46e98e0963321c84ca408b67cfe120de679 |
| Qualified native Redis check dependency | ae200e6ec502f4c62df9926d82d201564f665d62 |
| Real process interruption and Redis/kernel consumer recovery test | 259189eb1d1452fae92e7a8c255a71d4fe29bc09 |

The enclosing final documentation commit records closure only. Exact module
revisions, source paths, licensing and intentional wiring differences are in
the fixture's `PROVENANCE.md`, `sources.lock.json` and npm lockfile. Acquisition
verifies 71 explicit files and SHA-256 inventory entries. It fetches the pinned
commit and only the required blobs; it does not import historical source trees
into this fixture, copy kernel implementations into Git, or use sibling paths.

Infra Layer dependency:
`95db6c7aed097b62aa8081df17b3467d850e779c`, unpublished main source archive.
Its focused correction waits for authenticated Redis native-check readiness
before shutdown, bounded to five seconds; invalid configuration still fails.
The 16 native lifecycle regressions pass after this change. No kernel package
was changed. Published `@drumee/infra-layer@0.1.0-alpha.1` and its tag are untouched.

The standalone runtime/UI/Finder/Window Manager use exact npm prereleases.
system-mfs uses the explicit `53101c4a995ffca9118f795ab5d4c7c731200a2f`
archive, preserving its validated alpha.2 semantics instead of substituting its
older published alpha.1. All runtime imports are declared or revision-pinned
private transitional modules. The fixture is private and is never published.

## Security and durable state

Nginx is rootless/read-only, sees only dedicated public artifacts and the
read-only internal protected artifact view, and delegates after real kernel
authorization. Direct internal URLs, traversal encodings and a symlink to a
kernel-readable secret are rejected by actual Nginx. No broad `/data` mount is
used. CA signing keys, acceptance passwords, SQL data and infrastructure secrets
are separate resources and never appear in public plan/state or frontend code.

TLS uses the persistent local CA and separate SAN-valid `drumee.lan` leaf.
HTTPS probes validate the CA, SAN and actual served certificate. Isolated Chrome
profiles explicitly pin the prepared leaf SPKI; no CA is installed in system
trust. DNS is authoritative-only for `drumee.lan`, with declared LAN address,
TCP/UDP bindings and explicit client allowlists. No recursive service, public
delegation, resolver/DHCP alteration or container-IP inference is introduced.

MariaDB state, content, infrastructure secrets, issuer state, DNS state, public
artifacts and private acceptance intent are included in the owned backup.
Redis is explicitly ephemeral for pub/sub; reconstructed state is not falsely
declared durable. Backup quiesces all owned writers, takes the locked logical
database dump and stops engines before copying protected state. Restoration is
into another owned project/root with loopback high ports.

Recovery checks compare canonical principal/privilege/Hub/ACL/MFS inventory
digests and actual original file bytes, then reauthenticate and repeat positive
and negative access through the real kernel. CA identity and DNS state persist.
Infrastructure's restore response honestly retains `kernel_recovery_verified:false`;
the separate distribution acceptance establishes application recovery evidence.

The process-interruption test kills only its own rotation child after the new
Redis generation is deployed and before kernel transition. Pending observations
must be unready. After reaping that exact child, the test explicitly inspects
and removes its empty owned stale lock, then calls `resumeSecretRotation()`.
Redis and kernel consumers must agree, previous secret generations remain, and
subsequent full acceptance/recovery exercises the rotated credential. Product
code never silently steals a lock by PID or elapsed time.

## Validation commands and scope

From `target/distributions/minimal-kernel-il3`:

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run sources
npm test
npm run test:integration
```

The clean-room checkout was independently cloned, installed and tested. Its
normal acquisition uses pinned GitHub/npm inputs. Two early Git HTTP/2 transfers
failed with CANCEL/early EOF before Docker started. Filtered, revision-pinned
acquisition and process-scoped HTTP/1.1 resolved the fixture's clean acquisition.

The original standalone Infra Layer integration regression acquisition also
encountered the GitHub transport error. It was rerun using this explicit
process-only transport mapping to the identical read-only pinned Git objects:

```sh
GIT_CONFIG_COUNT=1 \
GIT_CONFIG_KEY_0=url.file:///home/somanos/github/transient.insteadOf \
GIT_CONFIG_VALUE_0=https://github.com/drumee/transient.git \
npm run test:integration
```

This is a disclosed regression-test transport fallback, not a shipped dependency
or a substitute for the fixture's independently acquired clean checkout.
Standalone `npm test`, `npm run test:package`, `npm run test:lifecycle` and
`npm run test:lifecycle:gateway` were additionally run after the native check fix.

| Validation | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Standalone infrastructure unit contracts | 123 | 0 | 0 |
| Original Nginx/kernel/Chromium contracts | 17 | 0 | 0 |
| Native BIND9/MariaDB/Redis/SMTP/DKIM services | 17 | 0 | 0 |
| Native lifecycle after Redis check correction | 16 | 0 | 0 |
| Existing transient runtime/FileIo/MFS/transfer/media regressions | 68 | 0 | 0 |
| Existing Finder core regressions | 27 | 0 | 0 |
| New distribution unit tests | 4 | 0 | 0 |

Baseline: 268 TAP tests; new fixture: four TAP tests. Separately, the existing
HTTPS/job harness passes four scenarios, and the distribution runs 25 grouped
contract checks per complete profile (9 fresh, 8 after restart, 8 after restore).
These are assertion groups, not invented TAP counts. The standalone runtime's
own 48 tests also pass; they overlap the supplemental runtime coverage and are
not added to the baseline total. Packaging audits 38 allowlisted files, no
production dependencies, and passes the offline packed-consumer check.

Final local clean-checkout qualification includes the real interrupted rotation
and subsequent restart/restoration at
`259189eb1d1452fae92e7a8c255a71d4fe29bc09`, project
`drumee-il3-kernel-6c2065fe`, loopback HTTPS 35953 and DNS 46831. Kernel image:
`sha256:3492465b930eb32a88633953296c1f5016cbb493cc37bce3b579fca98fde35d4`;
capability image:
`sha256:978d20ce7249dfe4d760d3b6813e0382c61c5fe9761a791f00aab755152cae35`.
All 25 contract groups and the additional actual-process recovery case pass.
The remote source below predates only this added test; its host/runtime code and
pinned dependency content are identical. Interrupted rotation was executed
locally, not relabelled as remote execution.

The earlier combined standalone attempt passed gateway/services but failed one
of 16 lifecycle cases during cold restoration. That attempt is not counted as
successful. After the bounded native Redis readiness change, the complete
16-case lifecycle command, 123 units, package check and four HTTPS/job scenarios
passed. Gateway/service source was unchanged by that correction.

The 25 checks cover real credentials/sessions, Hub and node authorization,
cross-Hub/outsider/anonymous denial, read-only reader enforcement, duplicate and
out-of-order binary chunks, chunked and Content-Length bodies, 413, protected
FileIo originals, exact bytes, 206/416/HEAD, direct/traversal/symlink denial, ZIP,
OTAK/Origin/subprotocol, actual Redis pub/sub, socket reconnect, DNS authority,
refused recursion, private backend ports, real LETC/Finder and browser load.
The browser's unused favicon returns 404; there are no JavaScript exceptions or
network loading failures on the tested bootstrap/Finder/WebSocket path.

## testbox and LAN acceptance

Read-only preflight found Debian testbox `minis`, Docker 29.7.2/Compose 5.4.0,
UID/GID 1000, LAN `192.168.5.202/24`; no Chromium binary. Existing three stopped
initialization containers, five `drumee_*` volumes and `drumee_drumee` network
were inspected and preserved. Ports 53/80/443 were rechecked before publication.

Qualified remote source: `ae200e6ec502f4c62df9926d82d201564f665d62`.
Project: `drumee-il3-kernel-5e42e59f`. Domain `drumee.lan`, DNS local, BIND9
on `192.168.5.202:53` TCP/UDP and Nginx HTTPS on `192.168.5.202:443`.
No MariaDB, Redis or kernel listener is published. Kernel image ID:
`sha256:0595b23a7464eaef7f62650155643a7f69e9e933a954733601e58651c73bcdd0`;
capability image:
`sha256:6da35bb1dbc7851a177312a8de096b2923ef867b1458b7c6342fdd3716c153d4`.
Composition revision:
`69c013bd4b56579c48a0f9069e4c1543ec4bc85718626a76d3274397a93a7fb9`.
Public CA fingerprint:
`7B:AE:C1:8D:92:5F:1D:F4:21:C7:85:CD:1A:3C:A0:EE:29:CE:B9:02:3C:D9:E0:8F:C5:D4:1F:06:8B:72:56:27`.

The LAN client directly queried BIND9 and validated CA/SAN HTTPS plus Chromium
Finder/WebSocket twice: fresh and after restart. The isolated restored project's
loopback-only HTTPS was reached through an owned SSH tunnel for the third browser
check. This third path is explicitly isolated restoration, not another LAN DNS
publication. No CA/resolver configuration was installed on any host.

One overlapping task-owned retry correctly failed port allocation; only its
owned resources were cleaned. Browser instrumentation was moved before
navigation to capture startup failures. The final qualification ran a single
remote project and all three browser stages passed. No unrelated service was
replaced to clear a port.

Final inspection confirmed exactly the three pre-existing stopped container IDs
`c514f6c155f5`, `86e518b5a6ec`, `e29b72ba5093`, the original five volumes and
network. No listener remained on host ports 53/80/443. All owned profile and
restoration containers/networks, bind data, protected backups and image tags
were removed. The owned testbox checkout/browser coordination directory was
deleted. No host service, DNS, firewall, SSH, DHCP or system trust configuration
was changed. Ordinary npm/Docker build/download caches and harmless diagnostic
reports may remain; no global cache pruning or uncertain-image deletion occurred.

## Supported limits and next review

This closes the missing distribution-host and canonical SQL/MFS recovery
contract for the approved minimal profile. It does not deploy Oxymotion, publish
a package, establish a permanent installation or start IL-4. Production account
grant policy, distribution release artifact selection and operator UX still
belong to the distribution owner.

Coordinated rotation is Redis-only; other providers fail explicitly. Automatic
renewal scheduling is not installed: the durable trigger and activation APIs
require an operator/distribution scheduler. ACME activation is outside this
local-CA profile. Optional SMTP is absent from the profile; SMTP/DKIM/queue
restart tests pass independently, while full SMTP spool IPC backup remains
unqualified. Engine-version-changing upgrades, image/schema downgrade and
cross-UID restore remain refused. Transfer jobs remain process-local and are
not restart-resumable. IPv6 LAN/browser acceptance is not claimed.

These limits must remain explicit in technical review and subsequent release
qualification. Nothing here authorizes IL-4, a new npm release, production
privilege broadening or Oxymotion deployment.
