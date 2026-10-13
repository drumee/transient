# Drumee Infra Layer — IL-1

CommonJS alpha capability extracted from transient. Produces a validated Nginx
gateway plan and a **gateway-only** Docker Compose fragment for a distribution
such as drumee/debian. No complete installer, apply/deploy operation, kernel
policy, schema bootstrap, secret generation, DNS daemon or certificate issuer.

The kernel composition host declares its requirements; this module satisfies
the HTTP/configuration side. Kernel packages do not import Infra Layer.

## Public API

```js
const {
  validateSpec, planInfrastructure, renderPlan,
  inspectInfrastructure, diagnoseInfrastructure
} = require("./lib");

const validation = validateSpec(spec, requirements);
const plan = planInfrastructure(spec, requirements, adapter_input, {
  ports: [{ address: "127.0.0.1", port: 8080, protocol: "tcp" }]
});
if (!plan.applicable) {
  // Machine-readable diagnostics/conflicts contain field names and codes only.
  throw new Error("INFRA_PLAN_NOT_APPLICABLE");
}
renderPlan(plan, "/tmp/operator-owned-render"); // render only; no activation

const docker = require("./adapters/docker/nginx");
const state = await inspectInfrastructure({
  id: "instance-gateway", desired_revision: plan.revision,
  container_id: "<full-64-character-Docker-id>", plan
}, docker);
const diagnostics = diagnoseInfrastructure(state, requirements);
```

The sample observation marks port 8080 occupied; use actual supplied observations
for the selected environment. `plan.applicable` means this gateway projection can
be rendered; it is not a claim that missing DNS/TLS/kernel prerequisites exist.

`validateSpec` and `planInfrastructure` are pure: no filesystem, process, network,
time, random, sysEnv or secret-store access. JSON-compatible plain objects only;
accessors/cycles/unknown properties are rejected. No implicit hostname or port
fallback. The versioned field contract is also documented in [index.d.ts](index.d.ts).

## Configuration schema implemented

Unknown fields are errors. Values below are explicit inputs, not Team defaults.

| Object | Required fields | Constraints |
|---|---|---|
| InfrastructureSpec | `contract_version: "1"`, `instance`, `dns`, `http` | Identifier and lower-case DNS hostname syntax. `instance.domain` optional only when resulting hostname is not required. |
| `spec.instance` | `id`; optional `domain` | Infrastructure resource identity, not a UID/Hub. |
| `spec.dns` | `mode` | Exactly `none`, `local`, `localhost`. |
| `spec.http` | `enabled`, `https`; optional `accepted_hosts` | Explicit booleans; finite hostname allowlist. localhost mode accepts only localhost as effective/accepted hostname. |
| `spec.tls` | When HTTPS: `provider: "provided"`, `certificate_ref`, `private_key_ref` | Opaque `{resource,key}` refs only. No certificate/key contents or issuance; local/ACME providers remain IL-2. |
| KernelInfrastructureRequirements | `contract_version: "1"`, `http` | The actual composition host's listener and file-delegation contract. |
| `requirements.http` | `service_endpoint`, `page_endpoint`, `websocket_endpoint`, `public_assets`, `delegated_artifact_root`, `internal_artifact_prefix`, `max_binary_chunk_bytes`, `readiness_path`, `bootstrap_paths` | Endpoints `{host,port,transport:"tcp"}`; no URL/userinfo/config snippets. Chunk ceiling positive, at most 64 MiB; composition must declare its runtime's actual ceiling. |
| Public assets | `{id,url_prefix,root}` | Allowed prefixes `/-/app/`, `/-/api/`, `/-/plugins/`, `/-/static/`, `/-/images/`, `/-/fonts/`; only declare consumed views. Roots are scoped absolute paths, disjoint from protected storage. |
| Docker input | `kind: "docker-nginx"`, `project`, `network`, `image`, `listen_port`, `health_port`, `bindings`, `artifact_view`, `public_views`, `tmpfs_bytes`, `timeouts` | Immutable image `@sha256`; nonprivileged container ports >=1024; finite host IP/port bindings. All bindings use one external port authority; IPv4/IPv6 bindings may share it. Different external ports are explicitly unsupported in IL-1. |
| Protected view | `{source,target,kernel_target}` | Host source and gateway target are scoped absolute paths; kernel_target must equal declared delegated_artifact_root. Read-only in gateway. |
| Public views | `{id,source,target}` | Exactly one per asset declaration, no destination collisions, protected overlap or executable/config/temp-state mount. |
| TLS views | `{ref,source,target}` for both refs | File references, read-only, disjoint from public/protected views. Operator/distribution supplies readable matching certificate/key. |
| Timeouts | `client_body_seconds`, `upstream_seconds`, `websocket_seconds`, `send_seconds` | Explicit positive integer seconds, at most 86400. |
| Planning observation | optional `ports: [{address,port,protocol}]` | Only read-only TCP/UDP occupancy data; no credentials, global environment or raw inspection output. |

