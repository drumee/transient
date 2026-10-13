# Infra Layer — IL-1 foundation and Nginx implementation report

Status: **IL-1 — READY_FOR_TECHNICAL_REVIEW**. 2026-10-13.

IL-1.1 corrective follow-up: the Docker observer now binds probes to the exact
validated plan and local Docker ownership/port identity. Matching labels no
longer imply loaded Nginx configuration; functional HTTP does not imply protected
delivery. Rendering rejects concurrent/stale locks and rechecks destinations
before replacement. The release/extraction record will be maintained in
[36-infra-layer-il1.1-release.md](36-infra-layer-il1.1-release.md). The original
IL-1 evidence below remains historical; its observation/multi-writer limitations
are superseded by that corrective record.

Repository `drumee/transient`, branch `refactor/mapping`. Approved architecture:
`a31b544f565ca4438f1ed8df5eccb21bf0486104`, dossier
[34-infra-layer-foundation.md](34-infra-layer-foundation.md). Implementation
started at `9680a8cb09adfea5b40122a2df72cfdaa49fd8dd`. The final documentation/code
commit SHA is supplied in the completion report; no self-referential commit SHA
is embedded in this file. No push, publication or later phase is implied.

## Implemented boundary

New private CommonJS package under `target/modules/infra-layer/`. Exactly five
public functions: validateSpec, planInfrastructure, renderPlan,
inspectInfrastructure and diagnoseInfrastructure. Declaration-only index.d.ts
describes the implemented InfrastructureSpec, KernelInfrastructureRequirements,
Docker adapter input, Plan and State. No TypeScript runtime compiler or framework.
No production dependencies; only test devDependency `websocket@1.0.35` and its
package-lock were added. AGPL license/provenance retained.

| Added paths | Responsibility |
|---|---|
| `lib/{index,spec,validation,plan}.js` | Strict input contracts, DNS resolution, normalized pure planning, digests, port observations/conflicts and prerequisites. |
| `lib/rendering.js` | Content revalidation, owned output, no-follow/path checks, staging/fsync/rename, ordinary-error rollback; no activation. |
| `lib/state.js` | Redacted observed readiness/dependency/revision records and stable diagnostics. |
| `capabilities/http/nginx/{index,routes}.js` | Complete finite Nginx config with explicit upstreams, protected delegation and safe headers/logs. No copied legacy template tree. |
| `adapters/docker/nginx.js` | One reusable gateway descriptor and explicit read-only Docker observer. No complete distribution or applyPlan. |
| `test/unit/foundation.test.js`, `test/support/inputs.js` | Contract, safety, normalization, mutation-negative and state tests. |
| `test/integration/{run,kernel-fixture,gateway.test,build-browser,browser-entry}.js`, `Dockerfile.kernel` | Isolated two-container validation harness and actual browser smoke. |
| `README.md`, `index.d.ts`, `PROVENANCE.md`, `LICENSE`, package/lock | Public schema/API, operational limits, exact source evidence and packaging boundary. |

Only this module and dossiers 34/35 are modified. `sources/**`, all runtime/kernel
and existing capability implementations, original repositories, testbox and
Oxymotion remain unchanged. Existing hello is reused; the probe Worker and
in-memory stores are test instrumentation, not another synthetic application.

## Contracts and deliberate IL-0 refinements

The proposal is narrowed to IL-1 HTTP requirements. Version field is
`contract_version: "1"` consistently. Public asset roots are finite declarations
`{id,url_prefix,root}` with matching adapter views; protected view maps
`kernel_target` to gateway `target` over one host source. No DB/Redis/mail/DNS
service implementation fields are accepted yet; unknown requirements fail
explicitly instead of being silently discarded.

DNS matrix is exact: none preserves supplied name or undefined; local defaults
to **drumee.lan** or preserves supplied domain; localhost forces localhost and
loopback publication. Supplied localhost-mode domain does not alter normalized
revision. Local DNS is recorded as an IL-2 prerequisite; no service/key/zone is
generated. No TLS-to-DNS inference. HTTPS rendering accepts existing certificate
and key references only; local/ACME issuance/renewal is not implemented.

Planning consumes explicit observations only, never reads mutable host/global
configuration or executes commands. Lexical ordering does not depend on locale.
Revision hashes normalized inputs plus generated Nginx and Docker configuration;
individual artifact hashes bind exact bytes. Port occupancy affects applicability,
not the configuration revision. A plan describes configuration applicability,
not observed running infrastructure or fulfillment of deferred prerequisites.

Rendering accepts caller-owned isolated output, refuses symlinks/hardlinks,
untrusted writable parents, path escape, unrelated files, edited artifacts,
forged config and another instance/project's manifest. It stages all content
before atomic per-file renames, rolls back ordinary rename failure, preserves
unrelated files and writes an ownership manifest last. It is not a crash-atomic
deployment transaction or multi-writer directory. Actual Nginx/Compose validation
is explicit; rendering itself starts no process and performs no activation.

