# Phase 4.4 WebSocket dependency map

| Component | Historical source | Target owner | Redis | Yellow Page/session | Domain ACL | Hub | MFS | Team | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| regsid allocation | `server-core/lib/input.js::{validCookie,_authorization}` + `session_check_cookie.sql` | `server-runtime::session_ensure` | no | `cookie`, `uniqueId` | no | no | no | Hub/DMZ closure removed | RUNTIME_SESSION |
| HTTP session bridge | `server-core/lib/input.js::{_parseHeader,_authorization,authorization}`; `ui-essentials/socket/utils.js::makeHeaders` | `server-runtime/lib/input.js` + `SessionManager.fromRequest`; `ui-runtime::ServiceClient` | no | validated `cookie` context | no | no | no | only `keysel=regsid`; Hub/DMZ selectors removed | RUNTIME_SESSION |
| `bootstrap.authn` | `server-team/{acl,service}/bootstrap` | `server-runtime::{acl,service,session}` | no | `session_ensure`, `authn_store` | public fast path only | historical scope removed | no | product Hub scope removed | WEBSOCKET_AUTH |
| OTAK store/resolution | `authn.sql`, `authn_store.sql`, `socket_bind.sql` | `server-runtime` schema/store | no | `authn`, `cookie` | no business bit | no | no | guest/share policy removed | WEBSOCKET_AUTH |
| WebSocket server/lifecycle | `server-team/router/push/index.js` | `server-runtime/lib/websocket-router.js` | subscribe | OTAK → `socket_bind/free/refresh/get` | none in transport | no | no | presence/conference removed | KEEP_SERVER_RUNTIME |
| Origin policy | new localized transport hardening | `server-runtime/lib/websocket-router.js` | no | no | no | no | no | no | KEEP_SERVER_RUNTIME |
| Module publication API | `server-essentials/lib/redis-store.js::sendData` | `server-runtime/lib/push-bus.js` | publish | resolves session recipients | caller service remains responsible | no | no | no policy | KEEP_SERVER_RUNTIME |
| Browser OTAK/connect/reconnect | `ui-team/router/websocket/index.js` | `ui-runtime/src/websocket.js` | indirect | HTTP authn, OTAK Upgrade | no | no | no | radios/Visitor/Wm removed | KEEP_UI_RUNTIME |
| Consumer contract | `ui-team websocket::{bindEvent,unbindEvent}` | `ui-runtime::Websocket` | no | connection prerequisite | no | no | no | application switch removed | KEEP_UI_RUNTIME |
| Application interpretation | `ui-team/modules/desk/wm/push.js` | module/distribution | optional | application choice | application choice | deferred | deferred | conference/workspace/presence/billing/Wm left behind | TEAM_SPECIFIC |
| Validation | new `hello.push` | `target/modules/hello` | real publish | caller session target | `scope: domain`, `src: read` | no | no | no | VALIDATION_ONLY |