Paths use scoped absolute ASCII components, no dot segments, double separators,
trailing separators, whitespace, config interpolation or broad `/data`/system
roots. Artifact roots and URL prefixes are separate types: prefixes end in `/`.
Mount scope remains a distribution responsibility; never designate credentials,
server code, customer metadata or a whole host data partition as public assets.
Endpoints must resolve/reach the kernel on the declared Docker network;
`localhost` inside Nginx is the gateway container, not the Docker host.

### DNS resolution

| Mode | Supplied domain | Effective domain | IL-1 BIND behavior |
|---|---|---|---|
| none | example.com | example.com | No service or zone |
| none | absent | undefined | No service; enabled hostname-dependent gateway rejected |
| local | example.com | example.com | Future local DNS prerequisite recorded, no service started |
| local | absent | drumee.lan | Same prerequisite; official local default |
| localhost | any valid supplied domain | localhost | No service; supplied name does not affect revision; host publication must be loopback |
| localhost | absent | localhost | Same behavior |

No DNS mode is inferred from TLS. BIND and LAN resolution remain IL-2/IL-3.

### Plans, revisions and rendering

Plans contain normalized explicit inputs, resource descriptors, generated
artifact content/digests, diagnostics, conflicts, compatibility constraints and
prerequisites. They never contain credential values. Revisions hash normalized
inputs **and** Nginx/Docker configuration before stamping the resulting revision
label. Ordering is lexical and independent of locale. Mutable port observations
affect applicability, not the configuration revision.

`renderPlan` re-generates/compares artifacts before writing. Destinations must be
inside the explicitly supplied caller-owned render directory with trusted,
non-writable-by-others parents; sticky root-owned `/tmp` is allowed. Symlinks,
hardlinked files, unowned files, edited generated files, forged artifacts and
cross-instance/project overwrite are refused. Existing unrelated files are
preserved. All bytes are staged/fsynced before per-file rename; ordinary rename
failure rolls back earlier owned-file changes. Render ownership is recorded in
`.infra-layer-render.json`, written last. This is not a crash-atomic deployment
transaction; use an exclusively owned output
directory, then validate a complete revision before later activation.

The atomic directory lock `.infra-layer-render.lock` rejects competing writers
with `RENDER_LOCKED`. It covers manifest reading, staging, destination rechecks,
replacement and rollback. There is no automatic stale-lock takeover based on
PID or time: after a crash, the operator must verify ownership/process exit and
inspect the complete directory before recovery. A partial crash can leave mixed
files; removing a stale lock alone cannot authorize edited/mismatched artifacts.
Recovery/activation remains IL-3. Locks are released on ordinary success/error.

Generated artifacts:

- `nginx.conf`: complete gateway config, no wildcard includes or broad root.
- `gateway.compose.json`: one gateway service + externally supplied network.
- `.infra-layer-render.json`: ownership/revision/digest manifest, no activation.