Stable diagnostics include INVALID_CONTRACT_VERSION, INVALID_DNS_MODE,
INVALID_HOSTNAME, MISSING_REQUIRED_HOSTNAME, INVALID_ENDPOINT,
CONFLICTING_PORT_BINDING, MISSING_ARTIFACT_ROOT,
INVALID_INTERNAL_ARTIFACT_PREFIX, UNSUPPORTED_GATEWAY_REQUIREMENT,
UNSAFE_RESOURCE_PATH and INCOMPATIBLE_ADAPTER_CONFIGURATION. Unknown secret
fields and observer exceptions never echo their values/messages.

## Nginx and Docker implementation

Service calls use explicit service upstream; page/bootstrap exact paths use page
upstream; WebSocket uses separately declared endpoint. All original session,
cookie, Origin/subprotocol, query and method semantics remain in the runtime.
The native `/-/service/` alias and actual HLS forms are supported; both service
prefixes enforce the same binary chunk ceiling in actual upload tests. Team
file/doc/avatar/letc/raw rewrites are absent. Public aliases contain only approved
frontend views, never a broad server-code or customer-storage root.

Direct-edge trust only. Nginx overwrites forwarding identity/scheme/port, strips
Forwarded/X-Forwarded-Host/routing overrides and client X-Accel-Redirect. Accepted
Host authority is validated against configured names and one declared external
port. Multiple bind addresses may share that port; independent external port
authorities/proxy chains are deliberately unsupported. Original allowlisted
cross-origin session/CORS and WebSocket behavior is transported unchanged;
Nginx does not choose who is allowed.

Protected delivery is actual runtime ACL → media/transfer Worker → **real FileIo**
→ X-Accel-Redirect → Nginx `internal` alias on a scoped read-only mount.
Negative decisions never invoke FileIo. Direct internal URLs, traversal,
double encoding and symlinks fail. The symlink test targets `/etc/passwd`, which
exists in both containers, proving actual Nginx denial rather than an absent
mount. Missing files and deletion after authorization return 404. No protected
path, session/OTAK query or password is returned/logged by the tested gateway.

Actual bytes validate original/representation/HLS segment and offline ZIP
delivery, MIME/disposition/length, HEAD, single/suffix ranges, 206/416 and stale
If-Range fallback. Multiple ranges are bounded to one. Binary reception uses the
existing kernel octet-stream service, declared maximum and request buffering
off. The slow chunked test observes the backend tempfile **before client end**,
waits for write/drain backpressure, and proves streaming is not merely a config
claim. A 16 MiB + 17 byte object crosses the 1 MiB request ceiling via bounded
256 KiB chunks and returns the same checksum.

Gateway process is uid/gid 101 with read-only root/mounts, all capabilities
dropped, no-new-privileges and bounded tmpfs/memory/pids. Scratch paths cover all
Nginx temp subsystems. Healthcheck contacts a separate container-loopback
readiness listener proxied to composition readiness; it does not certify TLS.
The external readiness observer additionally requires a successful gateway probe,
running/healthy container and matching recorded revision. Label observation is
not a full configuration-drift audit or complete application acceptance.

The generated `gateway.compose.json` contains only gateway and an externally
supplied network. The distribution owns image composition, kernel execution,
schema/bootstrap jobs and complete deployment. Test runner supplies its own
fixture/network, not a competing Docker distribution. Docker 29 suppressed
published-port ingress on the initially tested `internal:true` bridge; the final
dedicated bridge permits loopback gateway ingress while keeping both kernel
listeners unpublished. No host network or privileged container.

## Test architecture and evidence limits

| Level | Executed implementation | Persistence/deployment boundary |
|---|---|---|
| 1 | Strict spec/DNS/plan/render/state unit tests | No external services or implicit host inspection. |
| 2 | Digest-pinned official Nginx, actual nginx -t, routes/headers/internal alias and Compose validation | Rootless isolated gateway on a unique loopback high port. |
| 3 | Existing runtime KernelSession/SessionManager, registry/dispatcher/Domain/Hub/MFS authorization, PushBus/WebSocket router, actual FileIo/HostFilesystem, media/MFS service and transfer/archive process | Memory identity/Hub/node metadata and Redis-compatible pub/sub stores; fixture filesystem metadata adapter. No historical SQL/bootstrap or real DB/Redis lifecycle. |
| 4 | Chromium → real LETC READY → backend plugin resolution → existing hello Widget/skin → native service → WebSocket push and reconnect | Browser smoke only; not Finder/Oxymotion product acceptance, TLS trust or a provisioned acceptance instance. |

The authorization functions are not replaced by a grant-all handler. Fixtures
provide persisted-row equivalents and effective permission values, then real
kernel code checks signed-in identity, Hub/node bits and transfer ownership.
Both user and cross-Hub negatives exercise those same paths. FileIo and internal
redirect delivery are not mocked. SQL provisioning/persistence acceptance remains
with its owner and future distribution validation.

## Validation commands and results

Commands run in `target/modules/infra-layer` unless otherwise stated:

```sh
npm install --ignore-scripts
npm install --package-lock-only --ignore-scripts
npm test
npm run test:integration
```

From transient root, existing regression:

