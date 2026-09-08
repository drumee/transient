# Phase 4.4 WebSocket protocol

This is the generic kernel transport contract. Application services retain
their own meaning and are not part of the protocol.

## Session and transport authentication

```text
HTTP runtime context
→ ensure `regsid`
→ POST bootstrap.authn
→ { token: OTAK }
→ GET /-/websocket/?otak=OTAK (subprotocol: service)
→ OTAK resolution
→ socket_bind
→ socket/session association
```

`regsid` is the persisted runtime/session-continuity identifier. When absent,
the backend calls the runtime-owned `session_ensure` procedure, creates a
cookie row and returns `Set-Cookie: regsid=…` from `bootstrap.authn`. An
existing anonymous or authenticated session is retained. The client neither
allocates nor supplies a trusted session identifier.

`bootstrap.authn` is intentionally:

```json
{"scope":"domain","permission":{"src":"anyone","fast_check":"public-api"}}
```

The public fast path grants transport setup without a Domain business bit or a
call to `domain_permission`. `scope: domain` is a deliberate kernel divergence
from the historical Team descriptor (`scope: hub`, same `src: anyone` and
`fast_check: public-api`): OTAK issuance is session transport, not Hub-resource
authorization. Anonymous and authenticated runtime sessions may both obtain an
OTAK; protected services still use their normal Domain ACL.

The OTAK is a 22-character opaque token, stored through the historical-shape
`authn_store(token, value)` procedure with the authoritative session ID in its
JSON value. It is supplied only as the `otak` WebSocket query field. The route
does not read `regsid` from a query, subprotocol, payload or cookie as a
WebSocket credential. `socket_bind(args)` resolves then deletes the OTAK, so it
is one-use. Historical code provides no independent token expiry; the target
documents rather than redesigns that limitation.

The browser client acquires a new OTAK before every initial connection and
reconnection. Applications use neither OTAK nor `regsid` directly.

## Origin and handshake rejection

Browser Upgrade acceptance requires both a valid OTAK and a permitted Origin.
The default accepts an Origin matching the proxy's public host/forwarded port;
`allowedOrigins` adds explicit external frontend origins. Missing Origin is
denied unless the runtime host explicitly enables non-browser clients.
The same allowlist is also emitted as credentialed CORS response headers by the
generic HTTP service adapter, so an approved external browser can perform login
and `bootstrap.authn` before its OTAK Upgrade. An external `UiRuntime` can use
its absolute `serviceBase` plus `serviceCredentials: "include"`; application
widgets still do not handle cookies, regsid or OTAK.

| Condition before Upgrade | HTTP status |
| --- | --- |
| unsupported subprotocol | `400` |
| missing or invalid OTAK | `401` |
| missing/foreign unconfigured Origin | `403` |

These are HTTP responses, not WebSocket close codes. After Upgrade, the
runtime may use application close codes in the `4000–4999` range (for example
binding failure). Origin is defense in depth, never an authentication grant.

## Downstream envelope and delivery

Redis preserves the historical envelope:

```json
{
  "source": "runtime endpoint identifier",
  "dest": {"socket_id":"target socket"},
  "payload": {"service":"hello.push","data":{"message":"Hello over WebSocket"}}
}
```

`PushBus` resolves a Worker's runtime session to current socket IDs before
publishing. Every runtime subscriber delivers only a matching local socket;
there is no producer-to-local-socket shortcut and no broadcast capability in
this phase.

## Lifecycle and consumer contract

After a successful bind the server emits `sys.hello`; it also handles array
upstream `sys.ping` and emits `sys.keepalive`. Watchdog refresh and cleanup use
`socket_refresh` and `socket_free`. Session invalidation does not currently
monitor and disconnect an existing socket, matching the documented limited
historical behaviour.

Runtime READY and socket CONNECTED remain distinct. `ui-runtime::Websocket`
preserves `bindEvent`, `unbindEvent`, `upstream`, the historical 5-second
reconnect/50-attempt cap and keepalive. A module receives parsed service data:

```js
const off = runtime.Websocket.bindEvent("hello.push", (data, options, model) => {});
off();
```

The runtime contains no Team/window-manager service switch.
