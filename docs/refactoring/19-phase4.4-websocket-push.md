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

## Validation

`tests/integration/kernel/phase4.4-websocket-push.test.js` starts clean MariaDB,
Redis, Nginx and Chrome. It proves new/anonymous/authenticated session handling,
missing/invalid OTAK rejection, no `regsid` in the Upgrade URL, same-origin and
approved-external Origin acceptance, foreign Origin rejection, anonymous
transport/private-service separation, one-use OTAK binding, Redis logs,
two-user isolation and the real Hello DOM update.

Team conference/presence/workspace/payment/window-manager behaviour remains
outside the runtime. Phase 4.5 packaging is not started here.