```sh
node --test target/foundation/server-runtime/test/*.test.js \
  target/modules/host-filesystem/test/*.test.js \
  target/modules/mfs-transfer/test/*.test.js \
  target/modules/mfs-service/test/*.test.js \
  target/modules/media-service/test/*.test.js
node --test /home/somanos/github/finder/test/finder-core.test.js
```

| Final suite | Passed | Failed | Skipped |
|---|---:|---:|---:|
| Foundation units | 27 | 0 | 0 |
| Actual gateway/kernel/browser integration | 17 | 0 | 0 |
| Existing runtime/capability regression (48 runtime + 20 capability tests) | 68 | 0 | 0 |
| Existing standalone Finder core/transfer-client regression | 27 | 0 | 0 |
| **Total** | **139** | **0** | **0** |

The integration command executes `docker compose ... config -q`, builds the
test-only image, starts the isolated kernel fixture, runs
`docker compose ... run --rm --no-deps gateway -t`, starts/waits for gateway health,
and repeats `docker compose ... exec -T gateway nginx -t` before HTTP tests.
Tests verify actual readiness, loopback-only publication, no kernel host ports,
functional routing, credentials/bridge conflicts, allowed/rejected Origin and
OTAK/subprotocol/reuse, original/ZIP/ranges, chunk geometry/retries/limits,
streaming/abort/timeouts, canceled downloads, restart and Chromium. Safe logs are
checked for token/password/internal-path disclosure.

Development failures were resolved within this module/harness: a fixture syntax
error; PCRE backslash escaping; default Nginx fastcgi/uwsgi/scgi temp directories
on a read-only root; published ingress on Docker's internal network; and the
test's assumption that an idle-body timeout always delivers a complete 408.
No kernel bug was patched. An initial existing binary-test invocation was blocked
by sandbox socket restrictions; the explicitly authorized retry passed all 68.
The completed suite does not silently skip any mandatory level.

Images: Nginx digest
`sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752`;
Node digest `sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`;
test-only zip `3.0-13+deb12u1`. Local toolchain: Node `22.22.0`, Docker `29.2.0`,
Compose `v5.0.2`. Initial package/image preparation used registry/APT access;
runtime validation has no external service dependency. No publication occurred.

Source attribution/exact revisions: [module PROVENANCE](../../target/modules/infra-layer/PROVENANCE.md)
and IL-0 inventory. Existing Finder regression inspected main at
`b46e2c94b615a1993b6162716d9e8965d0029564`; that checkout was not modified.

## Resource ownership and testbox

All tests were local. No IL-1 SSH connection, remote test project or persistent
testbox write was made. No claim is made about its current ports/services after
the owner's cleanup. Permanent D0 remains separate.

Final recorded successful integration project: `drumee-il1-test-a2a39796`,
network `drumee-il1-test-a2a39796-kernel`, gateway binding
`127.0.0.1:42283 → 8080`, container-only readiness port 9180. The runner uses a
fresh suffix/free high port each run; these are observed values, not API defaults.
Its recorded plan revision was
`7c11bf203b62e948e6dc4028b9448dd758bb56da6cd5ae131bcd365b8c2b0230`.

The runner refuses collisions with an existing project/network/image, removes
only its Compose resources and uniquely tagged test image, verifies no remaining
project containers or network, and deletes its temporary fixtures/build/output.
No named volumes were created. Existing local DB/tuning/application containers
were inspected but never stopped, restarted, removed or used by the harness.
No ports 53/80/443, host DNS, firewall, certificates or production storage changed.

## Limitations and IL-2/IL-3 prerequisites

- TLS references are rendered, but public/local issuance, renewal, trust and LAN
  HTTPS acceptance are untested/unimplemented. HTTP pass is not TLS acceptance.
- Local mode records BIND requirement; no BIND/key/zone implementation or LAN
  client resolution has occurred. `drumee.lan` acceptance needs approved IL-2/3.
- One service upstream/one transfer backend; independent worker balancing and
  restart-resumable jobs remain separate kernel work. Kernel restart loses leases;
  graceful restart cleanup and unchanged original fixtures were verified.
- Unbuffered idle-body timeout logs 408 but may reset/close the client transport;
  backend partial tempfile cleanup is tested. Clients must treat this as an
  interrupted transfer, not assume a JSON or complete 408 response.
- All filesystem symlinks are denied by gateway; legitimate symlink-based content
  would need a separately reviewed contract. FileIo's existing lexical path
  checks are unchanged, with actual Nginx enforcing the additional view boundary.
- Real SQL identity/Hub schemas, persistent Redis behavior, storage-engine
  consistency, certificate/service lifecycle, crash orphan sweeping, coordinated
  backup/restore and upgrade/deployment orchestration remain with later owners.
- No dynamic discovery of routes, arbitrary runtime page fallback, trusted outer
  proxy chain or multiple independent external ports. Unsupported declarations
  fail explicitly; add only demonstrated consumer requirements after review.

No new kernel correction requires approval to finish IL-1. Before IL-2, review
the narrow public schema, direct-edge/port model and rendering/observer limits;
then authorize service/certificate/secret lifecycle work separately. No IL-2,
IL-3, IL-4, Oxymotion Phase 3 or acceptance deployment was started.
