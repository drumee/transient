# Phase 4.4 WebSocket dependency map

| Component | Historical source | Target owner | Redis | Yellow Page/session | Domain ACL | Hub | MFS | Team | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WebSocket server/lifecycle/downstream | `sources/server-team/router/push/index.js` | `server-runtime/lib/websocket-router.js` | subscribe | bind/free/refresh socket rows | none in transport | no | no | presence/conference removed | KEEP_SERVER_RUNTIME |
| Module publication API | `sources/server-essentials/lib/redis-store.js::sendData` and Team worker call sites | `server-runtime/lib/push-bus.js` | publish historical envelope | resolves session recipients | caller service remains responsible | no | no | no service policy | KEEP_SERVER_RUNTIME |
| Socket schema closure | `sources/schemas/yellow_page/{tables/socket.sql,procedures/session/socket_*.sql}` | `server-runtime/schemas/yellow-page/phase4.4-websocket.sql` | no | `cookie`, `entity`, `socket` | no | no | no | authn/DMZ/conference removed | REQUIRED_WEBSOCKET_RUNTIME |
| Upgrade route | `sources/setup-infra/.../routes/app.conf.tpl` | generated kernel Nginx config | no | cookie forwarded | no | no | no | no | KEEP_INFRA_CONTRACT |
| Browser client/reconnect/keepalive | `sources/ui-team/src/drumee/router/websocket/index.js` | `ui-runtime/src/websocket.js` | indirect | same-origin `regsid` | no | no | no | authn token/radios removed | KEEP_UI_RUNTIME |
| Consumer contract | `sources/ui-team/.../websocket/index.js::{bindEvent,unbindEvent,__processMessage__}` | `ui-runtime::Websocket.bindEvent/unbindEvent` | no | connection prerequisite | no | no | no | Marionette/radio coupling removed | KEEP_UI_RUNTIME |
| Application interpretation | `sources/ui-team/src/drumee/modules/desk/wm/push.js` | module/distribution code | optional producer | application choice | application choice | deferred | deferred | conference/workspace/presence/billing/Wm left behind | TEAM_SPECIFIC |
| Validation | new `hello.push` | `target/modules/hello` | publish through runtime API | caller session target | `scope: domain`, `src: read` | no | no | no | VALIDATION_ONLY |
