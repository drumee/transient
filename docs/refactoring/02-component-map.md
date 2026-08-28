# Component Map

The classification column classifies the responsibility named in the first column. “Repo/path” identifies current evidence and implementation locations only. It is not a move list: each location may mix OS, module, SDK, control-plane, deployment and legacy concerns and must be decomposed at symbol/behavior boundaries during an approved implementation phase.

| Responsibility | Current evidence location | Current implementation / dependencies | Responsibility classification | Risk |
|---|---|---|---|---|
| Generic request/session/ACL engine | `sources/server-core/lib/{session,input,output,acl}.js` | Hosts requests and evaluates supplied access rules | `KEEP_OS` | High |
| Generic REST/module dispatcher | `sources/server-team/router/rest/index.js`, `service.js` | Registers modules/plugins and dispatches authorized service calls | `KEEP_OS` | Critical |
| Service-specific deny/allow policy | `sources/server-team/acl/**` and service checks | Defines access policy for particular services; consumes generic ACL engine | Same owner as service (`TEAM_MODULE`, `SYSTEM_MODULE`, or `INVESTIGATE`) | High |
| Secure-share policy | `sources/server-team/acl/secure_share.json`, secure-share service/schema families | Defines secure-share authorization behavior | `INVESTIGATE` | Critical |
| Billing/over-limit policy | Team billing services and `sources/server-team/service/lib/env.js` feature/policy exposure | Product/distribution policy, not generic authorization machinery | `TEAM_MODULE` or policy module (`INVESTIGATE`) | High |
| Team backend services | `sources/server-team/{service,acl}/**` | Workspace, sharing, chat, tasks, meetings, billing | `TEAM_MODULE` (split by family) | Critical |
| MFS engine | `sources/server-core/lib/{mfs,entity,file-io}.js`; `schemas/common/procedures/mfs_*.sql` | Node semantics, permission, storage mapping | `KEEP_OS` | Critical |
| LETC/kind runtime | `sources/ui-core/letc/**` | Rendering and dynamic kind registry | `SDK_OR_ESSENTIALS` | High |
| Minimal browser host/shell responsibility | Mixed evidence in `sources/ui-team/src/drumee/{api.js,index.web.js,router/**}` and `sources/ui-core/letc/**` | Must bootstrap the UI runtime and host dynamically loaded applications; no minimal implementation exists yet | `KEEP_OS`; exact source boundary `INVESTIGATE` | Critical |
| Window Manager | `sources/ui-team/src/drumee/modules/desk/wm/**`, `builtins/window/{core,manager}.js` | Hosts windows/DnD | `KEEP_OS` | Critical |
| Finder/folder UI | UI `builtins/window/{folder,serverexplorer}/**` | User-facing MFS browser | `SYSTEM_MODULE` | High |
| Signin | `sources/signin/src/**` | Sign-in/guest kinds | `SYSTEM_MODULE` | Medium |
| Loby | `sources/loby/{acl,service,schemas}/**` | Signup/OAuth/invite/onboarding | `SYSTEM_MODULE` | High |
| Chat/channels | UI bigchat/channel; server chat/channel; related schemas | Collaboration | `TEAM_MODULE` | Critical |
| Tasks | UI tasks; server `acl/task.json`; common `task*` schemas | Task workflows | `TEAM_MODULE` | Critical |
| Meetings | UI meeting/connect/schedule; server conference/room/signaling; schemas | Calls/scheduling | `TEAM_MODULE` | Critical |
| Editors/previewers | `sources/ui-team/src/drumee/builtins/editor/**` | Generic document capabilities | `SYSTEM_MODULE` / `INVESTIGATE` | High |
| Server infrastructure library | `sources/server-essentials/lib/**` | DB/cache/config/log/mail/workers | `SDK_OR_ESSENTIALS` | High |
| UI libraries | `sources/ui-{essentials,toolkit,styles}/**` | Transport/widgets/styles | `SDK_OR_ESSENTIALS` | Medium |
| Core yp schema | `sources/schemas/yellow_page/**` | Identity, entities, tenancy and routing plus mixed product data | Mixed `KEEP_OS`/`TEAM_MODULE`/`INVESTIGATE` | Critical |
| Common/entity schemas | `sources/schemas/{common,hub,drumate}/**` | MFS/ACL plus collaboration | Mixed `KEEP_OS`/`TEAM_MODULE` | Critical |
| Provisioning | `sources/setup-schemas/**` | First install, warm entities, users/hubs/storage | `DEPLOYMENT` over `KEEP_OS` contracts | Critical |
| CLI shell + DB resources | `sources/cli/{bin,src}/**` | Administration via yp/shards/disk | `CONTROL_PLANE` | Critical |
| CLI API backend | `sources/cli/src/backend/api/index.js` | Throwing placeholder | `INVESTIGATE` | High |
| Packaging/self-hosting | `sources/debian/**` | Docker/native config, packages and lifecycle | `DEPLOYMENT` | Critical |
| Debian plugin operator | `sources/debian/bin/drumee-plugin` | File-based server plugin lifecycle | `DEPLOYMENT`; future owner `INVESTIGATE` | High |
| Licence/custom/offline schemas | `sources/schemas/{licence,costums,offline}/**` | Specialized/unclear | `INVESTIGATE` | High |

Nothing is classified `LEGACY` without call-site or history proof.

In particular, `sources/server-team/router/rest/index.js`, UI Team boot/Window Manager files, and mixed schema directories are not thereby designated future OS files. UI Team is the integrated compatibility application, not an existing minimal shell. Its current files contain evidence from which the browser-host responsibility may eventually be isolated while Team behavior remains with modules/distribution code. The ACL engine's ownership likewise does not pull the rules it evaluates into the OS.
