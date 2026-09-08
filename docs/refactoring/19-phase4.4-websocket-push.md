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

Team conference/presence/workspace/payment/window-manager behaviour remains
outside the runtime. Phase 4.5 packaging is not started here.
