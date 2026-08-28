# Component Map

| Component | Repo/path | Responsibility / dependencies | Classification | Risk |
|---|---|---|---|---|
| Request/session/ACL | `sources/server-core/lib/{session,input,output,acl}.js` | Hosts service execution on essentials | `KEEP_OS` | High |
| Dynamic service dispatch | `sources/server-team/router/rest/index.js`, `service.js` | Registers ACL modules/plugins | `KEEP_OS` | Critical |
| Team backend services | `sources/server-team/{service,acl}/**` | Workspace, sharing, chat, tasks, meetings, billing | `TEAM_MODULE` (split by family) | Critical |
| MFS engine | `sources/server-core/lib/{mfs,entity,file-io}.js`; `schemas/common/procedures/mfs_*.sql` | Node semantics, permission, storage mapping | `KEEP_OS` | Critical |
| LETC/kind runtime | `sources/ui-core/letc/**` | Rendering and dynamic kind registry | `SDK_OR_ESSENTIALS` | High |
| Browser shell/router | `sources/ui-team/src/drumee/{api.js,index.web.js,router/**}` | Bootstrap and host navigation | `KEEP_OS` | Critical |
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
