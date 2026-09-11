# Phase 4.4 — WebSocket / push runtime capability

## Corrected transport boundary

Phase 4.4 extracts generic WebSocket transport and Redis delivery, not Team
policy. Its corrective pass restores the historical OTAK model:

```text
HTTP context → ensure regsid → bootstrap.authn → OTAK
→ WebSocket OTAK handshake → socket_bind → Redis-targeted delivery
```

`regsid` persists runtime/session continuity; it is never a WebSocket
credential. A missing ID is allocated by the backend through `session_ensure`.
Anonymous visitors, logged-in users and existing session contexts can obtain an
OTAK. Socket connectivity therefore does not grant `hello.private` or
`hello.push`: those retain their real Domain authorization.

## Principal state and credential lifetime

The source session model distinguishes a persisted principal from being signed
in. The target now retains that distinction explicitly:

| Cookie principal/state | Transport identity | Private implementation / Domain ACL |
| --- | --- | --- |
| provisioned `nobody_id` | anonymous; `sys.hello.user` is `{}` | public implementation; denied |
| provisioned `guest_id` | guest; `sys.hello.user` is `{}` | public implementation; denied |
| regular Drumate, `status=otp` or `otp_pending` | selected principal but unsigned; `sys.hello.user` is `{}` | public implementation; denied |
| regular Drumate, `status=ok` | signed-in identity | private implementation and normal Domain check |

`session_ensure` requires the pre-provisioned nobody principal, assigns it to
every fresh cookie, and repairs only an older nullable `cookie.uid` row. It
never resets a live OTP principal; after the source's ten-minute pending-OTP
window it restores the nobody principal and `status=new`. This imports neither
an OTP delivery table nor an OTP-completion service.

## Final corrective pass: upgrade, claim and transport ownership

The final Phase 4.4 pass remains deliberately inside the existing session
model. It does not begin Phase 4.5 or introduce Hub/MFS semantics.

### Upgrade from `e8e7bac8e`

The WebSocket schema file now contains an idempotent, in-place upgrade before
it recreates procedures that reference `authn.ctime`. It supports the actual
previous Phase 4.4 shape, not only a new database:

```text
e8e7bac8e authn (no ctime), nullable cookie.uid/socket.uid
→ current Phase 4 base prerequisites (sys_conf and entity.type)
→ provisioned system-principal fixture plus representative legacy rows
→ current Phase 4.4 schema upgrade
→ current Phase 4.4 schema upgrade again
```

Legacy `authn` rows are deleted before adding `ctime`: OTAKs are transient and
must not acquire a fabricated lifetime. The migration repairs `cookie.uid IS
NULL` to the provisioned, verified `nobody_id` before tightening it to `NOT
NULL`. It repairs a nullable socket UID from its persisted cookie when
possible, and removes only orphaned socket rows. Socket bindings are transient
live connections, so an orphaned old binding must reconnect with a newly
claimed OTAK after upgrade. A missing provisioned nobody makes the migration
fail rather than silently choosing an identity.

`tests/integration/kernel/phase4.4-websocket-push.test.js`, when run with
`KERNEL_SCHEMA_MODE=upgrade`, creates the pinned `e8e7bac8e` schema, provisions
the old-compatible fixture, inserts null UID and OTAK rows, applies current
schema twice, checks the upgraded columns/data, and runs the complete current
MariaDB/Redis/Nginx/Chrome Phase 4.4 regression against that upgraded database.

### Atomic OTAK claim

`socket_bind` now starts a transaction, selects the valid OTAK row `FOR
UPDATE`, deletes it while holding that lock, validates the persisted session,
and commits the socket binding. The router invokes this bind first and resolves
only the returned session ID afterwards; it no longer pre-reads an OTAK through
a separate `SELECT` path. Two concurrent Upgrade requests therefore have one
claim winner and one `401` loser. The real integration test uses two concurrent
connections for a single token and asserts exactly one fulfillment.

### Guest fail-closed and frontend capability boundary

The Yellow Page context query explicitly validates that `guest_id` exists, is
different from `nobody_id`, and names the provisioned `entity/drumate` guest.
If this configuration is absent or inconsistent, every signed-in decision is
false. A real guest cookie with `status=ok` remains `principal=guest`,
`isGuest()=true`, and unauthenticated; the integration test also removes
`guest_id` temporarily and proves `hello.private` remains denied.

