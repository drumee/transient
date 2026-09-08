# Phase 4.4 WebSocket protocol

This document records the narrow generic transport extracted for Phase 4.4. It is not a Team application-service contract.

## Connection and authentication

The setup-infra-derived Nginx route matches `/-/websocket/` and forwards the HTTP Upgrade to runtime port `23000`. The browser opens it using the historical `service` subprotocol and a real Phase 4 cookie:

```text
Sec-WebSocket-Protocol: service
Cookie: regsid=<real session>
```

The runtime resolves that cookie through the same `SessionManager` used by HTTP. Missing, expired or unknown sessions and unsupported protocols are rejected/closed; no test identity header, fake UID or authentication bypass exists. After `socket_bind`, it emits:

```json
{"service":"sys.hello","data":{"socket_id":"32 hexadecimal characters","user":{"id":"authenticated identity"}}}
```

Historical ui-team first fetched an `authn` one-time token. That path requires historical `authn` SQL plus guest/share handling excluded from Phase 4. The extracted client therefore uses the already-real same-origin `regsid` cookie on the Upgrade request. This is a documented Phase 4 session adaptation, not another authentication scheme.

LETC `READY` and socket `connected` are separate: plugin loading waits only for READY, while authenticated application use explicitly connects.

## Downstream envelope and routing

Redis retains the historical `RedisStore.sendData` fields:

```json
{
  "source":"runtime endpoint identifier",
  "dest":{"socket_id":"target socket"},
  "payload":{"service":"hello.push","data":{"message":"Hello over WebSocket"},"options":{},"model":{}}
}
```

The local subscriber considers only explicit `dest.socket_id` (or historical `dest.id`) and sends `payload` unchanged to a matching local connection. A module may target its authenticated HTTP session; `PushBus` resolves it to current socket recipients before Redis publication. Phase 4.4 deliberately supports targeted sockets only—no global broadcast, Hub, MFS, Team-presence, workspace or user-wide policy.

```text
module Worker → PushBus → RedisStore.sendData → Redis channel
              → each server-runtime subscriber → matching local socket
```

There is no producer-to-local-socket shortcut, preserving multi-instance routing.

## Upstream, keepalive and lifecycle

The generic client preserves historical array upstream shape:

```json
["sys.ping", {"type":"checkConnection"}]
```

The server replies `{ "service": "sys.ping", "data": { ..., "ok": true } }`. Unknown or malformed upstream JSON is ignored, matching historical no-default-dispatch behaviour. The server sends `sys.keepalive` at a 15-second watchdog cadence and refreshes active bindings. The client checks every 60 seconds and sends `sys.ping` after two minutes without an incoming message. Unexpected close retries after 5 seconds; the historical 50-attempt cap resets after 10 seconds. Explicit `close()` stops reconnecting. Close removes its row and inactive bindings are pruned after 120 seconds.

Historical code did not actively disconnect an existing socket merely because the corresponding session later becomes invalid. Phase 4.4 documents rather than invents that monitor.

## Consumer API

`ui-runtime` publishes one canonical `Websocket` singleton:

```js
const off = runtime.Websocket.bindEvent("hello.push", (data, options, model, payload) => {
  // module-owned interpretation and UI update
});
off();
// or runtime.Websocket.unbindEvent("hello.push", listener)
```

`upstream(service, data)` remains available for the limited generic protocol. The runtime parses envelopes and dispatches by service; it has no Team/window-manager service switch. `wm/push.js` is consumer evidence only: conference, meeting, workspace, contact, payment, logout and desktop policy stay in applications/distributions.
