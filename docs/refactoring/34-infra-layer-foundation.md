# Infra Layer — IL-0 architecture audit and extraction specification

Status: **IL-0 — APPROVED FOR IL-1**. Audit date: 2026-10-13. The specification-only baseline was committed as `a31b544f565ca4438f1ed8df5eccb21bf0486104` and subsequently approved by the owner with the IL-1 implementation requirements. Workstream: Infra Layer, independently reusable by the minimal Drumee kernel and its distributions. Number 30 is occupied by the Hub lifecycle dossier; 34 follows the existing series.

IL-1 follow-up: the private CommonJS foundation and gateway-only Nginx/Docker projection are implemented under `target/modules/infra-layer/`. The implemented subset, provenance, real gateway/kernel/browser evidence and remaining TLS/DNS/persistence limits are recorded in [35-infra-layer-il1.md](35-infra-layer-il1.md). Sections below retain the IL-0 audit/proposals; they do not imply implementation of every proposed provider or IL-2/IL-3 feature. **IL-1 — READY_FOR_TECHNICAL_REVIEW**; later phases still require separate authorization.

IL-1.1 closure: observation/rendering corrections are validated and extracted to
canonical `https://github.com/drumee/infra-layer`, main/tag `v0.1.0-alpha.1`,
commit `b1b8e8666e92ec604d933b9c99145c90b966362b`. Transient retains an exact pinned
integration snapshot. npm publication is **blocked by EOTP** and is not claimed;
the prepared alpha, tests and blocker are recorded in
[36-infra-layer-il1.1-release.md](36-infra-layer-il1.1-release.md).
IL-2 development belongs in the standalone repository after explicit approval.

## 1. Executive summary

The smallest useful Infra Layer is a validated infrastructure plan, a Docker Compose adapter, an Nginx gateway, persistent infrastructure secrets, and observable database/cache availability. The first LAN acceptance also requires containerized BIND9 and local HTTPS for `drumee.lan`. SMTP is a required supported capability but is optional for kernel startup. Oxymotion consumes this foundation; it does not define its public API.

Reuse the existing Debian Docker channel's resource topology, configuration ownership lessons, readiness patterns and version controls. Do not reuse its Team images, historical schema initializer, factory pool, identity provisioning, or complete host installer. The newer package-role channel already contains Nginx, DNS and mail roles; there is no justification for an unrelated second installer. Adapt those infrastructure components through one Infra Layer plan. Distribution packaging and operator orchestration remain outside the portable kernel.

The critical HTTP contract is **kernel authorization → FileIo headers → Nginx internal file delivery**. The current `X-Accel-Redirect` target is `/__drumee_artifacts/`, not the historical `/mfs/` alias. Both original files and generated ZIPs require a shared filesystem view. The audited Caddy source-channel gateway has no equivalent delegation and lacks several confirmed routes. Serving the homepage is insufficient evidence of compatibility. Use one Nginx gateway initially, with separate certificate issuance; no Caddy/Nginx proxy chain.

Confirmed blockers include secret regeneration on ordinary config rendering with null passwords, key replacement on historical reconfiguration paths, a template `readonly` operation that truncates files, incomplete Docker backup/restore, and missing protected-artifact mounts in the newer role topology. Some gaps are runtime limitations rather than infrastructure defects: transfer jobs are process-local, no direct multipart upload is implemented by the minimal runtime, and current Range support is asserted in headers but not exercised by the inspected gateway regression.

Read-only `testbox` inspection found a running historical role stack and listeners on **53, 80 and 443**. It is not an empty acceptance machine. The future plan must report those conflicts and require a separately authorized transition; IL-0 made no changes there.

## 2. Evidence conventions and repository revisions

**Confirmed** means executable source was inspected, with a named test or isolated probe where available. **Intent** means documentation or historical commit narrative, without independent operational proof. **Proposed** means the IL-0 target contract. **Unknown** means evidence does not establish the behavior. Source and test inspection do not imply that every live integration suite passed in this audit.

The transient audit baseline is `5e3964d832951a55d92ed6a9c88c25a742ebc457`, branch `refactor/mapping`. Existing uncommitted edits to dossiers 23, 32 and 33 were excluded from the audit commit and left untouched. The Debian checkout also has local changelog edits and an untracked AGENTS file; only its committed tree was inspected. Committed snapshots were exported with `git archive HEAD` into `/tmp/drumee-il0-audit/`, without changing those repositories or importing new code into `sources/**`.

### 2.1 Exact revision inventory

All repositories are `https://github.com/drumee/<name>`. “Pinned” below means the declared imported revision in `SOURCE_MANIFEST.md`; the transient commit above identifies the actual inspected imported tree. Supplemental local revisions are not substituted into that manifest.

| Repository | Branch / exact inspected SHA | Evidence location and remote observation |
|---|---|---|
| transient | `refactor/mapping` — `5e3964d832951a55d92ed6a9c88c25a742ebc457` | `target/**`, kernel harness and tests; remote branch matched. Remote default HEAD was `2dd08c1a6f78d5ad22ad880df800300f47785ee5`, not audited as an alternative branch. |
| setup-infra | pinned `main` — `643d74fa8bc89d418ff1169daa09554ae84e48ef`; supplemental local `main` — `f93dad561d46fc1922234cb18bdbc5828015a2c5` | `sources/setup-infra/**` plus committed local snapshot. Remote `main` matched the pinned SHA. Supplemental SHA is local evidence, not verified as remotely available. Comparing snapshots found differences only in README, DOCUMENTATION and `templates/etc/drumee/conf.d/drumee.json.tpl`; executable files cited here matched. |
| setup-schemas | pinned `main` — `1582eb557ce092dd2cc5fa6f9d533d64911f4dce`; supplemental local `main` — `a110a85ff716005a20e54addbf16c465105a49c8` | `sources/setup-schemas/**` and local snapshot. Remote `main` matched pinned SHA. Only README differed in the compared snapshots. |
| debian | pinned `main` — `b8b0ebe7082e1ad2366f3a7997712f5da5bba127`; current container branch `feat/container-distribution` — `8a236e5d147a55cfd5580dcda0712cd6436ca93c` | Both `sources/debian/**` and committed container-branch snapshot inspected. Remote `main` and feature branch matched those SHAs. Role-channel findings below refer to the feature branch, not the older main snapshot. |
| server-runtime | `main` — `fc7d9de3f3e63baea8258885e55efe8e242904d0` | `lib/`, `acl/`, `service/`, `schemas/`, tests and package metadata; remote matched. Package manifest says `0.1.0-alpha.3`; registry publication was not audited. |
| ui-runtime | `main` — `5366d904356b414e87848a0bc8870b612e6c748a` | `src/`, tests, package metadata and provenance; remote matched. Manifest `0.1.0-alpha.2`. |
| system-mfs | `main` — `53101c4a995ffca9118f795ab5d4c7c731200a2f` | `lib/`, `server/schemas/SCHEMA_MANIFEST.json`, `schemas/`, tests; remote matched. Manifest `0.1.0-alpha.2`. |
| window-manager | `main` — `e294979dfcb59f73af19975e40f890a0b366cd8c` | `lib/`, `skin/`, package exports, browser/model/artifact tests; remote matched. Manifest `0.1.0-alpha.2`. |
| finder | `main` — `b46e2c94b615a1993b6162716d9e8965d0029564` | `lib/`, `skeleton/`, `skin/`, CONTRACTS and tests; remote matched. Manifest `0.1.0-alpha.4`. |

The committed Debian snapshots contain `config/drumee.example.yaml`, schema and renderer; operator `config/drumee.yaml` is not a committed input in those snapshots. Temporary example-derived YAML was used for rendering probes; existing production config/credentials were not copied.

Additional source was inspected only for a concrete dependency: pinned `server-essentials` (`main`, `b9460ba442c9962471a592c49ce36b01e0327ff5`) for MariaDB/Redis/configuration clients, pinned `server-core` (`main`, `bf7c396b14614f247507f771f72e98184ed931b4`) for historical file/upload provenance, and kernel control-plane code in transient for current provisioning boundaries. No Oxymotion business repository audit or deployment is necessary to define this generic API.

### 2.2 Entry points, dependencies, installation and validation

| Repository | Executable entry points / config inputs | Installation assumptions and available validation |
|---|---|---|
| setup-infra | `infra.js::main`, `jitsi.js`, `bin/install`; env, argparse, `sysEnv`, lodash templates | Defaults to host root, `/etc/drumee`, `/srv`/`/var/lib`, local service accounts, MariaDB socket detection, PM2 ecosystem. `--chroot` redirects many writes but does not isolate all installer actions. No meaningful package test suite; characterize templates safely. |
| setup-schemas | `bin/install`, `populate.js`; `lib/{schema,organization,drumate,utils}.js`, genesis SQL, credential JSON | Native physical seed restore, local MariaDB manipulation and historical MFS/factory provisioning. Current CLI helpers also accept TCP credentials. `test/{db,nobody,cache,modules}.js` require installed state; not safe generic unit validation. |
| debian | `config/render.mjs`, `bin/drumee-ctl`, package maintainer scripts; source entrypoints in `deploy/docker/`, role entrypoints in `bootstrap/usr/lib/drumee/entrypoint/` | Constrained YAML + JSON schema defaults; Team package release train; official MariaDB/Redis images. Roles use shared configuration subpaths and uid 8000. Tests include `smoke-config.sh`, `config-parity.sh`, native harnesses, smoke-container/e2e, version checks; many require images or disposable native roots. |
| server-runtime | library `lib/index.js`, factories `createServiceServer`/`createPushServer`, bootstrap/yp workers | Consumer composes listeners, stores, module registry and authorizers. No Docker/Nginx installer or production page server entrypoint. Yellow Page schemas and provisioned platform identities are preconditions for authenticated operation. Unit, authorization, binary upload, schema and artifact tests. |
| ui-runtime | `src/index.js`, `src/browser.js`; bootstrap, Kind, loader, service and WebSocket modules | CommonJS + Webpack artifact, READY before plugins; service base URL and plugin resolver supplied by host. No DNS/container/database contract. Unit and artifact tests. |
| system-mfs | `lib/index.js`, `store.js`, `filesystem.js`, `content-store.js`; canonical schema manifest | Caller supplies resolved Hub shard/context, database and content/staging adapters. No autonomous identity creation. Filesystem, SQL granularity, artifact and opt-in MariaDB tests. |
| window-manager | `lib/index.js`, `lib/browser.js`, exported CSS | LETC and jquery-ui dependencies; no server process, schema or infrastructure service. Browser/model/artifact tests. |
| finder | `lib/index.js`, `lib/browser.js`, `lib/window.js`, logical MFS/media/transfer clients | LETC, injectable HTTP/binary/event transport, optional Window Manager. Backend services are separate transient capabilities, not packaged inside Finder. Core, transport, interaction, browser and artifact tests. |

### 2.3 Relevant history

History was inspected with `git log` and selected `git show --stat`/commit bodies. Local setup-infra history includes `620c4efc4644765bfaf3371f1a5da54d1f00e58c` (database host), `7e7254675b7eff5fc74eb8d94633a024f9a91ddd` (Nginx upstream), `cf804e7d8b560e1af6dd91d9fba196d9f7b26945` (runtime paths versus render root), and `f93dad561d46fc1922234cb18bdbc5828015a2c5` (fresh-container rendering). These narratives support tracing; present code determines behavior.

setup-schemas history includes `bef2516cae4d7e9551533d0c2fb547a2d4f48584` (TCP CLI), `341bd861040f49d1dc067d86ae9248830a7192df` (Hub result shape), and `a110a85ff716005a20e54addbf16c465105a49c8` (non-root ownership). Debian `e88ba219fc202cfa668d3363428bc6f0b9cd0ced` describes missing certs/crypto directories and converter crash loops; current code includes corresponding guards. `8a236e5...` adds ACME-email default parity. A direct local setup-infra diff against the manifest SHA failed because that object is absent in the local repository; filesystem comparison and transient import history were used instead, without asserting ancestry.

Runtime `d17ecee8c645f1d14a7e2ef45a2f3542a27c0763` added the bounded binary input path. Current server HEAD enforces per-Hub capability readiness. system-mfs HEAD moves to the canonical manifest path. Finder HEAD adds access-aware interaction reconciliation. These contracts must survive the infrastructure extraction.

