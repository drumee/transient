# CLI Map

## Command/runtime structure

`sources/cli/bin/drumee.js` defines `--backend db|api`, `--domain`, `--json`, `--verbose` and user/hub/settings/MFS groups. `src/context.js::Context.runner` lazily connects one backend, forwards options, formats, closes and exits; `src/lib/output.js` renders JSON/tables. This is `CONTROL_PLANE`.

`src/backend/index.js::createBackend` is the transport factory. Commands address `backend.user`, `.hub`, `.settings`, `.mfs`. Parity is absent: `src/backend/api/index.js::connect` always throws. Authentication, pairing, tokens, HTTP and generic `module.method` calls are not implemented; they remain `INVESTIGATE` despite README planning language.

## DB backend

`src/backend/db/index.js::connect` imports `Mariadb`, `Cache`, `sysEnv`, `toArray`, `uniqueId` from server-essentials, reads `/etc/drumee`, records `mfs_dir`, connects to `yp` as `process.env.USER`, and warms cache. It performs direct SELECTs/procedure calls, resolves `entity.db_name`, and opens shard connections. This assumes DB credentials and local filesystem visibility. Supported native/container placement is `INVESTIGATE`.

| Family | Operations and dependencies |
|---|---|
| User | list/get/add/update/delete in `backend/db/users.js`; yp entity/drumate reads, `get_user`, `drumate_create`, update procedures, shard `mfs_init_folders`; purge walks hubs, procedures and disk |
| Hub | list/get/members/create/delete in `hubs.js`; yp hub/vhost, shard show/member procedures; `desk_create_hub`; purge and disk |
| Settings | list/get/set in `settings.js`; `get_sys_conf`, `sys_conf_set`; root required for set |
| MFS | ls/node/import/export in `mfs.js`; shard MFS procedures, direct `media` reads and blob copying |

User add consumes the factory pool through `drumate_create`; hub create through `desk_create_hub`. CLI does not create databases/assign shards itself: factory/schema procedures provide `db_name`, `home_dir`, `home_id`. Empty pool surfaces as `EMPTY_FACTORY`.

Import creates MFS nodes then copies to `<home_dir>/__storage__/<id>/orig.<ext>`; export walks `media`. User/hub delete require OS root. `assertExclusiveStorage` rejects empty/root/outside paths and directories containing another entity's home; deletion rechecks. Operations are not transactional and can partially change database/disk.

No module/plugin command exists. Future install/list/enable/disable/upgrade/remove is `INVESTIGATE`. The backend seam could expose it only after an authenticated, audited, transactional platform API provides validation, dependencies, schema migration, status and rollback without Team knowledge.

Tests must cover every DB command, pool exhaustion, destructive preflight, MFS round-trips and native/container configuration. A future API backend must run identical parity scenarios. `sources/cli/package.json` currently has no test script.