Rendering performs no `nginx -t` or Docker execution implicitly. It verifies
generated content; the explicit integration/distribution validation runs native
syntax checks against mounted resources. There is no `applyPlan`.

## Gateway contracts

| Routes | Delivery |
|---|---|
| `/-/svc/module.method`, `/-/service/module.method` | Kernel native service endpoint; authentication/bootstrap/media/MFS remain dispatched by the kernel. |
| Exact `/-/{svc,service}/mfs-transfer.upload_chunk` | Binary body limit equals declared runtime ceiling on both aliases; HTTP/1.1, request buffering off, no automatic upstream retry. |
| Actual `/-/vdo/<nid>[/<hub>]/...` HLS forms | Kernel media endpoint, not a public static HLS shortcut. |
| `/`, `/-/`, declared bootstrap `.js` paths | Page endpoint, no-store; only explicitly declared pages. |
| `/-/websocket/`, `/-/ws/` | WebSocket endpoint, original Origin/subprotocol/OTAK retained; kernel authorizes. |
| Declared public asset prefixes | Exact scoped read-only views, no directory listing or symlink delivery. |
| Declared internal prefix, normally `/__drumee_artifacts/` | Internal-only alias; authorized service response → real FileIo X-Accel → protected file. GET/HEAD only, no-store, symlinks denied. |
| `/__infra_ready` | Read-only composition readiness probe proxied to declared page readiness path; not a synthetic 200 from generated config. |
| Everything else | Fail closed; no legacy Team/file/letc/avatar rewrites or SPA fallback. |

Trust boundary is **direct edge**. No real_ip/trusted-proxy chain inference.
Nginx overwrites X-Real-IP, X-Connecting-IP, X-Forwarded-For/Proto/Port and removes
Forwarded, X-Forwarded-Host, URL-routing overrides and client X-Accel-Redirect.
Host/port authority must match declared names and external binding. Cookie,
session bridge, request method/query, Origin and response session headers remain
intact. CORS is owned by kernel configuration; gateway adds no independent ACL
or credentialed wildcard policy. Page/WebSocket upstreams cannot delegate files;
only native service responses are allowed to use X-Accel.

Actual Nginx tests demonstrate original/ZIP bytes, Content-* headers, HEAD,
single/suffix/open-ended ranges, 206/416 and stale If-Range fallback. Multiple
ranges are deliberately limited to one (`max_ranges 1`), not advertised as a
multipart-range feature. Private response/query/session/OTAK values and internal
artifact paths are excluded from safe access logs; critical-only error logging
avoids query-bearing request traces. Functional failures remain observable by
status/readiness checks and explicit syntax validation.

An idle upload can close/reset its client connection while Nginx records 408;
with unbuffered proxying, delivery of a complete HTTP 408 response is not
guaranteed. Tests verify the five-second fixture deadline and backend partial
tempfile cleanup. Clients must handle transport interruption and kernel-owned
retry/status rules. No multipart upload service is added.

Only one transfer backend is supported; Maps/leases are kernel-process-local.
Gateway restart preserves content. Kernel restart loses active transfer IDs;
graceful shutdown clears known staging. No restart-resume, shared transfer store
or load balancing is implemented. All symlinks, including legitimate links in
the delegated view, are denied; archive-worker links used while building ZIPs
are not directly served by Nginx.

## Docker fragment and state

The adapter emits an official digest-pinned image, uid/gid 101, capability drop,
no-new-privileges, read-only root/config/assets/protected view, bounded `/tmp`
tmpfs, memory/pid limits and explicit TCP publication. No host networking or
privileged mode. The separate health listener is loopback **inside the container**
and does not bypass external TLS validation. The distribution supplies the
network and upstreams; a gateway with published host ports needs a bridge that
permits ingress. Docker 29 `internal:true` suppresses the tested published-port
path; the harness uses a dedicated ordinary bridge and publishes only gateway
loopback/high-port ingress. Kernel listeners have no published host ports.

