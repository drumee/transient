"use strict";
const path = require("node:path");
const runtime = require("@drumee/server-runtime");
const system_mfs = require("@drumee/system-mfs");
const vendor = name => require(path.join(__dirname, "../vendor", name, "lib"));
const platform = vendor("platform-bootstrap");
const hub_api = vendor("hub-lifecycle");
const Constants = require("../vendor/essentials/lex/constants");
const { permissionValue } = require("../vendor/essentials/lex/permission");
function components(database) {
  const acl = hub_api.createAclContract(Constants);
  const hub_store = new hub_api.SqlHubStore({ database, acl });
  const mfs_store = new system_mfs.SqlMfsStore({ database });
  const module_registry = new hub_api.ModuleRegistry();
  const module_root = path.dirname(require.resolve("@drumee/system-mfs/package.json"));
  module_registry.register({ module_id: "system-mfs", module_root, handler: ({ hub }) => system_mfs.provision({ store: mfs_store, context: { hub_id: hub.hub_id } }), artifact_ref: "git:53101c4a995ffca9118f795ab5d4c7c731200a2f" });
  const lifecycle = new hub_api.HubLifecycle({ store: hub_store, registry: module_registry, can_create: async ({ organisation_id }) => organisation_id === 1 });
  const yellow_page = new runtime.YellowPageStore({ database });
  const sessions = new runtime.SessionManager({ store: yellow_page });
  return { acl, hub_store, mfs_store, lifecycle, yellow_page, sessions };
}
module.exports = { runtime, system_mfs, platform, vendor, Constants, permissionValue, components };
