# Phase 4.4 — WebSocket / push runtime capability

## Scope and boundary

Phase 4.4 extracts generic transport, not Team product behaviour:

```text
authenticated Worker → PushBus → Redis → WebSocket router
→ authenticated browser socket → ui-runtime dispatch → module consumer
```

It reuses Phase 4 Yellow Page `regsid` identity and Domain ACL. It neither starts Phase 4.5 nor introduces Hub, MFS, Finder, Desktop, Window Manager, Marketing or another authentication system.

## Historical architecture and exclusions

`sources/server-team/router/push/index.js` supplies the `service` protocol, connection map, Redis subscriber, historical `{source,dest,payload}` envelope, targeted socket delivery, `sys.hello`, `sys.ping`, `sys.keepalive` and watchdog. Those are now `server-runtime` responsibilities.

Its online-status broadcasting, guest/nobody branches, conference release, `get_hub`, room handling, page hash and Wm bootstrap branches are Team, Hub, conference or legacy behaviour and are excluded.

`sources/ui-team/src/drumee/router/websocket/index.js` supplies client connection state, JSON decoding, array-form upstream, reconnect, keepalive and bind/unbind. The extracted client uses the real Phase 4 cookie Upgrade instead of the Team `authn` token path, which depends on excluded authn/guest/share SQL. `sources/ui-team/src/drumee/modules/desk/wm/push.js` remains consumer evidence only; its conference, workspace, contact, payment, logout and desktop reactions remain outside the kernel.

## Extracted files and protocol

- `target/foundation/server-runtime/lib/websocket-router.js`: Upgrade acceptance, real session lookup, socket binding, local connections, Redis subscriber, targeted delivery, ping, keepalive and cleanup.
- `target/foundation/server-runtime/lib/push-bus.js`: `publish({ service, sessionId|dest, data, options, model })` resolves targets and calls generic `RedisStore.sendData`.
- `target/foundation/ui-runtime/src/websocket.js`: the single production `Websocket` singleton with connection state, reconnect/keepalive, `upstream`, `bindEvent` and `unbindEvent`.

The exact wire contract is [websocket-protocol.md](websocket-protocol.md); dependency classification is [websocket-dependency-map.md](websocket-dependency-map.md).

## SQL ownership

The intrinsic runtime SQL lives under:

```text
target/foundation/server-runtime/schemas/
├── SCHEMA_MANIFEST.json
├── PROVENANCE.md
└── yellow-page/phase4.4-websocket.sql
```

It owns `socket`, `socket_bind`, `socket_free`, `socket_list_session` and `socket_refresh`, depending only on existing Phase 4 `cookie` and `entity`. Source names are retained where intrinsic, but bodies omit historical authn, DMZ, profile/quota, conference, presence, Hub and MFS. Phase 4.5 may package/version this inventory; it is intentionally not performed here.

## Hello validation

`hello.push` uses the existing private descriptor:

```json
{"scope":"domain","permission":{"src":"read"}}
```

The Worker targets its authenticated `session.sid` through the injected `PushBus`, publishes `hello.push`, and returns a normal HTTP acknowledgement. The Hello Widget binds to `runtime.Websocket`, never raw `new WebSocket`, and updates its `Skeletons.Note` status.

The primary E2E uses clean Nginx + MariaDB + Redis, real login, cookie Upgrade, socket/session binding, Domain ACL, Worker publication, Redis subscriber delivery and actual LETC DOM update. It connects a second real denied user and proves that user never receives the targeted message. `kernel push published` and `kernel push delivered` logs prove Redis publication/subscription occurred rather than a direct server-to-socket shortcut.

## Validation

`node --test tests/integration/kernel/phase4.4-websocket-push.test.js` passed in the disposable environment. Focused server-runtime, ui-runtime and Hello unit suites pass; final full-regression results are recorded with the phase handoff.