`inspectInfrastructure(deployment, adapter)` calls an explicit observer. The
Docker observer reads only identity/ownership/ports/running/health/revision fields
and probes the plan-bound gateway; raw environment/health-log output is not projected.
The Docker observer validates the exact plan, full container ID, owner,
Compose project/service labels, declared published bindings and revision before
any HTTP request. It uses only the local `/var/run/docker.sock`, fixed loopback
addresses (wildcard bindings map to loopback), declared external port, primary
hostname and fixed `/__infra_ready` path. No caller URL/Host, DNS resolution,
redirect following or disabled HTTPS verification. LAN-only publications and
remote/rootless Docker daemon sockets are unsupported by this alpha observer.
Requests have an absolute 3-second deadline and 4 KiB response bound.

`desired_revision` is the plan revision; `observed_revision` is the Docker label
(`active_revision` is a compatibility alias only). Matching labels do **not**
verify loaded Nginx configuration. A functional probe does **not** verify MFS
delivery. The Docker observer reports loaded configuration and protected delivery
as unverified, so `diagnoseInfrastructure().ready` remains false even when HTTP
is functional. Separate explicit observer attestations may establish these
facts; Docker labels or syntax checks cannot. Activation/process attestation
and reliable drift/recovery evidence remain IL-3 work. Observer failures expose
only allowlisted diagnostic codes, never raw errors.

## Reproduce validation

Prerequisites: Node 22+, Docker/Compose, Chromium-compatible browser, `unzip`,
Git and tar. Infra Layer has **no production dependency**; the only
addition is test-only `websocket@1.0.35` with its lockfile. Runtime tests have no
external service/network dependency; initial image/package preparation may need
registry/APT access.

```sh
git clone https://github.com/drumee/infra-layer.git
cd infra-layer
npm ci
npm test
npm run test:integration
```

The integration runner uses a unique `drumee-il1-test-<suffix>` project, a free
127.0.0.1 high port, a dedicated network and caller-owned temporary fixtures. It
refuses existing project/network/image ownership collisions. Fetches only the
test dependency revision in `test/integration/kernel-dependencies.json`, archives
the listed kernel/build/capability paths into its temporary workspace, installs
the UI/build locked dependencies there, and builds browser
assets with existing ui-build, prepares a test-only Node+zip composition image,
checks Compose and `nginx -t` before gateway startup, waits for health, and runs
the actual HTTP/WebSocket/FileIo/transfer/Chromium cases. Final cleanup removes
only its containers/network/image and temporary files; no named volumes or
production host services are created. `IL1_KEEP_OUTPUT=1` preserves only its
temporary output for investigation; normal mode cleans everything. It never
starts BIND, mail, DB, Redis or an acceptance application.

Pinned test prerequisites:

- Nginx: `nginx@sha256:4a73073bd557c65b759505da037898b61f1be6cbcc3c2c3aeac22d2a470c1752`.
- Node: `node:22-bookworm-slim@sha256:c3de60bf2f9dd0ac6370e6117950ff62d6e339527e7472301c9c78a017978392`.
- Test archive utility: Debian `zip=3.0-13+deb12u1`.

Levels executed: foundation units; real Nginx; real kernel JS authorization,
Session/dispatch, FileIo/media/MFS service and transfer/archive classes; real
LETC/hello browser smoke with dynamic plugin/service/WebSocket reconnect. Identity,
Hub/node persistence, filesystem metadata and Redis-compatible pub/sub are
in-memory test stores. This does not prove MariaDB/Redis lifecycle, provisioned
platform identities, Finder product acceptance, TLS trust or Oxymotion D0.

See [PROVENANCE.md](PROVENANCE.md). `drumee/infra-layer` is the canonical source;
the transient copy is a pinned integration snapshot. IL-2 requires
separate approval; certificate lifecycle, actual DNS/services and full deployment
orchestration remain outside this implementation.