The UI transport preserves the historical write-only session pattern from
`ui-essentials/socket/utils.js::setAuthorization`. Its `regsid` and captured
`fetch` capability live together in a module-private `WeakMap`; neither is a
property of `UiRuntime`, options, `ServiceClient`, a LETC Widget, model/state,
the DOM, WebSocket URL, events, or return data. `setSessionAuthorization()` is
write-only and permits the embedding/bootstrap owner to replace a cross-site
bridge after a server-side rotation. Same-origin browser continuations retain
the server-issued HttpOnly cookie without exposing its value to JavaScript.
The client sends the unchanged `x-param-keysel: regsid` /
`x-param-regsid` form whenever that bridge is supplied.

The HTTP function is captured before plugin execution as well. Assigning
`runtime.serviceClient.fetch` only creates an unused public property; requests
continue through the private captured transport. Unit tests prove direct
runtime/widget access and an attempted transport wrapper cannot recover the
SID, and the real cross-site Hello plugin attempts that wrapper before a
private request still succeeds.

OTAK remains a one-use credential and now has a target-specific 60-second
lifetime. `authn_store` records `ctime`, removes expired rows and
`socket_bind` rejects/consumes an expired token. This is an intentional
transport hardening difference from the historical unbounded `authn` row, not
a new authorization mechanism.

## Cross-site HTTP session bridge

The pinned code, rather than the descriptive `Authorization` fields in some
historical ACL JSON, defines the wire contract. `server-core/lib/input.js`
does not read the standard HTTP `Authorization` header. Its
`Input._parseHeader()` reads `x-param-*`, and `Input.authorization()` resolves
the service session using the following exact client shape from
`ui-essentials/socket/utils.js::makeHeaders`:

```text
X-Param-keysel: regsid
X-Param-regsid: <percent-encoded regsid>
```

The client-side helper calls this an *authorization* because it bridges the
runtime session when a browser cannot use its cookie. It is not a Basic,
Bearer, JWT or OTAK scheme. The corrective target extracts that narrow
`Input.authorization` branch into `server-runtime/lib/input.js`, decodes it
as the source does, and accepts only `keysel=regsid`; historical Hub/DMZ
selectors are deliberately excluded.

`SessionManager.fromRequest()` resolves contexts deterministically:

| HTTP context | Target result |
| --- | --- |
| valid `regsid` cookie only | reuse persisted context |
| valid `x-param` bridge only | reuse that persisted context |
| valid cookie and matching bridge | reuse the one context |
| valid cookie and different bridge | reject `401 SESSION_CONTEXT_CONFLICT` |
| malformed/unknown bridge | reject `401 SESSION_CONTEXT_INVALID` |
| neither | allocate a new anonymous `regsid` only when a service needs one |

Historical service resolution gives a cookie precedence over an `x-param`
value. The target intentionally rejects a conflict instead of silently
switching sessions. A cookie-only unknown value retains the prior safe
behaviour: it is not trusted and a new anonymous context is allocated later.
No extra SQL is required; validation uses the existing runtime-owned
`cookie`/`resolveSessionContext` closure.

An externally hosted `UiRuntime` receives a `sessionAuthorization` runtime
configuration and emits the two historical headers on every service call,
including every fresh/reconnect `bootstrap.authn`. Widgets do not receive the
session value. This preserves:

```text
Cookie or historical x-param session bridge → regsid context
→ bootstrap.authn → OTAK → WebSocket
```

For a cross-site visitor with neither bridge nor cookie, the backend still
creates a new anonymous context and sets its HttpOnly cookie. The kernel does
not invent browser storage to expose that identifier; a later cross-site
continuation must receive the historical bridge from its embedding/runtime
owner. The bridge is sensitive and is never placed in a WebSocket URL,
message, DOM field or log.

The target additionally holds the bridge in a module-private `WeakMap` rather
than on `UiRuntime`, its options or `ServiceClient`. Request emission remains
source-compatible, while a loaded Widget/plugin cannot recover the raw
`regsid` from the runtime object graph.

## Historical evidence and intentional divergence

The Team `bootstrap.authn` descriptor is `scope: hub` with
`src: anyone` and `fast_check: public-api`. Its Worker calls
`Input.authorization()`, generates a 22-character token and calls
`authn_store(token, auth)`. `socket_bind(args)` resolves `auth.otak`, deletes
the row and binds the resulting session.

The kernel preserves the public permission shape but changes only scope:

```text
historical: scope=hub, src=anyone, fast_check=public-api
target:     scope=domain, src=anyone, fast_check=public-api
```

This deliberately avoids Hub ACL/shards/MFS. Domain scope here labels the
Yellow Page runtime boundary; the fast path means no Domain business privilege
is required.

## Runtime ownership and SQL closure

