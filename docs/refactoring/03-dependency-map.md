# Dependency Map

| Consumer | Dependency | Evidence / coupling |
|---|---|---|
| UI Team | ui-core, ui-essentials, ui-toolkit, ui-styles | `sources/ui-team/package.json`; global kind bootstrap in `src/drumee/index.web.js` |
| Server Team | server-core, server-essentials, schemas | `sources/server-team/package.json`; `service.js` constructs core session/IO and essentials cache/Redis |
| Team UI | MFS + Window Manager | `sources/ui-team/src/drumee/builtins/media/core.js`; seed registry |
| Team server | MFS + ACL | `sources/server-team/acl/mfs*.json`; core entity/MFS consumers |
| MFS | common procedures + disk | `sources/server-core/lib/mfs.js`; `schemas/common/procedures/mfs_*.sql`; setup storage creation |
| Schemas | templates/provisioning | `sources/schemas/templates/**`; `setup-schemas/lib/schema.js` |
| CLI | server-essentials | `DbBackend.connect()` imports MariaDB, Cache, sysEnv and helpers |
| CLI | yp + shards | Direct entity/drumate/hub/vhost/sys_conf reads and qualified calls in `backend/db/**` |
| CLI | MFS procedures/storage | `mfs.js` uses MFS procedures, `media`, and `__storage__` |
| CLI | Drumee API | No current edge: `ApiBackend.connect()` throws |
| Debian | Team/server/schema/setup sources | Build matrix in `sources/debian/README.md` and Dockerfiles |
| Loby | runtime plugin loader | ACL points to services; REST `loadPlugins` registers it |
| Signin | UI plugin loader | dynamic seed imports, addon registration, bootstrap entry resolution |

Hidden coupling includes browser globals (`Kind`, `Wm`, `bootstrap`, `Visitor`), process globals/cache, `/etc/drumee`, endpoint/plugin directory layouts, `<data_dir>/mfs/**/__storage__`, qualified procedure names, multi-result-set shapes, webpack aliases and environment-derived build paths.

The main cycles are semantic: setup provisions entities that runtime mutates; CLI duplicates setup/shell create/purge behavior; all three mutate yp, shard databases and disk. UI Team also consumes service-name maps and bootstrap state from Server Team as an implicit cross-repository API. No package-loader cycle was proven.
