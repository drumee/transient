"use strict";

// Integration composition of existing owner modules, not another MFS engine.
const path = require("node:path");
const { MfsService, MfsPermissionBackend } = require("../../modules/mfs-service/lib");
const { MfsTransferService, TransferStaging } = require("../../modules/mfs-transfer/lib");
const { HostFilesystem, FileIo } = require("../../modules/host-filesystem/lib");
const { MediaService, RepresentationManager } = require("../../modules/media-service/lib");

function createHubCapabilityProvider({ hub_store, module_id, schema_version }) {
  return async ({ hub_context, hub_contexts }) => {
    const contexts = hub_contexts ? Object.values(hub_contexts) : hub_context ? [hub_context] : [];
    if (!contexts.length || !schema_version) return { available: false, status: "unauthorized_or_unversioned" };
    for (const hub of contexts) {
      if (!hub.authorized) return { available: false, status: "unauthorized" };
      const rows = await hub_store.query("SELECT status,applied_version FROM hub_capability WHERE hub_id=? AND module_id=? LIMIT 1", hub.hub_id, module_id);
      const state = rows[0];
      if (!state || state.status !== "ready" || state.applied_version !== schema_version) return { available: false, status: !state ? "missing" : state.status !== "ready" ? state.status : "upgrade_required" };
    }
    return { available: true, status: "ready" };
  };
}

function createCanonicalMfs({ runtime, system_mfs, system_mfs_schema_version, database, hub_store, session_manager, permission_contract, permission_value, content_root, staging_root, incoming_root, registry, capability_providers = {} }) {
  if (!runtime || !system_mfs || !database || !hub_store || !session_manager || !permission_contract || !permission_value) throw new Error("Canonical MFS requires runtime, SQL MFS, Hub store, sessions and permissions");
  const mfs_store = new system_mfs.SqlMfsStore({ database });
  const hub_authorizer = new runtime.HubAuthorizer({ resolver: hub_store, permissionValue: permission_value });
  const staging = new TransferStaging({ root: staging_root });
  const content_store = new system_mfs.LocalContentStore({ root: content_root, staging });
  const host_filesystem = new HostFilesystem({ root: content_root });
  const file_io = new FileIo({ host_filesystem });
  const filesystem_factory = principal => {
    const scoped_store = new system_mfs.SqlMfsStore({ database, shard_resolver: async ({ hub_id }) => {
      const hub = principal.hub_contexts && principal.hub_contexts[hub_id] || principal.hub_context;
      if (!hub || !hub.authorized || hub.hub_id !== hub_id) throw Object.assign(new Error("Authorized Hub context required"), { code: "MFS_AUTHORIZED_CONTEXT_REQUIRED" });
      const descriptor = await mfs_store.resolveShard({ hub_id });
      if (descriptor.db_name !== hub.database_name) throw Object.assign(new Error("Hub shard context changed"), { code: "MFS_SHARD_CONTEXT_CHANGED" });
      return descriptor;
    } });
    return new system_mfs.MfsFilesystem({ store: scoped_store, principal: principal.uid, content_store });
  };
  let mfs_transfer;
  const permission_backend = new MfsPermissionBackend({ permission_store: mfs_store, transfer_resource: request => mfs_transfer.resourceFor(request) });
  const mfs_service = new MfsService({ filesystem_factory, permission_backend, permission_contract });
  mfs_transfer = new MfsTransferService({ mfs_service, host_filesystem, staging });
  const media_service = new MediaService({
    node_resolver: (node, context) => filesystem_factory(context).getNode({ node }),
    host_filesystem,
    representations: new RepresentationManager({ host_filesystem })
  });
  const descriptors = registry || new runtime.DescriptorRegistry({ permissionValue: permission_value });
  for (const module_id of ["mfs-service", "mfs-transfer", "media-service"]) descriptors.registerDirectory(path.resolve(__dirname, `../../modules/${module_id}/server/acl`));
  const require_system_mfs = createHubCapabilityProvider({ hub_store, module_id: "system-mfs", schema_version: system_mfs_schema_version });
  const capability_resolver = new runtime.CapabilityResolver({ providers: { ...capability_providers, "system-mfs": require_system_mfs } });
  const authorize = runtime.createAuthorizer({ domainAuthorizer: new runtime.DomainAuthorizer({ store: session_manager.store }), hubAuthorizer: hub_authorizer, mfsPermissionBackend: permission_backend });
  const dispatcher = new runtime.ServiceDispatcher({ registry: descriptors, authorize, capability_resolver, workerOptions: { mfs_service, mfs_transfer, media_service, file_io } });
  const before_receive = async ({ service, input, session }) => {
    mfs_transfer.uploadPreflight(input, { uid: session.uid() });
    const { resolved, decision } = await dispatcher.authorizeRequest({ service, input, session });
    await capability_resolver.requireAll(resolved.requires, { input, service, session, hub_context: decision.hub_context, hub_contexts: decision.hub_contexts });
  };
  return {
    mfs_store, mfs_service, mfs_transfer, hub_authorizer, dispatcher, registry: descriptors, capability_resolver, content_store,
    createServer: options => runtime.createServiceServer({ ...options, dispatcher, sessionFactory: request => session_manager.fromRequest(request), binary_uploads: { "mfs-transfer.upload_chunk": { directory: incoming_root, max_bytes: 16 * 1024 * 1024, before_receive } } }),
    destroy() { mfs_transfer.destroy(); }
  };
}

module.exports = { createCanonicalMfs, createHubCapabilityProvider };