## 3. Historical architecture and separation of responsibilities

### 3.1 setup-infra

`infra.js::getSysConfigs` reads existing settings and produces `drumee.json`; `writeInfraConf` renders Nginx routes, SSL references, BIND zones, MariaDB files, Postfix maps and credential files; `writeEcoSystem` writes PM2 main/page, clustered service and factory processes. Inputs mix domain/IP discovery, host storage paths, credentials, conferencing and application configuration. This is a host-wide installer/configuration generator, not a minimal-kernel capability. [I1][I3]

The existing guard exits successfully when settings exist unless reconfiguration is requested. Recent code preserves readable nonempty DB/email/Postfix secrets, supports `APP_HOST` and `DB_HOST/PORT/USER/PASSWORD`, and avoids several render-root leaks. Retain those fixes. Do not interpret the guard's “ALL EXISTING DATA WILL BE LOST” message as proof that `infra.js` itself deletes customer databases: the confirmed actions are file rewrites and selected stale-config deletion. Corrupt existing credential files still trigger generation fallback. [I1][I2]

`bin/install` generates DKIM **before** running the renderer and before the chroot early return. It later configures cron, service directories, ownership, DNS, certificates and Prosody on the host. `jitsi.js::makeConfData` generates XMPP/Jicofo/JVB secrets afresh. Conferencing is unrelated to the first kernel and must be absent by default, including its Nginx includes and certificate names. [I3][I4]

### 3.2 setup-schemas: evidence only

Separate five historical operations:

| Operation | Evidence | Infra Layer ownership |
|---|---|---|
| Database engine availability | MariaDB host config and native service control | Provide engine, network endpoint, storage and administrative connection. |
| Historical schema installation | `bin/install` physical `mariabackup --copy-back`; Debian `bootstrap/usr/lib/drumee/schemas/init` factory SQL | Exclude both historical initializers from the minimal deployment. |
| Identity / organisation provisioning | `populate.js::start` → `Organization.populate/createNobody/createGuest/createSystemUser/createAdmin` | Kernel/platform control plane; not Infra Layer. |
| Hub and entity-pool provisioning | `stockFactory`, `Schema.create_entity`, `Drumate.createHub` | Current Hub lifecycle orchestrator and module hooks, not historical factory pools. |
| MFS/storage semantics | `Schema.create_vfs_root/create_media_root`, media/portal/admin Hubs | system-mfs owns metadata/content semantics; Infra Layer supplies volumes only. |

`populate.js::afterInstall` generates and writes RSA keys without an existing-key check. Historical system/admin creation also creates content/portal Hubs. These are incompatible with “infrastructure initialization only.” Current TCP and non-root fixes make the old installer more container-friendly; they do not make its provisioning compatible with the minimal kernel. [S1][S2]

The known historical search-projection/active-transaction provisioning defect remains separate baseline evidence (existing refactoring risk/environment dossiers). IL-0 did not execute provisioning or reproduce that failure; no Team parity claim is made.

### 3.3 Debian channels

The pinned main tree has the source-built Compose channel. The inspected feature branch adds package-role images while keeping `images.stack=source` as the renderer default. Source channel: Caddy, MariaDB, Redis, Team server-pod, UI/static asset publisher jobs, historical schema/populate/factory jobs and optional infrastructure rendering. The source renderer has no actual DNS or mail service, despite infra-init's `dns`/`mail` profiles and configuration outputs. [D1][D4]

Role channel: official MariaDB (`db`) and Redis (`cache`), an infra rendering job, schemas-init and migrate jobs, app and Nginx web roles, optional converter, DNS and mail roles. Configuration is mainly produced once and mounted read-only by consumers. Infra-init calls Debian package reconfiguration with a preseed; this prevents duplicated environment-to-flag mappings, but couples configuration generation to package maintainer scripts. The minimal adapter should retain a single owner while replacing that host-installer invocation with the approved planner/renderer, not copying the entire package lifecycle. [D1][D3][D5]

Native package postinsts bridge debconf/env, configure service accounts, reload Nginx, manage DNS/systemd/WireGuard and install historical schemas. They are a future **native adapter** concern. Docker IL-1 must not depend on APT, debconf or host PM2. Existing role build pinning and distribution version checks remain useful packaging evidence. Source Dockerfiles compile Team UI and reuse Team server dependencies; replace payload composition with validated kernel/module artifacts without changing the existing distribution in IL-0.

## 4. Minimal-kernel infrastructure requirements

The kernel declares protocol/storage requirements; an adapter resolves them into concrete services, credentials, ports and paths. There is no infrastructure module requirement in server-runtime today; the declarative requirement document is proposed, not an already implemented discovery API.

| Requirement | Current evidence | Resulting infrastructure contract |
|---|---|---|
| Native service transport | Runtime `http.js`, dispatcher, ACL descriptors | Preserve `module.method`, query/body, cookies, status/envelope; no gateway ACL decisions. |
| Identity/session continuity | `session.js`, `input.js`, Yellow Page store | MariaDB-backed session/identity state; pass regsid cookie/header bridge; no session translation. |
| Dynamic frontend bundles | `plugin-resolver.js`, UI `kind.js/loader.js` | Serve resolver-returned approved bundle paths from artifact roots; core READY and addon handshake remain runtime-owned. |
| WebSocket push | `websocket-router.js`, `push-bus.js` | HTTP/1.1 Upgrade; subprotocol `service`, one-time OTAK, Origin policy; Redis pub/sub and Yellow Page socket store. |
| Hub/MFS | Hub authorizer, system-mfs shard store/content store | Persistent MariaDB databases, content volume and explicit filesystem bindings; trusted Hub selection stays in kernel. |
| Heavy files / ZIPs | HostFilesystem/FileIo; MFS transfer/media workers | Kernel-authorized internal redirect and gateway-only filesystem read access. |
| Frontend static assets | Webpack/ui-build, LETC/Window Manager/Finder | Immutable built bundles/CSS/fonts/assets; no frontend build at instance startup. |
| Runtime processes | Library factories; integration composition host | Consumer supplies executable application composition and listener config. Infra Layer runs processes; it does not implement that host. |

Build metadata remains distinct from application manifests and infrastructure state. `target/tooling/ui-build/lib/manifest.js` produces Webpack hash/entry/version/revision metadata; the server/composition consumer projects that into bootstrap bundle selection/appHash. Infra Layer serves the selected immutable files and records deployment artifact digests, but does not generate a second RuntimeEnv or merge those metadata formats into InfrastructureSpec. Frontend plugin `index.json` entry lookup is separately owned by FrontendPluginResolver.

Database schemas remain at package-relative intrinsic runtime schemas, system-mfs's `server/schemas/SCHEMA_MANIFEST.json`, and module-owned manifests. Bootstrap provisions organisation `id=1`, nobody `ffffffffffffffff`, and distinct resolved guest/system identities. Current control-plane bootstrap and Hub lifecycle own those writes. Infrastructure schema readiness is not an acceptable substitute for their validation.

The base anonymous kernel can run without MariaDB/MFS/Redis when those capabilities are absent. The authenticated, push-enabled MFS acceptance profile needs MariaDB and Redis. Window Manager itself adds only browser dependencies. Finder adds MFS/media/transfer consumers, not a new database engine or mail requirement.

## 5. Canonical HTTP and Nginx contract inventory

Sources: shared `routes/app.conf.tpl` [I5], internal/static aliases [I6], runtime parser/status/output [K1], media/transfer ACL and workers [K2][K3], UI/Finder clients [U1][F1], and existing kernel gateway harness [T1]. Historical default upstreams are REST `24000`, page/push `23000`; adapter endpoints may differ and must be declared explicitly. These ports are not a requirement to publish host listeners.

**Headers common to proxied routes:** preserve query strings, `Cookie`, `Set-Cookie`, `regsid`, `x-param-keysel`, `x-param-regsid`, Content-Type and request method. Kernel `Input.authorization` uses the x-param bridge; a generic `Authorization: Bearer` is not interpreted as a session by this runtime. Forward validated Host, original Origin and trusted scheme/port/client address. Gateway must overwrite client-supplied forwarding identity at its trust boundary. Gateway CORS must not invent permissions or duplicate the runtime's allowlisted CORS policy.

| ID | Method / path | Authentication, consumer and upstream | Nginx responsibility / headers / buffering | Required compatibility proof |
|---|---|---|---|---|
| H1 | POST `/-/svc/yp.signin` | Public ACL entry; kernel verifies credentials through Yellow Page. REST. | Service proxy [I5] (lines 80); preserve JSON and response session headers; no cache. | Invalid/valid credentials, session rotation/continuity, cookies and x-param conflict rejection. |
| H2 | POST `/-/svc/bootstrap.authn` | Domain-scoped `src:anyone`, public-api fast path; allocates continuity and OTAK. REST. | Same proxy; no business privilege added by gateway; never cache/log token values. | Anonymous/authenticated issuance, missing regsid allocation, OTAK distinct from regsid. |
| H3 | GET/POST service calls `/-/svc/<module.method>`; historical `/-/service/<module.method>` | Dispatcher resolves public/private Worker and ACL; REST. Runtime also parses PUT/PATCH bodies. | Preserve path/query; `http.js` JSON input max 64 KiB; statuses 400/401/403/404/413/500 and `{status,data}`/error envelope; bounded response proxying. | Dispatch, private denial, errors, wrong service format, supplied headers; reject unsupported methods where contract requires. |
| H4 | GET service `bootstrap.plugin` at `/-/svc/bootstrap.plugin?name=...` | Anonymous bootstrap descriptor; backend resolves frontend `index.json` to `{path}`. REST. | No filesystem path guessing in gateway; response must remain fresh when application artifact changes. | Missing/invalid manifests, path resolution, READY → loadJS → addons registration. |
| H5 | GET/HEAD `/-/app/**`, `/-/api/**`, `/-/plugins/**` | Public build artifacts; LETC and dynamic CommonJS bundles. Static roots. | Prefix aliases [I5] (lines 39–63); bounded approved artifact roots, MIME/CSS/fonts, versioned cache semantics. No credentials or server source in roots. | Hash/entry filenames, chunks, plugin bundle, CSS/assets; directory traversal and missing files. `/-/api/` is historical frontend assets, not an API backend. |
| H6 | GET/HEAD `/-/static/**`, `/-/images/**`, `/-/fonts/**` | Public generic assets, not MFS content. Static roots. | Explicit aliases [I6] (lines 25–46); no directory listings, only declared public artifacts. | Correct bytes/MIME, no credential/config files, cache validation. |
| H7 | GET `/`, `/-/`, selected page/bootstrap resource such as `/bootstrap.js` | Distribution/composition host serves page and runtime configuration. Page upstream. | Historical index fallback [I5] (lines 164); no long cache for identity-bearing bootstrap; approved host names only. | Load complete page and LETC/plugin chain. `/bootstrap.js` occurs in historical Docker routing intent; minimal runtime package itself has no such page entrypoint. Consumer must declare its actual path. |
| H8 | GET Upgrade `/-/websocket/?otak=...`, historical `/-/ws/` | WebSocket router claims OTAK atomically; Origin policy; subprotocol `service`. Push upstream. | HTTP/1.1 Upgrade/Connection, Host and scheme/port, Origin and Sec-WebSocket-*; explicit idle/read timeout; no response buffering for upgraded connection. | OTAK reuse/absence denial; regsid-only denial; allowlisted external Origin, anonymous push, reconnect and cross-client isolation. |
| H9 | GET/HEAD `/-/svc/media.{orig,preview,thumb,document,video}?hub_id=...&nid=...` | Private MFS read ACL before worker; original or representation artifact. REST then internal static. | Preserve FileIo `X-Accel-Redirect`, Content-Disposition/Type/Length, Range/If-Range. Default FileIo cache `no-store`. | Unauthorized/cross-Hub denial, unchanged original, missing derivative, filename encoding, partial-content tests. HEAD semantics are a validation target, not yet confirmed end to end. |
| H10 | GET `/-/vdo/<nid>[/<hub_id>]/master.m3u8`, `stream-<n>/playlist.m3u8`, `stream-<n>/segment-<n>.ts` | Runtime `videoRequest` maps to `video.master/stream/segment`; private MFS read. REST; playlists small inline output, segments internal files. | Historical vdo proxy [I5] (lines 80), preserve paths, content type and query; playlist rewrites remain media-owned. | Every HLS path, authorization for each request, query continuity and segment bytes. No static HLS bypass. |
| H11 | POST `/-/svc/mfs-transfer.upload_{start,status,complete,abort}` | Destination MFS write ACL, authenticated transfer owner. REST. | JSON control calls; no file bodies here; complete hashes/commits inside kernel. | Missing chunks, hash mismatch, expiry, revoked access and capacity failure. |
| H12 | POST `/-/svc/mfs-transfer.upload_chunk?transfer_id=...&index=...` with `application/octet-stream` | Runtime authorizeRequest + transfer preflight **before** tempfile reception, then normal dispatch authorization. REST. | Bounded body; preserve query/Content-Length or chunked transfer encoding; provide temp capacity. Current template leaves request buffering at Nginx default. Proposed upload location uses explicit streaming and limits, subject to IL-1 cancellation/backpressure tests. | Out-of-order and duplicate chunks, limit 413, aborted client cleanup, unauthorized body rejection, slow uploads, HTTP chunked request without Content-Length. |
| H13 | POST `/-/svc/mfs-transfer.download_{prepare,status,cancel,release}`; GET/POST `download_retrieve` | Source MFS read ACL plus transfer owner; archive worker outside HTTP process. REST. | Small control replies; retrieval internal redirect to shared staged ZIP, not JSON bytes. | ZIP validity, progress events, cancel/release/TTL, fresh authorization on retrieve. |
| H14 | Internal `/__drumee_artifacts/<encoded-relative-path>` | Only reachable by authorized upstream internal redirect. HostFilesystem generates URL. | `internal; alias <artifact-view>/;`; content and ZIP staging under the declared view. Direct external requests fail (Nginx internal locations return 404). | External GET/HEAD/Range denied, traversal/encoded traversal/symlink isolation, successful authorized delegation. |
| H15 | Historical `/mfs/**`, `/accel/**`; `/-/file/...`, `/-/doc/...`, `/-/avatar/...`, `/-/letc/...` | Historical internal aliases and rewrites to media/block/yp services. Some target services absent from minimal kernel. | `/mfs` and `/accel` are `internal`; file/doc rewrite into REST. Do not activate Team-only block/avatar/raw routes merely to match old templates. | Characterize each adopted legacy alias; leave unsupported routes closed/404. Finder currently uses logical service URLs, not a raw path. |
| H16 | Unknown route, upstream failure, gateway limit/timeout | Kernel error envelope for service failures; gateway errors separately observable. | Do not convert 401/403 into page 200; no stack traces, physical paths or token-bearing error pages. | 400/404/413/502/504 distinction, unavailable upstream, no cached private error/success. |