`server-runtime` owns the adapted Yellow Page closure:

- `session_ensure` — narrowed `Input.validCookie`/`session_check_cookie` cookie
  allocation/reuse only;
- `authn`, `authn_store` — historical OTAK shape;
- `socket`, `socket_bind`, `socket_get`, `socket_free`, `socket_list_session`,
  `socket_refresh` — session/socket lifecycle.

`socket_bind` accepts only an OTAK, obtains session context from `authn`, then
consumes it. Its target body deliberately omits historical guest/nobody,
DMZ/profile/quota, conference, endpoint-state and Hub branches. No Hub or MFS
schema is installed.

The retained principal lookup does resolve the existing provisioned
`nobody_id` and `guest_id`, solely to avoid nullable transport ownership and to
preserve the unsigned distinction above. `socket.uid` is therefore non-null;
this is not guest, DMZ or MFS behavior.

## Origin, client and push path

The generic UI client calls `bootstrap.authn` for every initial connection and
reconnect, then connects with `?otak=…` using the historical `service`
subprotocol. It exposes the existing generic bind/unbind API and keeps READY
separate from CONNECTED. `allowedOrigins` supports same-origin and explicit
external frontends; the same explicit list enables credentialed CORS for the
HTTP login/authn calls needed by an external browser. A foreign Origin or
invalid OTAK cannot authorize the other.

`hello.push` is unchanged: authenticated caller → Domain ACL → Worker →
PushBus → real Redis → subscriber → targeted socket → generic UI dispatch →
Hello Widget DOM. The Worker targets its session and never receives OTAK logic.

Configured external origins receive credentialed HTTP CORS headers for
`x-param-keysel`, `x-param-regsid`, JSON content and the generic
`Authorization` header. The latter remains a CORS-allowed generic header, not
a session parser. Browser preflight is handled by the generic service adapter.
The same configured origin is separately accepted by the WebSocket Origin
policy. Cross-origin plugin bundles use a normal classic script tag after the
historical same-origin XHR loader has resolved their absolute runtime URL; this
does not turn static plugin routes into credentialed CORS endpoints.

## Validation

`tests/integration/kernel/phase4.4-websocket-push.test.js` starts clean MariaDB,
Redis, Nginx and Chrome. It proves cookie and header session recovery,
unknown/malformed/conflicting bridge rejection, CORS preflight, new/anonymous/
authenticated session handling, missing/invalid OTAK rejection, no `regsid` in
the Upgrade URL, same-origin and approved-external Origin acceptance, foreign
Origin rejection, anonymous transport/private-service separation, one-use OTAK
binding, Redis logs, two-user isolation and the real Hello DOM update. Its
cross-site browser uses `app.external.test` against `api.kernel.test` through
Chromium host-resolver rules, omits cookies, reuses a real logged-in session via
the historical headers, reconnects through a fresh OTAK, loads Hello and
updates the DOM. A separate anonymous cross-site browser connects and remains
denied from `hello.private`.

The corrective-pass verification on 2026-09-08 was:

| Command | Result |
| --- | --- |
| `node --test target/foundation/server-runtime/test/*.test.js` | PASS (session bridge, Domain ACL and WebSocket units) |
| `npm test --prefix target/foundation/ui-runtime` | PASS (service bridge and reconnect client units) |
| `npm test --prefix target/modules/hello` | PASS (Hello dispatcher/ACL/plugin unit suite) |
| `node --test tests/integration/kernel/phase4-authenticated-private.test.js` | PASS (real login, bitmask ACL, revoke/restore) |
| `node --test tests/integration/kernel/phase4.4-websocket-push.test.js` | PASS (real MariaDB, Redis, Nginx, Chrome and genuine two-site browser path) |
| `node --test tests/integration/kernel/ui-runtime-browser.test.js` | PASS |
| `node --test tests/integration/kernel/hello-browser-e2e.test.js` | PASS |
| `DRUMEE_UI_BUILD_NODE_MODULES=.tmp/test-env/build-src/ui-team/node_modules npm test --prefix target/tooling/ui-build` | PASS |
| `scripts/test-env/kernel/check.sh` | PASS |

The principal/credential hardening regression on 2026-09-09 additionally
passed the server-runtime, ui-runtime, Hello and ui-build package suites; the
real Phase 4 Domain test; the real Phase 4.4 MariaDB/Redis/Nginx/Chrome test;
the Hello/Nginx browser E2E; and the standalone UI-runtime Chrome fixture.

Team conference/presence/workspace/payment/window-manager behaviour remains
outside the runtime. Phase 4.5 packaging is not started here.