`serviceFromPath` accepts a broad suffix form; `videoRequest` also recognizes `/api/<endpoint>/vdo/...`. That parser compatibility is not authority to expose all arbitrary prefixes. Public gateway routes should be finite consumer declarations. No `auth_request` use was found in the audited kernel gateway/templates; do not invent a second gateway authorization plane.

### 5.1 Transfer behavior: confirmed versus required

FileIo emits `X-Accel-Redirect`, UTF-8 Content-Disposition, length, MIME, `Accept-Ranges: bytes` and normally `Cache-Control: no-store`. RuntimeOutput.head ends the upstream response with headers; it does not stream the file. HostFilesystem bounds paths lexically and builds URL-encoded relative paths. Nginx must see the same relative file under its read-only mount. No protected content may enter a public `root` or `alias`. [K2]

The historical Nginx global template enables `sendfile`; its internals use `internal` and `alias`, and a server `root` points at the historical server directory. The kernel harness adds `/__drumee_artifacts/` itself, with a 3 MiB test body limit and separate temp paths. It is a disposable fixture, not a production config to copy wholesale. The production gateway should have no broad server-code root. [I6][T1]

**Range:** headers advertise support, and Nginx supports internal file delivery; the inspected `phase4.8-nginx-delivery.test.js` checks full ZIP/original delivery and binary chunks, not 206/416 or multipart ranges. IL-1 must characterize valid range, suffix/open-ended range, invalid range, If-Range and HEAD. Do not describe Range as already validated. Nginx `internal` and X-Accel processing are documented in its [core](https://nginx.org/en/docs/http/ngx_http_core_module.html#internal) and [proxy](https://nginx.org/en/docs/http/ngx_http_proxy_module.html) modules.

**Uploads:** current defaults are 8 MiB chunks, 16 MiB maximum binary chunk, up to 1,000,000 chunks, 128 combined jobs and 15-minute inactivity TTL. Service constructor overrides and HTTP binary maximum must agree; fixture geometry differs. Sparse file assembly writes at indexed offsets, accepts duplicate/out-of-order chunks, verifies size and optional SHA-256, then commits through MFS. One chunk can contain an entire small file, but there is no separate direct/multipart upload service in this minimal implementation. Historical `server-core/service/lib/chunked-upload.js` is provenance, not a second required protocol. [K1][K3]

**Buffering/cancellation:** neither `proxy_request_buffering` nor a transfer timeout policy is explicitly set in the inspected shared routes. Nginx may stage request bodies before the backend authorization preflight; therefore the current pipeline is not proof of gateway-level early-body rejection. Proposed IL-1 upload routing uses HTTP/1.1, `proxy_request_buffering off`, bounded chunk size, explicit idle timeouts and writable scratch storage. Verify the behavior with/without Content-Length. Keep `proxy_ignore_client_abort` off unless evidence justifies otherwise. Backend tempfile cleanup on `aborted` is unit-tested; gateway-mediated cancellation, response cancellation and slow-client backpressure are still unverified. Configuration validity alone cannot prove streaming behavior.

**Restart/retries:** transfer metadata, owner contexts and chunk receipts are Maps in one process; download `state.json` is written but not loaded on startup. Persistent staging alone cannot reconstruct jobs. A normal container restart therefore loses active transfer IDs; graceful `destroy()` kills archive workers and removes known staging. Committed original content is a separate durable resource. Specify a fresh transfer after restart and safe orphan cleanup, not resumability. Do not scale independent REST workers for this profile until sticky routing or shared kernel-owned transfer state is explicitly solved. Nginx must not replay non-idempotent start/complete operations. [K3]

**Filesystem isolation:** content root and archive staging must be mounted consistently. The current harness puts staging underneath artifact root; a default staging path in unrelated `/tmp` cannot be delegated by HostFilesystem. Read-only Nginx mounts should contain only content/representations/staged archives, never credentials, database files or general host `/data`. Lexical containment does not itself prove resistance to symlink escapes; future tests must exercise real paths, symlinks and gateway decoding. Gateway `disable_symlinks` must be characterized with `alias`; do not claim the existing helper solves that risk.

## 6. Docker/Caddy compatibility assessment

| Contract | Source-channel Caddy | Newer Debian role channel | IL-0 decision |
|---|---|---|---|
| `/-/svc/` | Proxies to REST port | Shared Nginx routes to configurable `APP_HOST` | Reuse route semantics. |
| `/-/service/`, `/-/vdo/` | Falls through to page/push listener; no REST rule | Shared Nginx service/vdo regex exists | Caddy gap; adopt only confirmed minimal routes. |
| app/static/images assets | Explicit file_server paths | Packaged assets + aliases | Useful public-static behavior. |
| plugins/api/fonts/bb-templates | No explicit corresponding static rules | Historical aliases present | Plugin/fonts are needed; other surfaces only if consumer declares them. |
| X-Accel internal artifact bytes | No handling or artifact mount | Historical `/mfs`/`accel` config; web has **no MFS/content staging volume** and no minimal artifact location | Neither topology satisfies current minimal delivery unchanged. Add read-only artifact view to Nginx adapter. |
| MFS authorization | Services may still authorize, but retrieval header has no delivery handler | Upstream kernel policy remains required | Do not “fix” Caddy by public MFS file_server. |
| WebSockets | Generic reverse proxy likely handles Upgrade; no inspected OTAK/Origin acceptance regression | Explicit HTTP/1.1 and Upgrade headers | Functional equivalence remains unproved until tests pass. |
| Private response cache | Caddy body has no explicit private route cache policy | Historical long-cache headers occur on broad routes/internal aliases | Preserve kernel no-store; remove broad private cache policy. |
| Buffering, Range, cancellation | Not characterized for this pipeline | Defaults and file headers; no complete regression | Test Nginx first; do not infer equivalence. |
| TLS mode | renderCaddyfile supports public ACME, own and local CA; `local_mode`/localhost forces plain `:80` | Nginx cert references; historical certificate generators | Decouple DNS and TLS; D0 requires LAN HTTPS. |
| DNS/mail availability | infra-init publishes config but renderer supplies no DNS/mail daemon | Actual role services supplied; DNS host networking, mail 25/587 | Reuse service work with security/persistence adaptations. |

The current `tls.terminator` option is chiefly a native-channel distinction; source Compose still uses Caddy, while roles rejects Caddy. Existing schema/docs can imply a uniform switch that the actual adapter does not supply. Caddy's software may support future alternatives; this finding is about the audited configuration, not an assertion that Caddy can never implement the contract. [D1][D4]

## 7. DNS capability: canonical three-mode specification

`dns.mode` has exactly **`none | local | localhost`**. Proposed default when omitted: `none`, with a visible normalized value. Do not infer DNS mode from TLS method, `local_mode`, ACME provider or hostname. Unknown modes and empty/malformed supplied domains fail validation.

| DNS mode | Supplied domain | Effective domain | BIND9 |
|---|---|---|---|
| none | example.com | example.com | Disabled |
| none | absent | undefined | Disabled |
| local | example.com | example.com | Enabled |
| local | absent | **drumee.lan** | Enabled |
| localhost | any supplied value or absent | **localhost** | Disabled |

`none`: preserve supplied name; external DNS is operator-managed. Do not install/render/start BIND, create zones or modify resolver settings. Undefined effective domain is valid for a capability-free plan, but an HTTP vhost/certificate capability requiring a name must report `HOSTNAME_REQUIRED` rather than choosing a name.

`local`: use supplied domain, otherwise `drumee.lan`. Require explicit intended LAN IPv4/IPv6 addresses and listen addresses. Generate only declared instance names; no implicit Team/Jitsi/mail wildcard, reverse-zone ownership, public delegation or Docker service-name records. Explicit supplied public domain remains local authority by operator choice; planning must flag possible shadowing of an existing zone.

`localhost`: force effective domain `localhost` and record supplied-domain override diagnostically. No BIND, public DNS or public ACME. HTTP may be explicitly enabled on host loopback; HTTPS uses local/own compatible material. Bind published gateway ports to host loopback for this mode. Container peers use adapter service endpoints, not `localhost`; inside a container localhost is that container.

### 7.1 Historical findings

setup-infra defaults private domain to `drumee.lan`, derives private/public domains and discovers addresses from the process network interfaces. Those interfaces are container interfaces when rendered in a container, not proof of LAN endpoint addresses. Current helpers filter nonpublishable IPv6, but LAN input must still be explicit. Zones include wildcard, SMTP, Jitsi and MX/DMARC records unconditionally, even where those capabilities are absent. `named.conf.local` includes TSIG unconditionally. [I1][I7]

Current installer DNS selection is coupled to TLS method; `--localhost` says “No bind” but `writeInfraConf` still lists BIND config targets. Debian schema has no canonical `dns` section; isolated validation rejected `dns.mode=local` as unknown. Source Compose has no DNS daemon. Feature-branch roles add `dns` as a profile, but the config's optional_services does not directly model the canonical three modes. An operator can select a profile externally; that does not meet deterministic spec rendering. [D1][D5]

Historical `named.conf.options` says `recursion yes` and `allow-recursion { ::/0; 0.0.0.0/0; }`, while top-level allow-query is restricted and zone blocks set allow-query any. This is a confirmed overly broad recursion declaration; actual external recursion exposure depends on cache/query ACLs and interfaces and was not tested. Do not call it a proven open resolver. ISC distinguishes [query/cache/recursion ACLs](https://kb.isc.org/docs/aa-00503).

### 7.2 Proposed Docker network/persistence contract

Create a BIND9 service **only** in local mode, not a dormant all-mode service. Prefer a dedicated bridge-network DNS container with TCP and UDP 53 published only to the explicitly selected host LAN address. This avoids historical host-network exposure to every host interface. No privileged container, host network or NET_ADMIN is required by the proposed topology; validate required low-port binding capability against the selected image. Root-start/drop-to-bind in existing Debian role is evidence to adapt, not a requirement to force every process to uid 8000.

Persist zone state/journals and relevant TSIG keys separately from generated immutable configuration. The existing role mounts `var/lib/bind` read-only, incompatible with dynamic updates/journals if enabled. D0 needs no ACME dynamic updates, so TSIG may be absent; a future explicit update capability must preserve keys and use a writable zone state volume. Check `named-checkconf` **and** `named-checkzone` before activation. Reconfiguration increases SOA serial deterministically only for changed zone content; no wall-clock-only nondeterminism in planning.

Default proposed local DNS is authoritative-only, recursion disabled and cache queries restricted. Client use: configure a conditional resolver for `drumee.lan` (preferred where LAN DNS already exists), or configure individual clients to query the server for that zone. A client using an authoritative-only server as its sole general resolver will lose unrelated DNS resolution. If the operator chooses sole-resolver use, an explicit LAN allowlist and forwarder requirement may enable restricted recursive service; this is a capability field, **not a fourth DNS mode**. Never change DHCP/client resolvers automatically. Browser secure-DNS settings that bypass LAN resolution must be handled explicitly during acceptance.

No public records contain `db`, `cache`, `app` or Docker bridge addresses. DNS answer A/AAAA values describe reachable instance endpoints; publish AAAA only when LAN routing and gateway IPv6 listeners are verified. Reverse zones are deferred unless the operator controls them.

## 8. TLS and certificate lifecycle

Separate TLS issuance/renewal from gateway rendering. Proposed providers are `local`, `provided`, `acme`; these are certificate providers, independent of DNS modes. D0 uses local CA-signed leaf certificate with SAN `DNS:drumee.lan`. No public ACME attempt for `.lan`; localhost likewise requires local/provided material. A local root/leaf arrangement and manual trust installation follow the mechanism described by [Let's Encrypt's local-certificate guidance](https://letsencrypt.org/docs/certificates-for-localhost/).

| Provider | Required inputs / persistent state | Renewal, validation and failure behavior |
|---|---|---|
| local | Instance-scoped CA certificate/key reference, leaf/key reference and SAN set | Generate missing CA once under explicit first-install plan; CA private key accessible only to issuer. Preserve existing CA and leaf key. Renew leaf before expiry with same CA; never implicitly rotate trust anchor. |
| provided | Operator certificate chain and key references, optional trust bundle | Check readability, matching key, SAN, expiry and permissions. Watch/explicit refresh validates replacement, stages atomically and requests gateway reload. No key generation. |
| acme | Concrete publicly valid hostname, account/email reference, challenge/provider choice and secrets, account/key/cert state | Staging issuance regression before production; scheduled renewal, bounded retries, failure diagnosis. DNS-01 provider adapter may work with dns.mode=none; do not enable local BIND implicitly. |

Persist CA/account keys, leaf private keys and certificates in dedicated resources outside image layers and application volumes. Gateway receives only active leaf/key/chain read-only, not CA signing key. Proposed key modes: 0600 issuer-only or 0640 narrowly scoped service group where needed; directories 0700/0750. Check ownership in the selected container, rather than relying on host umask. Only public CA certificate is distributed to clients; fingerprint verification and browser/OS trust-store installation are explicit operator tasks. No automatic client trust installation.

On certificate changes: stage → verify key/SAN/chain/permissions → `nginx -t` against new revision → atomically select it → controlled reload → HTTPS probe. Failed issuance/renewal retains the last valid revision and reports degraded readiness/expiry. Reload is operationally mutating and belongs to later execution, never plan().

Historical `create-local-certs` now emits SAN and two compatible file layouts, protects keys and copies only certificates to the host trust directory. Keep the SAN and layout evidence, replace its unconditional new-key invocation, combined CA/leaf `CA:TRUE` use and host trust-store side effects. `init-acme` uses acme.sh DNS-01 for apex/wildcards/Jitsi/vendors, retries issuance and changes service groups; it does not establish a clean standalone renewal/reload contract. It copies key material to a `${target}.key` path although `target` is not set in `make_certs`; the resulting destination must not be preserved. `bin/init-mail` similarly regenerates DKIM unconditionally. [I3][I4][I8]

Native Caddy package includes certificate export/service/timer tooling; the source Compose Caddy has persistent `caddy_data/config` volumes. These are evidence for persistence and renewal, not a reason to retain two gateway processes. Future Caddy equivalence requires the whole H1–H16 suite.

## 9. MariaDB and Redis infrastructure contracts

### 9.1 MariaDB

Provide engine version/digest, TCP endpoint, infrastructure/admin credential reference, volume, readiness and backup access. Keep database port internal to Compose by default. Connection availability is `SELECT 1`/InnoDB readiness; kernel intrinsic schemas, platform bootstrap, Hub registry/shards and application migrations have distinct readiness reported by their owners.

Historical MariaDB template binds `127.0.0.1`, uses `<db_dir>/run` and `/run/mysqld` pid/socket conventions. Do not mount it unchanged into a separate official database container. The official-image `/var/lib/mysql` persistent volume and connection healthcheck are suitable patterns. The roles renderer uses database-host network aliases; preserve endpoint consistency across consumer credentials and network names. [I9][D1]

Historical schema init creates `yp`, `utils`, `mailserver`, `template`, `trash`, imports factory seeds with `--force`, sets domain 1 and grants broad global privileges to `drumee-app@%`. It is excluded. Infra Layer may initialize administrative/infrastructure DB accounts but must not choose logical Drumee schema names, create identities, install application SQL or grant all global permissions to every service. Current Hub lifecycle `ensureShard` explicitly creates/grants a shard through its database adapter; the deployment must supply a separately scoped control-plane/migration credential able to perform those operations. Runtime privileges are a kernel-owned requirement requiring characterization, not invented least-privilege grants that silently break provisioning. [D6][K4]

Reject malformed credentials; existing secret references are authoritative. Changing a configured password on a nonempty MariaDB volume does not prove the actual database account changed. Rotation is a separately planned coordinated account update with verification and recovery, never re-rendering. Verify credentials before startup and do not hand DB root credentials to gateway, converter, mail or normal app containers.

Backups must include routines/triggers/events and account grants where required, with a consistent database snapshot coordinated with canonical files. Restore first into an isolated matching engine version, then validate kernel/module state. Engine upgrade/downgrade and SQL migration rollback are separate compatibility questions; image-tag rollback alone is insufficient.

### 9.2 Redis

Minimal push uses RedisStore-compatible `sendData`, subscriber duplication and live update channel, while YellowPageStore stores sessions, OTAKs and socket bindings through MariaDB procedures. Do not claim Redis is the authoritative session database for this kernel. Pub/sub messages are ephemeral; missed events require consumer refresh/reconciliation. Reconstructible caches and live socket notifications do not require durable Redis persistence. Any future durable queue must declare durability separately. [K5][E1]

Provide internal endpoint, optional auth/TLS requirement, namespaced channel, readiness and reconnect/failure observations. No public 6379 binding. Redis PING readiness must use the same authentication as the consumer. Optional persistence can be declared for actual durable users; a named volume alone does not enable AOF persistence.

Confirmed current generic client incompatibility: pinned Essentials `redis-store.js` reads `redisAuth` but `init` destructures/uses `redisUrl` or `redis://host:port` without applying redisAuth to createClient. Duplicates inherit the initial client config. A credential-bearing `redisUrl` is a potential compatible input, but must be tested for all clients and protected from logs; do not promise a redisAuth field works. Debian deliberately avoids autogenerating Redis passwords because an historical secondary client lacks authentication. Minimal runtime injects its Redis provider, so a future compatible provider is possible above Essentials; IL-0 changes neither package. [E1][D1]

Isolated validation may use an unexposed unauthenticated Redis only with an explicit accepted internal-network profile. Authenticated Redis support is a planned integration gate, not a silent downgrade if a requested password fails. Restart tests must verify app subscriber reconnection, missing push recovery, preserved SQL sessions and fresh socket/OTAK binding. Present unit tests prove message routing with doubles, not Redis restart recovery.

## 10. SMTP/Postfix and DKIM

Portable SMTP consumption is endpoint + port + transport (`plain`, STARTTLS or TLS) + auth reference + trust requirements + approved sender/testing policy. No application must know Postfix filenames, DKIM selectors or mailserver SQL tables. Mail configuration rendering and daemon availability are different states.

The historical Postfix template has SMTP TLS references, relay restrictions, a fixed `192.168.5.0/24` trusted network, empty relayhost, MySQL-backed virtual maps at 127.0.0.1/mailserver, Dovecot LMTP, spamass/OpenDKIM milter endpoints and a 25 MiB message limit. Those DB and mailbox dependencies are incompatible with a generic outbound submission/relay capability. Keep relay restriction concepts and DKIM signing; adapt trust networks, outbound relay, identity and queue paths. Do not infer an open relay: `reject_unauth_destination` is present, although hardcoded trusted LAN addresses are unsafe to preserve generically. [I10]

Old source `infra-init` generates DKIM into a scratch tree and replaces published mail config subtrees each run. The newer role init preserves `dkim.txt` if present, but its `opendkim-genkey -s dkim` output `dkim.private` differs from setup-infra KeyTable's `mail` selector/`private.pem`. The native `bin/init-mail` can generate the latter separately before chroot return. Confirmed producer/consumer mismatch; a working signing service was not proven. Pick one selector/key contract, retain existing effective keys during migration and expose the public TXT record. [D3][D4][I10]

The roles mail entrypoint starts OpenDKIM then Postfix and runs `postfix check`; the Compose template publishes 25/587 on all host interfaces and has no persistent mail queue volume. Existing rendered config references certificates and mail DB dependencies not all mounted/provided to that role. Treat service viability as a validation gap, not production mail readiness. `milter_default_action=accept` does not prove signing failure will reject delivery, despite the entrypoint comment. [D5][I10]

Proposed first Docker mail implementation: internal submission/relay with durable queue, scoped auth, TLS verification, and a capture sink or restricted test relay; default outside egress blocked in the test topology. No commercial sending by default, no inbound mailbox hosting requirement. Test message receipt in sink, queue/retry/restart, DKIM cryptographic verification, auth rejection and prohibited relay; a TCP socket alone is insufficient. Preserve DKIM secrets across container recreation and upgrades. SMTP disabled does not block kernel boot; a consumer declaring it required must fail capability validation.

## 11. Security findings and evidence

Priority indicates implementation gating, not a speculative exploit score. Categories are **defect**, **coupling**, **risk requiring validation**, or **documentation inconsistency**. All behavior is revision-scoped.

| ID / priority / class | Confirmed source behavior or bounded risk | Evidence / proposed disposition |
|---|---|---|
| SEC-01 / blocking / defect | `Template.write` opens `w+` before checking readonly, truncating an existing file. Other direct writers bypass readonly: credential writes/stale removal in infra.js. | [I2] (lines 77), [I1] (lines 662). Isolated execution of the actual extracted write function reduced a fixture to 0 bytes. Replace plan path; never run full renderer as dry-run on host. |
| SEC-02 / blocking / defect | `fillSecrets` regenerates null DB/root passwords every env/all render; no existing state read. | [D1] (lines 229,1109). Two repeated source and roles renders changed both passwords. Create persistent secret refs once; planning does not generate/rewrite them. |
| SEC-03 / blocking / defect | Existing malformed/unreadable credential JSON falls back to a newly generated secret. | [I1] (lines 573). Fail closed on corruption; do not repair by rotation. Valid-secret preservation is already implemented and should be retained. |
| SEC-04 / blocking / defect | Certificate self_sign unconditionally creates a new key; init-mail likewise. Role FORCE_RENDER invokes cert generation, and native bin/install invokes init-mail before guard/chroot. | [I3] (lines 13), [I4] (lines 65), [D3] (lines 136), `bin/init-mail`. Separate explicit rotation from reconfiguration. |
| SEC-05 / blocking / coupling | Render target is not a sandbox: bin/install init-mail writes absolute host paths first; full cert helper updates host trust. infra.js creates cache dirs using runtime absolute paths. | [I3], [I1] (lines :writeInfraConf), [I4]. No full installer/render executed on testbox or local host. New render must be pure. |
| SEC-06 / blocking / defect | Docker backup excludes named config/credential/certificate/DNS/mail volumes; data tar errors are ignored; container restore imports DB only; rollback does not restore images or data files. | [D2] (lines 101–165). Replace internals while preserving operator command concepts; coherent backup/restore gate before upgrades. |
| SEC-07 / blocking / coupling | Broad historical `GRANT ... ON *.*`, logical seeds and identity/Hub/MFS provisioning mixed with DB service init. | [D6], [S1][S2]. Separate admin, migration/control-plane and runtime credentials; omit old bootstrap. |
| SEC-08 / high / compatibility defect | FileIo expects internal artifact alias; Caddy has no handler and roles web lacks content/staging mount. | [K2], [D1], [D4]. Add canonical read-only delegated view; never expose public file root. |
| SEC-09 / high / risk requiring validation | HostFilesystem path checks are lexical; symlink ancestors and Nginx URI decoding could escape intended view if hostile files are introduced. | `host-filesystem/lib/host-filesystem.js::within/original/artifact/internalUrl`. Test real symlinks and encoded traversal; no successful bypass claimed. |
| SEC-10 / high / coupling | Historical static plugin/API aliases and server root can serve a wider tree than declared public artifacts. | [I5][I6], sites-enabled `02-private.conf.tpl::root`. Restrict roots; test no package configs/source/secrets; exposure of an actual secret was not demonstrated. |
| SEC-11 / high / risk requiring validation | Broad recursion ACL, zone query-any, hardcoded forwarders and all-interface IPv6 listen. | [I7]. Explicit interfaces/query/cache/recursion ACL; no open-resolver claim without a probe. |
| SEC-12 / high / coupling | Postfix trusts hardcoded LAN subnet; maps depend on local mailserver DB; credentials generated with TLS verification disabled. | [I10], [I1] (lines :writeInfraConf(email)). Replace subnet defaults and provide verified portable submission trust. No open-relay exploit claimed. |
| SEC-13 / high / defect | redisAuth field does not authenticate pinned RedisStore client; naïve requirepass breaks it. | [E1] (lines :init), [D1] (lines :fillSecrets). Characterize compatible injected client; fail requested-auth plans until supported. |
| SEC-14 / high / risk requiring validation | Default Nginx combined access log may record OTAK in query; debug/readonly/loadEnvFile print configuration data; renderer validate prints normalized explicit passwords. | [I1] (lines :loadEnvFile/writeTemplates), [I9], [D1] (lines :validate command). Redact credentials/tokens and prefer safe `$uri` logging as in [T1]. No live secret logs were read/exported. |
| SEC-15 / high / coupling | roles app/web use full `.env`, including DB root and SMTP passwords, although gateway does not need them; full `/etc/drumee` mount exposes more credentials than required. | [D1] (lines :renderComposeRoles). Mount scoped credential/config trees and narrow env; preserve converter isolation pattern. |
| SEC-16 / high / risk requiring validation | Runtime Origin comparison uses Host and forwarded port; public direct upstream access or trusted spoofed forwarding values would undermine deployment trust. | [K5] (lines :sameRequestOrigin), [I5]. Unpublished upstreams, host allowlist/default reject, overwrite forwarding identity; allowlisted external origins configured in runtime. |
| SEC-17 / medium / defect | DNS writable state needed for dynamic updates is mounted read-only; mail queue not persisted; selector/key mismatch across DKIM generation and template. | [D1] (lines :roles dns/mail), [D3], [I10]. Persistent state resources and real integration tests required. |
| SEC-18 / medium / documentation inconsistency | docs say all credentials regenerate, only two role images exist, SMTP rejection on signing failure, or tag upgrade/rollback semantics stronger than code. | Debian `docs/infra-init.md`, schema stack description versus seven Dockerfiles/history, mail entrypoint versus milter_default_action, [D2]. Use current executable evidence; document limitations. |
| SEC-19 / blocking for D0 / confirmed environment conflict | testbox already listens on TCP/UDP53 and TCP80/443, with an existing historical role deployment. | Read-only SSH observation, section 18. New plan must not take these resources silently. |

No persistent source/infrastructure fix is included in IL-0. Confirmed risks are acceptance gates; hypothetical vulnerabilities without an identified behavior are not added to this register.

## 12. Configuration ownership, storage and lifecycle

One authoritative desired spec → one validated adapter plan → versioned generated config. Do not permit independent setup-infra, app entrypoint and Debian renderer writers for the same credential/path. Compatibility projections (historical JSON, env or native preseed) may be generated from the same plan, not edited independently.

| Resource | Authority / writer | Readers / durability |
|---|---|---|
| Desired infrastructure spec | Operator/distribution | Planner; no embedded plaintext secrets in review artifacts. |
| Kernel requirements, schema/provisioning state | Kernel/module manifests and control plane | Infra plan consumes requirements, never owns schema/identity decisions. |
| Generated gateway/DNS/mail config | Infra renderer, one immutable revision | Services read-only; active revision recorded independently of timestamps. |
| DB admin/runtime/control-plane secrets | Infrastructure secret store; grants coordinated by authorized schema/control-plane jobs | Only each intended service/job; preserve, validate and rotate explicitly. |
| TLS CA/ACME/DKIM/TSIG secrets | Respective infra capability | Persistent issuer-only state; narrow read access for active leaf/DKIM/TSIG consumers. |
| MariaDB files | Database engine | Durable named volume; no app filesystem access. |
| Canonical MFS originals/versions and application state | Kernel/system-mfs/application | Durable volumes; gateway gets read-only protected artifact view. Infra never names users/Hubs or performs content GC. |
| Transfer staging and binary incoming files | Transfer/runtime capability | Bounded scratch volume; staging must be within the delegated view where ZIP delivery requires it. Restart/orphan behavior explicit. |
| Public UI artifacts | ui-build/package producer | Immutable image or versioned publication volume; never writable by user uploads. |
| Redis cache/pubsub | Redis plus runtime consumers | Reconstructible by default; durability only if required by a declared queue consumer. |
| Mail queue / DNS journals | Service engine | Durable, backed up; distinct from generated config. |
| Logs / gateway body temp | Infrastructure services | stdout/stderr + bounded writable scratch; logs redacted, temp quotas/cleanup observable. |

Proposed Docker composition has `nginx`, `database`, `redis`, a consumer-owned kernel composition host, optional `dns` and `mail`, and run-once infrastructure validation/certificate jobs. Separate kernel schema/install/bootstrap/application-migration jobs are owned and supplied by the control plane/distribution. Infra Layer can express their dependency ordering but cannot implement their semantics. No factory replenisher, Team schema dump, Jitsi, marketing service or automatic plugin installer.

Docker Compose supervises the first deployment. Prefer one declared long-running process per container where the consumer permits it. Historical PM2 main/service/factory ecosystem is not needed by the runtime libraries. Feature-branch app currently uses a PM2 daemon plus log-tail PID1 after an argv/cluster problem; this does not prove robust signal propagation. If a consumer requires internal PM2, validate foreground supervision, SIGTERM forwarding, worker drain, exit propagation and bounded stop grace. No host PM2.

Startup: config validated → secrets/required certificate state available → database/Redis healthy → external kernel schema and platform validation jobs complete → application host ready → gateway/DNS checks → browser acceptance. Dependencies marked service_started only establish process startup; [Compose health conditions](https://docs.docker.com/compose/how-tos/startup-order/) can wait for declared healthchecks, not application correctness. Individual service recovery still needs consumer reconnect logic.

Normal upgrade preserves identity/ACL/schema state, customer Hubs, originals/versions, application state, all infrastructure keys and queues/zones. Planning classifies changes into config-only/reload, container recreation, new volume, credential rotation, engine upgrade, migration prerequisite and destructive/incompatible. Explicit destructive requests remain outside ordinary apply. Pin image digests and record version/schema compatibility; reject unclassified volume deletion, ownership changes or domain/CA replacement.

Backup must inventory and checksum every durable resource, coordinate DB/content consistency with the control plane, protect secret-containing archives, and verify isolated restoration. Infra provides mechanics; the kernel/application owns the quiescence/migration contract. Restore never silently merges an old identity DB with current content. Rollback distinguishes code/config reversal, compatible additive schema retention, and full coordinated snapshot recovery. Existing drumee-ctl's image pull/up and database-only restore cannot promise these semantics. [D2]

## 13. KEEP / ADAPT / REPLACE / DEFER extraction map

Every future extraction must record source repository/path/symbol/SHA, target path, dependencies and intentional semantic differences in PROVENANCE. Baselines are section 2; no copy is authorized by this dossier alone.

| Source / exact component | Current → target responsibility | Class / rationale | Dependencies, risks and required tests |
|---|---|---|---|
| setup-infra `templates/etc/drumee/infrastructure/routes/app.conf.tpl` | Historical shared HTTP route semantics → finite kernel gateway routes | **ADAPT**; retain service/push/plugin behavior, omit absent Team rewrites | Nginx/core runtime URLs; H1–H16, header/cache/Host tests. |
| setup-infra `internals/accel.{private,public}.conf.tpl` | Internal/public file aliases → protected artifact delegation + public asset roots | **ADAPT**; preserve internal mechanism, update prefix/mount and cache | HostFilesystem/FileIo; direct access, Range, traversal, symlink tests. |
| transient `host-filesystem/lib/file-io.js`, gateway harness `container/entrypoint.sh` | FileIo producer and fixture alias → reference protocol evidence | **KEEP** kernel implementation ownership; do not copy into infra | Adapter honors producer, integration tests; fixture not production image. |
| setup-infra `infra.js::{getSysConfigs,writeInfraConf,writeEcoSystem}`, `templates/index.js::write` | Host-wide mutation/PM2/credential generation → portable planning | **REPLACE** orchestration/write path; retain proven template fragments | readonly/corrupt secret regression, atomic render/no host writes. |
| setup-infra `existingCredential`, APP_HOST/DB_* support | Existing secret and endpoint preservation → adapter projection | **ADAPT**; preserve successful behavior, reject corrupt state | Secret refs/read-only snapshots; re-render/recreation/auth verification. |
| setup-infra `bin/install`, `bin/env`, `bin/prosody`, `jitsi.js` and Jitsi templates | Host services/conferencing → future optional/native capability | **DEFER**; not Docker/kernel prerequisites | Audit host side effects/secret replacement before any later reuse. |
| setup-infra `bin/create-local-certs`, `bin/init-acme`, SSL templates | Certificate generation/host trust → separate issuer + leaf layout | **ADAPT** layouts/SAN; **REPLACE** mutation lifecycle | Persistent CA/key, renewal failure, trust, Nginx reload tests. |
| setup-infra `templates/etc/bind/*`, `templates/var/lib/bind/*`, `bin/init-named` | TLS-driven host DNS → explicit local capability | **ADAPT** useful zones; **REPLACE** host control and broad defaults | Mode matrix, explicit LAN IP, named checks, journals/restarts, no implicit records. |
| setup-infra `templates/etc/mysql/mariadb.conf.d/*` | Native socket/datadir tuning → adapter DB config | **ADAPT** only proven settings | Official engine version/storage, TCP readiness, backup/restore. |
| setup-infra Postfix/OpenDKIM templates and `bin/init-mail` | Mailbox SQL/host mail → generic submission/relay/DKIM | **ADAPT** signing/TLS; **REPLACE** mailbox coupling/regeneration | Sink, relay restrictions, queue durability, selector/key preservation. |
| setup-schemas `bin/install`, `populate.js`, `lib/{schema,organization,drumate}.js` | Historical bootstrap/identity/Hub/MFS → none in infra | **DEFER** compatibility evidence; not a new kernel installer | Kernel owned schema/provisioning jobs only; no historical seed imports. |
| Debian `config/drumee.schema.json`, `config/render.mjs::applyDefaults/validate` | Distribution config → versioned infra spec validation | **ADAPT** concepts/tests; **REPLACE** secret generation and incomplete schema enforcement | Strict schemas/types/ports/DNS, duplicate YAML keys/injection, deterministic render. Historical .mjs remains external evidence; future library CommonJS. |
| Debian `renderCompose` / `deploy/docker/Caddyfile` | Source Team/Caddy topology → migration evidence | **REPLACE** gateway/payload, reuse suitable asset publication and internal DB/cache patterns | No parallel installer; compose contract tests, confirmed Caddy gaps. |
| Debian `renderComposeRoles`, `docker/Dockerfile.role-{web,dns,mail}` | Package role resources → Docker adapter capability services | **ADAPT** topology/foreground validation; exclude Team metapackage requirement | Scoped mounts/env, artifact sharing, port selection, persistence, non-root behavior. |
| Debian `bootstrap/usr/lib/drumee/entrypoint/infra` | Debconf/package render → revision activation job | **ADAPT** single writer/key existence guards; **REPLACE** package reconfigure dependency | Fresh/idempotent/reconfigure failure, secrets/certs stable. |
| Debian `entrypoint/{web,dns,mail}`, healthcheck scripts | Config checks/foreground daemons → readiness/diagnostics | **ADAPT** web/dns/mail; **KEEP** basic process checks as limited probes | Correct configured ports, readiness depth, DNS startup, DKIM and child death. |
| Debian `entrypoint/app`, PM2 ecosystem | Team process supervision → consumer execution | **REPLACE** for minimal composition host; no forced PM2 | Process drain/restart/exit and no in-app schema mutation. |
| Debian `entrypoint/schemas`, `schemas/init`, populate/factory scripts | Historical logical seeds → external minimal control-plane jobs | **REPLACE** distribution wiring, do not extract SQL ownership into infra | Manifest installation, platform invariants, Hub module migration floors. |
| Debian `bin/drumee-ctl` | Channel-aware status/doctor/backup/restore/upgrade → existing operator vocabulary | **ADAPT** command concepts; **REPLACE** incomplete backup/restore internals | Service-name independence, coherent backups, isolated restore, rollback gates. |
| Debian `release-manifest.yaml`, `scripts/check-versions.sh`, `docker/build-role.sh`, signed APT/base digest chain | Distribution build/version provenance → packaging evidence | **KEEP** applicable immutable/version checks; **ADAPT** consumer artifacts | No publication in IL-0; future image digest/build provenance checks. |
| Debian native `infra/debian/{config,postinst}`, native install scripts | Debian host installation → future adapter | **DEFER**; no IL-1 APT/debconf dependency | Disposable-root install only after Docker contracts stabilize. |
| Runtime/ui-runtime/system-mfs/Window Manager/Finder | Runtime semantic contracts → unchanged consumers | **KEEP**; infra satisfies requirements only | Current authorization, bundle and transfer regression suites. |

setup-infra and setup-schemas LICENSE files are AGPL v3; standalone runtime/capability manifests specify AGPL-3.0-only. Future extracted code must retain applicable copyright/license and provenance; this dossier does not approve relicensing.

Avoid duplication by assigning template/plan ownership to Infra Layer, image/package and distribution orchestration to Debian/distributions, and resource semantics to the kernel/modules. During later transition the distribution consumes one versioned renderer, or projections generated from it, instead of maintaining two drifting implementations. Infra extraction to `drumee/infra-layer` is IL-4, not a current public repository boundary.

## 14. Proposed public contracts

These TypeScript shapes are **documentation**, not runtime code or an approved frozen API. Production implementation remains CommonJS. Choose plain functions and records before classes; no general orchestration/plugin framework.

```ts
type DnsMode = "none" | "local" | "localhost";
type SecretRef = { resource: string; key: string }; // opaque reference, never value
type Endpoint = { host: string; port: number; transport: "tcp" | "tls" };
type VolumeRequirement = {
  id: string; purpose: "database" | "content" | "scratch" | "secrets" | "dns" | "mail";
  durability: "persistent" | "reconstructible" | "temporary";
};
interface KernelInfrastructureRequirements {
  contract_version: "1";
  http: { service_endpoint: Endpoint; page_endpoint?: Endpoint; push_endpoint?: Endpoint;
    public_artifact_roots: string[]; delegated_artifact_root?: string;
    internal_artifact_prefix?: string; max_binary_chunk_bytes?: number };
  database?: { required: boolean; engine: "mariadb"; compatible_versions: string[] };
  redis?: { required: boolean; authentication: "required" | "optional";
    durability: "reconstructible" | "persistent" };
  smtp?: { required: boolean };
  volumes: VolumeRequirement[];
}
interface InfrastructureSpec {
  spec_version: "1";
  instance: { id: string; domain?: string };
  dns: { mode: DnsMode; addresses?: { ipv4?: string[]; ipv6?: string[] };
    client_networks?: string[]; forwarders?: string[] };
  http?: { enabled: boolean; https: boolean; accepted_hosts?: string[] };
  tls?: { provider: "local" | "provided" | "acme"; certificate_ref: SecretRef;
    private_key_ref: SecretRef; issuer_state_ref?: SecretRef;
    account_email?: string; challenge?: "http-01" | "dns-01";
    challenge_credentials_ref?: SecretRef };
  database?: { managed: boolean; endpoint: Endpoint; credential_ref: SecretRef;
    admin_credential_ref?: SecretRef; version?: string };
  redis?: { managed: boolean; endpoint: Endpoint; credential_ref?: SecretRef;
    persistence: "none" | "snapshot" | "aof" };
  smtp?: { enabled: boolean; endpoint: Endpoint; transport: "plain" | "starttls" | "tls";
    credential_ref?: SecretRef; trust_ref?: SecretRef; delivery: "capture" | "relay";
    dkim?: { domain: string; selector: string; key_ref: SecretRef } };
}
interface DockerAdapterInput {
  project: string; // stable ownership namespace; must not collide with an existing project
  images: Record<string, { reference: string; digest: string }>;
  bindings: Record<string, { host_address: string; host_port: number; container_port: number }>;
  volumes: Record<string, { source: string; container_path: string; read_only: boolean }>;
  uid?: number; gid?: number; // adapter permissions, no hardcoded historical account
}
interface InfrastructurePlan {
  contract_version: "1"; revision: string; adapter: "docker-compose";
  effective_domain?: string; spec_digest: string; requirements_digest: string;
  artifacts: { path: string; digest: string; mode: number; redacted_preview: string }[];
  resources: { id: string; kind: string; persistent: boolean; owner: string }[];
  changes: { resource: string; action: string; risk: string; reason: string }[];
  conflicts: { resource: string; code: string; detail: string }[];
  prerequisites: { owner: "operator" | "kernel" | "application"; check: string }[];
  compatibility: { code: string; compatible: boolean; reason: string }[];
  applicable: boolean;
}
interface InfrastructureState {
  deployment: string; desired_revision: string; active_revision?: string;
  observed_at: string;
  capabilities: { name: string; required: boolean;
    readiness: "ready" | "starting" | "degraded" | "failed" | "disabled" | "unknown";
    dependencies: string[]; version?: string; diagnostic_codes: string[] }[];
  metadata: { adapter: string; project: string; resource_ids: string[] };
}
```

### 14.1 Why each field exists

Versions make incompatible contracts rejectable. Stable instance/project identifiers delimit owned resources; neither is a Drumee UID/Hub ID. Domain is input while effective domain is derived solely by section 7. DNS address/client-network/forwarder fields distinguish LAN answers, permitted clients and optional recursive use. HTTP enable/HTTPS/accepted-host fields express exposure and Host validation; concrete bind ports/interfaces belong to the adapter.

Requirement endpoints and artifact roots describe what the composed kernel host actually exposes; their concrete container paths are deployment projections, not hardcoded kernel defaults. Endpoint protocol/port makes separate containers and TLS connections explicit. Delegated prefix and chunk limit tie gateway behavior to FileIo/upload producers. Compatible DB versions and Redis auth/durability prevent an adapter claiming unsupported satisfaction. Volumes name infrastructure resources by purpose/durability, never by users or Hubs.

Managed distinguishes supplied external engines from adapter-created engines; not a DNS mode. Credential refs prevent secrets in plan/state/previews. Admin DB refs are confined to infrastructure/account or external authorized jobs. TLS provider, leaf refs and issuer state keep issuance separate from serving; ACME-only email/challenge inputs are rejected for local provider. SMTP transport/trust/delivery distinguish safe capture and real relay; DKIM is optional signing configuration, not application marketing policy.

Docker image digests, resource bindings and UID/GID are adapter facts. Revision/digests bind a plan to exact inputs and outputs. Artifacts enable review without execution; risk/conflicts/compatibility/prerequisites explain why a plan may be inapplicable. State includes active-versus-desired revision, observations, actual versions, dependency readiness and diagnostic codes, without passwords, cookies, OTAKs, customer paths or business readiness claims.

### 14.2 Minimal method surface

| Proposed function | Purpose / side effects |
|---|---|
| `validateSpec(spec, requirements)` | Return all field and cross-capability diagnostics plus normalized DNS resolution; pure. Necessary for invalid input rejection. |
| `planInfrastructure(spec, requirements, adapter_input, observation)` | Produce validated resources/artifacts/change/risk plan from supplied read-only observations; pure. No host writes, secret generation, DB connections that mutate, Docker creation or certificate issuance. |
| `renderPlan(plan, output_directory)` | Write already planned files only to explicit isolated output; atomic output/no activation; refuse path escape and inappropriate secret content. Needed for inspection and native-tool validation. |
| `inspectInfrastructure(deployment, adapter)` | Read-only service/version/resource observations; no “repair” or starts. State readiness is infrastructure only. |
| `diagnoseInfrastructure(state, requirements)` | Interpret checks, missing prerequisites and recovery guidance without applying it. Useful separately from status. |
| `applyPlan(plan, execution_context)` | **Later IL-3 operational interface**: execute only validated applicable owned-resource changes, with revision/conflict recheck and journal. No automatic SQL/provisioning or destructive teardown. Not implemented/authorized in IL-0. |

No public `authorizeMfs`, `createUser`, `createHub`, `installApplicationSchema`, `runCampaign`, universal service locator or plugin solver. Backup/restore/renewal may initially remain concrete operator jobs with plan/state records instead of expanding a generic API prematurely. Dedicated certificate issue/renew hooks belong to TLS capability implementations; Nginx validates/reloads, DB/Redis expose readiness, DNS validates zones and mail reports submission/queue state. Expose additional provider methods only once real adapters prove need.

The future native adapter satisfies the same requirements/spec/state but renders Debian config and invokes native service/package operations during explicit execution. It cannot change DNS/TLS semantics, write runtime policy, or force Docker-specific fields into InfrastructureSpec. Do not implement a native adapter before the Compose contract stabilizes.

## 15. Proposed module and dependency boundaries

```text
kernel / module infrastructure requirements + operator InfrastructureSpec
                         |
                  pure validation / plan
                         |
             capability config + adapter resources
                         |
                  Docker Compose execution
                         |
         Nginx / TLS / MariaDB / Redis / DNS / SMTP
```

Infrastructure execution consumes already built CommonJS/Webpack artifacts. Kernel emits protocol requirements and remains authoritative for authorization and provisioning. Applications own services/UI/migrations/state. Distribution owns application selection, executable composition host, external schema/bootstrap job wiring and acceptance. Infra Layer does not need an ACL descriptor or a runtime-loaded Drumee Worker just because it is stored under `target/modules/`.

Proposed future layout, **not created during IL-0**:

```text
target/modules/infra-layer/
  README.md  package.json  PROVENANCE.md
  lib/{spec,plan,state,validation}/
  capabilities/{http/nginx,tls,database,redis,mail,dns}/
  adapters/docker/
  tests/{unit,integration,e2e}/
```

Add `adapters/debian/` only when work starts on a real second adapter. One package, CommonJS, no classes or public subpackages unless proven. JSON schemas may be resources; TypeScript interfaces remain specification or generated documentation. Runtime libraries must not depend on this package. Shared ui-build and intrinsic RuntimeEnv/build metadata ownership are unchanged. No new framework, schema registry, StyleRegistry or ESM migration.

## 16. Implementation roadmap and completion gates

Recommended order refines the provisional sequence: IL-1 establishes pure planning/Nginx with existing isolated fixture services; IL-2 supplies secure persistent services/certificate/DNS state; IL-3 completes composed lifecycle and D0; IL-4 freezes/extracts. Docker **rendering and contract validation** begin in IL-1, while deployment execution/lifecycle is IL-3. Mail can proceed independently and must not hold the minimal kernel vertical slice.

| Phase | Scope / deliverables | Dependencies and repository impact | Tests / completion criteria | Non-goals / risks |
|---|---|---|---|---|
| **IL-1 Foundation and Nginx** | Versioned spec/plan/state records, strict validation, redacted deterministic renderer, route inventory implemented as explicit config; internal artifacts and streaming uploads; Docker gateway config projection | Architecture approval; existing runtime/FileIo/transfer requirements. New code only in transient target module/tests/docs; consume pinned evidence with provenance. | DNS resolution matrix unit tests even before BIND; nginx -t and Compose config in disposable context; H1–H16 against real kernel dispatch/auth. Gate on protected file denial, ZIP/original bytes, chunk retries/limits/cancellation and characterized Range. Pure plan has no side effects. | No service provisioning, real acceptance deployment, schema ownership, Team compatibility or full Docker lifecycle. Risk: gateway reconfiguration can mask authorization/caching changes. |
| **IL-2 Infrastructure services** | Persistent secret contract; local/provided/ACME certificate providers and renewal; MariaDB/Redis readiness/auth; local DNS daemon resources and mode gating; SMTP capture/relay/DKIM | IL-1 spec contracts. Use suitable Debian role/config patterns; changes remain transient; no upstream fixes silently applied. | Fresh/repeated render/recreate preserves all keys; corrupt state fails; named checks and resolution; database/Redis auth, certificate renewal/reload failure; SMTP sink/signing/relay tests. Required kernel capabilities can run without SMTP. | No kernel/application SQL, user/Hub creation, live infrastructure edits or commercial mail. Risks: Redis client compatibility, certificate ownership, dynamic DNS journal permissions. |
| **IL-3 Docker integration** | Canonical adapter execution; scoped networks/mounts, health/dependency ordering, stable resource namespace/digests, consumer-owned schema jobs; fresh install, upgrades, coherent backup/isolated restore; D0 readiness | IL-1/required IL-2 capabilities; supplied minimal composition host and approved control-plane/application jobs. Changes in transient distribution wiring as explicitly approved; existing Debian interfaces reused/adapted, no second installer. | Fresh install → authenticated LETC/MFS/push; repeated startup/container recreation; upgrade preserves identities/content/keys; restore verified before upgrade acceptance; observe failures and rollback compatibility. D0 adds LAN resolution/trust/browser proof. | No native deployment or IL-4 publication. Testbox execution requires separate deployment authorization and conflict resolution. Risks: active uploads lost on restart, multi-process transfer state, snapshot consistency. |
| **IL-4 Stabilization/extraction** | Contract review/freeze, regression matrix, operational docs/provenance, standalone infra-layer repository extraction and publication preparation | IL-3 stabilized consumers and reviewed contract. Explicit extraction/release approval; preserved history like earlier capabilities. | Installed/packed artifact self-contained; pinned-image and schema boundary regression; at least kernel and distribution consumers; docs reproducible from empty isolated state. | No automatic publication or blanket refactor of setup-infra/debian; native adapter optional later. Risks: duplicated renderer ownership during migration and premature public API freeze. |

**Smallest vertical slice:** one Nginx, one composed minimal backend, built LETC/Finder artifacts, MariaDB, Redis, externally supplied minimal schema/bootstrap/Hub jobs, persistent content and bounded scratch. Validate over loopback with own/local certificate; reuse synthetic hello as existing proof if useful, do not invent another application. Then add local BIND + `drumee.lan` trusted HTTPS for D0. Derived-media converter, SMTP and public ACME are not required for the first MFS original/chunk/ZIP slice unless the consumer declares them required. No Oxymotion-specific name, table or service appears in public contracts.

## 17. Validation specification before implementation

| Suite / location | Required cases and assertions | Execution boundary / gate |
|---|---|---|
| Spec/render unit | Exact three DNS modes; all domain table rows; default drumee.lan; unknown mode rejected; missing hostname fails required capability; strict types/ports/duplicates/unknown keys; safe escaping; equal inputs/supplied state → byte-identical artifacts; redacted errors/previews | Pure local; no Docker daemon, host writes or random secret generation. IL-1. |
| Secret/lifecycle unit | Existing readable secret stable; corrupted/missing existing key fails; first-install missing state yields explicit creation action; upgrade never rotates CA/DKIM/TSIG/DB creds; revision/change classification; no accidental volume removal | Isolated directories only. IL-1/2. |
| Native config syntax | Nginx combined includes/root/alias syntax; missing cert fails; named-checkconf and every named-checkzone; docker compose config -q | Disposable render tree/container, unique project, no production services. Configuration pass does not count as protocol acceptance. |
| HTTP/kernel | H1–H16; signin and session headers/x-param; dynamic plugin chunks/assets/CSS; public/private services and correct errors; page boot READY; WebSocket OTAK/Origin/subprotocol/reconnect; private no-store | Real kernel registry/dispatcher/authorizers, not direct route mocks. Separate SQL fixtures from public-api smoke. |
| Transfer integration | Original/ZIP integrity; 8/16 MiB configured geometry and huge file made from bounded chunks; duplicate/out-of-order/failed/retry chunks; invalid metadata/hash; cancellation before/during reception; HTTP chunked encoding/backpressure; direct multipart rejected/documented; timeout/resource ceiling; real Range 206/416 and If-Range/HEAD | Isolated DB/content/temp resources, real Nginx. Existing tests [T1][T2] extended only when implementation phase authorized. |
| MFS security | Anonymous/OTP/unauthorized read denied; user/hub/destination isolation; revocation between prepare/retrieve or upload/commit; all internal URLs externally denied; traversal/double encoding/symlink escapes; no protected static root or leaked physical path | Adversarial local fixtures, never customer data. Kernel is sole ACL authority. |
| Gateway trust | Invalid Host/default vhost, forged X-Real-IP/X-Connecting-IP/X-Forwarded-*; correct trusted chain; rejected Origin/missing OTAK; no query/session/token secret logging; root/credential/config URL denial | Local isolated gateway/upstream; record headers seen by consumer and actual browser behavior. |
| DNS | none/localhost emit no service/zone/key action; local default and explicit domain A/AAAA; no bridge address records; TCP+UDP53, explicit LAN bind; occupied port diagnostic; zone/key persistence; restart; malformed zone/config and serial behavior; recursive/cache restrictions | Local network namespace or temporary high ports first; LAN client test later. No resolver/DHCP modification by harness. |
| TLS | local trust-root/key fingerprints stable across render/recreate/upgrade; SAN/key/expiry validation; leaf renewal preserves CA; invalid provided cert rejected; failed issuer keeps active valid revision; Nginx controlled reload; ACME staging only for public hostname | Temporary local issuer state; never existing CA/keys or real `.lan` public issuance. |
| DB/Redis | Initial engine readiness distinct from missing schemas; internal endpoint/auth; unauthorized DB connection; network resolution/recreate; Redis reconnect and no durable push assumption; application readiness degradation surfaced | Disposable engines; no production schemas altered. |
| SMTP | Capture sink receipt only, STARTTLS/auth, prohibited relay, DKIM verification/selector alignment; persistent queue retries/recreation; credential masking; no unexpected outside egress | Egress-restricted local mail network. No campaign or commercial delivery. |
| Upgrade/recovery | Stable named volumes and ids; repeated startup; process drain/SIGTERM; active transfer restart limitation; incremental compatible upgrade; DB + content + secrets/certs/DNS/mail backup inventory/checksums; isolated restoration; schema floor and rollback compatibility | New disposable project only; destructive tests restricted to its owned resources. Never run against shared infrastructure. |
| D0 browser acceptance | LAN DNS → trusted https://drumee.lan → authenticated kernel → MFS original/chunk/ZIP → Oxymotion Phase 2 flow; two clients/Hubs, push reconnection, safe upgrade | Later explicitly authorized testbox deployment and LAN clients. Requires port conflict resolution and trust installation. |

Existing Phase 4.8 Nginx integration uses fixture dispatch/file data; Phase 4.9 browser integration validates real Hub/shard/session paths but includes a test HTTP file transport. Do not combine their claims into proof that authenticated real-Hub file delivery behind the new gateway is already tested. IL-1 must join those boundaries.

## 18. Oxymotion D0 prerequisites and testbox observations

Mandatory acceptance input remains exactly:

```yaml
instance:
  domain: drumee.lan
dns:
  mode: local
```

Effective domain `drumee.lan`, containerized BIND9, LAN A record to testbox, Nginx HTTPS gateway, persistent MariaDB/Redis-required runtime, MFS content and approved Oxymotion Phase 2 artifacts. Add local TLS provider and explicit LAN listener/address fields as the reviewed schema evolves. No public delegation or public ACME. Clients must explicitly use a conditional/appropriate resolver and trust the local CA.

Read-only SSH (`ssh -o BatchMode=yes -o ConnectTimeout=10 testbox`) returned hostname `minis`, Debian 13/trixie 13.6, kernel `6.12.100+deb13-amd64`, Docker `29.7.2`, Compose `v5.4.0`, LAN interface `wlp2s0` at **192.168.5.202/24**, and only a link-local IPv6 on that interface. These are observations, not fixed public API defaults. Future planning must re-observe DHCP address/ports; do not publish the link-local IPv6 as AAAA.

Observed containers: `drumee-web-1` and `drumee-app-1` (`drumee/role-web:1.0.57`, `drumee/role-app:1.0.57`), `drumee-cache-1` (`redis:7`) and `drumee-db-1` (`mariadb:11.8`, healthy). Web publishes 80/443 on all IPv4/IPv6 interfaces; database/cache have no published ports in the observed summary. DNS53 is already listening on LAN, loopback and bridge addresses; process ownership was not inspected, so do not assert it belongs to a particular container. Root filesystem was 17 GiB total, 10 GiB available; content/database mount capacity was not audited.

D0 remains blocked on a **future authorized resource transition**, not on inability to finish IL-0. Do not stop/reconfigure the existing DNS/web stack, reuse its volumes, assume its Team identities are minimal-kernel compatible, or install packages. Determine with the owner whether a separate acceptance address/machine or scheduled replacement is appropriate after architecture approval.

Minimum unblocking gates: IL-1 protected gateway/transfer contracts; required IL-2 persistent secrets, local certificate, local DNS, MariaDB/Redis connectivity/readiness; IL-3 composition with kernel-owned schema/bootstrap/module jobs, durable MFS, verified recovery and port-safe execution. Optional SMTP/converter/public ACME/native packages need not delay D0 unless Phase 2 actually declares them required. Application-specific readiness/version compatibility must come from its owner; IL-0 does not invent deployment behavior or start Phase 3.

## 19. Architectural decisions and open questions

**Established by the request:** Nginx reference gateway; Compose initial adapter; exactly three DNS modes; local default `drumee.lan`; kernel authority over ACL/provisioning/MFS; generic Oxymotion-independent API; no IL-0 implementation/deployment/publication.

**Recommended for architecture approval:** pure planning separated from execution; one config owner; opaque persistent secret refs; scoped gateway artifact view; single initial transfer process; local CA/leaf separation; bridge-based LAN DNS publication; restricted authoritative DNS by default; existing Debian lifecycle vocabulary with corrected recovery semantics; one CommonJS package extracted only after stabilization.

| Decision requiring review or later evidence | Recommended resolution / acceptance effect |
|---|---|
| Minimal deployment composition host owner | Distribution/control plane supplies executable server host and schema/bootstrap jobs; Infra Layer stays application-neutral. Existing runtime library is not a complete production entrypoint. |
| testbox existing port/resource ownership | Owner approves transition or a separate address/environment. No implicit takeover of 53/80/443 or historical data. |
| LAN resolver integration | Prefer conditional zone forwarding; enumerate intended clients and trust procedures. Restricted forwarding required only for sole-resolver use. |
| Local CA custody and rotation | Instance-scoped persistent issuer state, gateway leaf-only access; operator stores CA backup and distributes fingerprinted public trust anchor. Rotation explicit. |
| REST scale / restart-resumable transfers | Start one transfer instance and document restart loss. Shared durable jobs or affinity redesign is separate kernel work, never an infra ACL/state imitation. |
| Minimal DB privilege profile | Characterize runtime SQL calls and separate Hub lifecycle/migration authority before reducing grants. Infra supports accounts, does not decide schema business privileges. |
| Redis authentication bridge | Prove credential-bearing redisUrl or compatible injected provider against all required clients; never mark redisAuth-only as working. |
| Artifact/current-version storage | Mount exact content/representation/staging view; current LocalContentStore maps hub/nid. Document-version retention semantics need owner confirmation; Infra preserves all declared durable files without inventing version logic. |
| Debian reuse boundary | Reuse/adapt proven topology/config fragments while avoiding dependency on Team release-role packages. Select image composition/provenance at IL-3; do not start a rival installer. |
| ACME provider implementation | Local TLS sufficient for D0. Choose narrow acme.sh or other provider only after staging renewal/reload characterization; do not generalize cloud orchestration. |
| Backup consistency and migration rollback | Kernel/application defines quiescence and schema compatibility; adapter mechanics validated by isolated restore before upgrade support is claimed. |
| Derived media worker and SMTP necessity | Consumer declares actual required capabilities; no implied converter, mailbox SQL or mail server prerequisite. |

## 20. IL-0 validation and completion record

Executed read-only Git inventory/status/log/show/ls-tree and `git ls-remote` for all requested repositories, plus controlled `git archive` into temporary snapshots. GitHub DNS lookup inside a batched sandboxed subprocess failed; direct approved ls-remote subsequently succeeded. No branches switched, no upstream repository written, no fetch/push/publication performed.

Executed safe validations:

| Command / probe | Result / limitation |
|---|---|
| `bash tests/smoke-config.sh` in temporary Debian committed snapshot | **21 passed, 0 failed**. Historical config contract only. |
| `bash tests/config-parity.sh` in that snapshot | **13 passed, 0 failed**. One-writer/projection and converter isolation assertions; not daemon deployment evidence. |
| `node --test target/modules/host-filesystem/test/host-filesystem.test.js target/modules/mfs-transfer/test/transfer.test.js target/foundation/server-runtime/test/binary-upload.test.js` | **14 passed, 0 failed**; temp HTTP/filesystem/archive fixtures only. |
| `node --test target/foundation/server-runtime/test/auth-domain.test.js target/foundation/server-runtime/test/hub-authorization.test.js target/foundation/server-runtime/test/mfs-authorization.test.js target/foundation/server-runtime/test/websocket-push.test.js` | **31 passed, 0 failed**; authorization/session/socket doubles and contract checks, not live DB/Redis. |
| Two `config/render.mjs all` runs for each `images.stack=source/roles` with null password defaults | Both DB/root secrets changed on repeated render; confirmed SEC-02. Generated secret values were not printed. |
| `docker compose -f <temporary output>/docker-compose.yml --env-file <temporary output>/.env config -q` for both stacks | Both passed, exit 0; no daemon services created or deployed. |
| `config/render.mjs validate` with added `dns.mode=local` for each stack | Both rejected `unknown section "dns"`; documents canonical DNS contract gap. |
| Full Template module readonly probe | Not executed successfully: missing `@assetval/ip` dependency. No dependency installation or host renderer execution. |
| Isolated VM evaluation of actual `templates/index.js::write` source with readonly and a temp target | File truncated to 0 bytes. Only chroot/mkdir collaborators isolated; readonly branch reached before template rendering. Confirms helper defect, not full-installer execution. |
| Authorized SSH `hostname`, OS/kernel, `ip -brief address`, `ss -lntu`, Docker/Compose versions, formatted docker ps and root df | Read-only observations in section 18. Sandbox initially blocked SSH; approved retry succeeded. No remote temporary resources or persistent changes. |

Total existing assertions/tests executed: **79 passed, 0 failed** (34 renderer assertions + 45 kernel/transfer tests), plus the separate behavioral probes and two Compose syntax checks. Nginx/named binaries were not available locally; full Nginx, DB, Redis, DNS, SMTP, certificate renewal, image builds, live browser and acceptance suites were **not** executed. They require disposable service setup or later approved deployment and are specified in section 17. Existing infrastructure did not need to be started/stopped to finish the audit.

Final documentation checks include whitespace/link/required-section review and source immutability (`git diff -- sources/` empty). Only this dossier belongs to the IL-0 commit; pre-existing documentation edits are excluded. The resulting transient commit is supplied in the completion report, rather than embedded as a self-referential SHA. No Infra Layer code/package/directory, kernel change, upstream change, Oxymotion change, package/image publication or deployment was created.

## 21. Source evidence index

Transient references below resolve to audited files in this repository. Standalone references pin inspected commits. Debian feature-branch references deliberately differ from the older `sources/debian` baseline; reproduce them with `git show 8a236e5d147a55cfd5580dcda0712cd6436ca93c:<path>`. Supplemental unpublished local SHA facts are marked in section 2, not presented as current remote main.

| Label | Precise source / symbols |
|---|---|
| I1 | setup-infra `infra.js`: getSysConfigs (371), writeCredentials (547), existingCredential (573), writeInfraConf (662), writeEcoSystem (209), main (880). |
| I2 | setup-infra `templates/index.js`: chroot (14), render (47), write (77), writeMultiple (109). |
| I3 | setup-infra `bin/install`: init-mail (13), chroot args (41), rendered-host early return, DNS/TLS dispatch. |
| I4 | setup-infra `bin/create-local-certs`: write_cnf, self_sign (65), new key (80), host trust update (141). |
| I5 | setup-infra `templates/etc/drumee/infrastructure/routes/app.conf.tpl`: static prefixes (39–73), service (80), websocket (97), file/doc/letc/avatar (115–160), index (164). |
| I6 | setup-infra `templates/etc/drumee/infrastructure/internals/accel.private.conf.tpl`: internal mfs/accel and public assets. Public variant has same delivery mechanism. |
| I7 | setup-infra `templates/etc/bind/named.conf.options`, `named.conf.local`, `templates/var/lib/bind/private.tpl`, `templates/utils.js::getAddresses`, `bin/init-named`. |
| I8 | setup-infra `bin/init-acme::make_certs`, `templates/etc/drumee/ssl/{private,public}.conf.tpl`. |
| I9 | setup-infra `templates/etc/mysql/mariadb.conf.d/50-server.cnf`, `templates/etc/nginx/nginx.conf`, site `02-private.conf.tpl`. |
| I10 | setup-infra `templates/etc/postfix/{main.cf,mysql-virtual-mailbox-maps.cf}`, `configs/etc/postfix/master.cf`, `templates/etc/opendkim/KeyTable`, `bin/init-mail`. |
| S1 | setup-schemas `bin/install`; `populate.js::{start,stockFactory,afterInstall}`; no minimal bootstrap authority. |
| S2 | setup-schemas `lib/{organization,drumate,schema,utils}.js`: identity/Hub provisioning, create_vfs_root and dbCli/global grants. |
| D1 | Debian feature revision `config/render.mjs`: validate (160), fillSecrets (229), renderCaddyfile (443), renderCompose (498), renderComposeRoles (755), withSecrets (1109); `config/drumee.schema.json`. |
| D2 | Same revision `bin/drumee-ctl`: cmd_backup (101), cmd_restore (126), cmd_upgrade (144), cmd_rollback (159). |
| D3 | Same revision `bootstrap/usr/lib/drumee/entrypoint/infra`: existing-config guard, key generation, dpkg-reconfigure, cert generation and scoped credential writer. |
| D4 | Same revision `deploy/docker/{Caddyfile,infra-init-entrypoint.sh,Dockerfile.server,entrypoint.sh}`; source topology in D1. |
| D5 | Same revision `bootstrap/usr/lib/drumee/entrypoint/{lib.sh,app,web,dns,mail}`, `docker/Dockerfile.role-*`, healthcheck scripts; roles topology in D1. |
| D6 | Same revision `bootstrap/usr/lib/drumee/schemas/init`, `entrypoint/schemas`, `infra/debian/postinst`, `release-manifest.yaml`, `scripts/check-versions.sh`, `docker/build-role.sh`. |
| K1 | server-runtime `lib/{http,input,output,session,dispatcher,hub-authorizer,permission,yellow-page-store}.js`; `acl/{bootstrap,yp}.json`. |
| K2 | transient `target/modules/host-filesystem/lib/{host-filesystem,file-io}.js`, media-service ACL/worker; FileIo::headers/send. |
| K3 | transient `target/modules/mfs-transfer/lib/{service,staging,archive-worker}.js`, `server/{acl,service}/mfs-transfer.*`, `offline/archive-process.js`. |
| K4 | transient `target/control-plane/bootstrap/lib/{index,store}.js`, Hub lifecycle `lib/{index,store,manifest}.js`; system-mfs `lib/{store,filesystem,content-store}.js` and manifest. |
| K5 | server-runtime `lib/{websocket-router,push-bus}.js`: originAllowed/sameRequestOrigin/createConnection/start/stop, PushBus.publish. |
| E1 | pinned server-essentials `lib/{redis-store,mariadb}.js`, generic RedisStore.init and current database helpers. |
| U1 | ui-runtime `src/{bootstrap,kind,loader,service,websocket}.js`; window-manager package exports/lib/browser and skin. |
| F1 | Finder `lib/{mfs-client,mfs-transfer-client,media-client,upload-controller,download-controller,mfs-sync,access-policy}.js`. |
| T1 | transient `scripts/test-env/kernel/container/{entrypoint,render-config}.sh`, `service.js`, `tests/integration/kernel/phase4.8-nginx-delivery.test.js`. |
| T2 | transient `tests/integration/kernel/phase4.9-finder-live-browser.test.js`, unit tests listed in section 20; live tests inspected, not rerun. |

[I1]: ../../sources/setup-infra/infra.js
[I2]: ../../sources/setup-infra/templates/index.js
[I3]: ../../sources/setup-infra/bin/install
[I4]: ../../sources/setup-infra/bin/create-local-certs
[I5]: ../../sources/setup-infra/templates/etc/drumee/infrastructure/routes/app.conf.tpl
[I6]: ../../sources/setup-infra/templates/etc/drumee/infrastructure/internals/accel.private.conf.tpl
[I7]: ../../sources/setup-infra/templates/etc/bind/named.conf.options
[I8]: ../../sources/setup-infra/bin/init-acme
[I9]: ../../sources/setup-infra/templates/etc/mysql/mariadb.conf.d/50-server.cnf
[I10]: ../../sources/setup-infra/templates/etc/postfix/main.cf
[S1]: ../../sources/setup-schemas/populate.js
[S2]: ../../sources/setup-schemas/lib/schema.js
[D1]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/config/render.mjs
[D2]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/bin/drumee-ctl
[D3]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/bootstrap/usr/lib/drumee/entrypoint/infra
[D4]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/deploy/docker/Caddyfile
[D5]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/bootstrap/usr/lib/drumee/entrypoint/dns
[D6]: https://github.com/drumee/debian/blob/8a236e5d147a55cfd5580dcda0712cd6436ca93c/bootstrap/usr/lib/drumee/schemas/init
[K1]: https://github.com/drumee/server-runtime/blob/fc7d9de3f3e63baea8258885e55efe8e242904d0/lib/http.js
[K2]: ../../target/modules/host-filesystem/lib/file-io.js
[K3]: ../../target/modules/mfs-transfer/lib/service.js
[K4]: ../../target/control-plane/hub-lifecycle/lib/store.js
[K5]: https://github.com/drumee/server-runtime/blob/fc7d9de3f3e63baea8258885e55efe8e242904d0/lib/websocket-router.js
[E1]: ../../sources/server-essentials/lib/redis-store.js
[U1]: https://github.com/drumee/ui-runtime/blob/5366d904356b414e87848a0bc8870b612e6c748a/src/service.js
[F1]: https://github.com/drumee/finder/blob/b46e2c94b615a1993b6162716d9e8965d0029564/lib/mfs-transfer-client.js
[T1]: ../../tests/integration/kernel/phase4.8-nginx-delivery.test.js
[T2]: ../../tests/integration/kernel/phase4.9-finder-live-browser.test.js
