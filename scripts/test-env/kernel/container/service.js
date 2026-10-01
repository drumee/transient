const http = require("http");
const fs = require("fs");
const {
  DescriptorRegistry,
  CapabilityResolver,
  DomainAuthorizer,
  FrontendPluginResolver,
  PushBus,
  SessionManager,
  ServiceDispatcher,
  WebSocketPushRouter,
  YellowPageStore,
  createAuthorizer,
  createServiceServer
} = require("/opt/kernel/server-runtime/lib");
const { permissionValue } = require("/opt/kernel/server-essentials/lib/lex/permission");
const Mariadb = require("/opt/kernel/server-essentials/lib/mariadb");
const { RedisStore } = require("/opt/kernel/server-essentials/lib");
const { HostFilesystem, FileIo } = require("/opt/kernel/host-filesystem/lib");
const { MediaService, RepresentationManager } = require("/opt/kernel/media-service/lib");
const { MfsPermissionBackend } = require("/opt/kernel/mfs-service/lib");
const { MfsTransferService, TransferStaging } = require("/opt/kernel/mfs-transfer/lib");

const fixture_uid = "ffffffffffffffff";
const fixture_hub_id = "b000000000000002";
const download_nid = "d000000000000004";
const media_nid = "e000000000000005";
const upload_root_nid = "f000000000000006";
const artifact_root = "/runtime/artifacts";
const host_filesystem = new HostFilesystem({ root: artifact_root });
const staging = new TransferStaging({ root: `${artifact_root}/transfers` });
const fixture_nodes = new Map();

function createFixture(nid, filename, prefix, size) {
  const relative = `${fixture_hub_id}/${nid}`;
  const physical = `${artifact_root}/${relative}`;
  fs.mkdirSync(`${artifact_root}/${fixture_hub_id}`, { recursive: true });
  const handle = fs.openSync(physical, "w");
  const chunk = Buffer.from(prefix.padEnd(8192, "."));
  try { for (let written = 0; written < size; written += chunk.length) fs.writeSync(handle, chunk, 0, Math.min(chunk.length, size - written)); }
  finally { fs.closeSync(handle); }
  const node = { hub_id: fixture_hub_id, nid, filename, filepath: `/${filename}`, filetype: "file", mimetype: "application/octet-stream", storage_ref: `mfs-content:${fixture_hub_id}:${nid}` };
  fixture_nodes.set(`${fixture_hub_id}:${nid}`, node);
  return node;
}

const download_node = createFixture(download_nid, "phase48-download.txt", "phase48-download-original\n", 256 * 1024);
const media_node = createFixture(media_nid, "phase48-media.bin", "phase48-media-original\n", 2 * 1024 * 1024);
const upload_root = { hub_id: fixture_hub_id, nid: upload_root_nid, filename: "Uploads", filepath: "/Uploads", filetype: "root" };
fixture_nodes.set(`${fixture_hub_id}:${upload_root_nid}`, upload_root);
let upload_serial = 0;
const fixture_mfs_service = {
  async prepareDownload({ roots }) {
    const entries = roots.map((root) => fixture_nodes.get(`${root.hub_id}:${root.nid}`)).filter(Boolean).map((node) => ({ ...node, root_nid: node.nid, root_path: node.filepath }));
    return { roots, entries };
  },
  async prepareUpload({ destination }) { const node = fixture_nodes.get(`${destination.hub_id}:${destination.nid}`); if (!node || !["folder", "root"].includes(node.filetype)) throw new Error("invalid upload destination"); return { destination }; },
  async commitUpload({ destination, payload_ref, metadata }) {
    const source = staging.claim(payload_ref);
    const nid = (0x9000 + ++upload_serial).toString(16).padStart(16, "0");
    const target = `${artifact_root}/${fixture_hub_id}/${nid}`;
    fs.renameSync(source, target);
    const node = { hub_id: destination.hub_id, nid, parent_id: destination.nid, filename: metadata.filename, filepath: `/Uploads/${metadata.filename}`, filetype: "file", mimetype: metadata.mimetype || "application/octet-stream", storage_ref: `mfs-content:${destination.hub_id}:${nid}` };
    fixture_nodes.set(`${node.hub_id}:${node.nid}`, node);
    return { operation_id: "phase48-http-upload", result: node };
  }
};
const mfs_transfer = new MfsTransferService({ mfs_service: fixture_mfs_service, staging, host_filesystem, ttl_ms: 30000, max_jobs: 8, upload_chunk_size: 1024 * 1024, max_upload_chunk_size: 2 * 1024 * 1024 });
const file_io = new FileIo({ host_filesystem });
const representations = new RepresentationManager({ host_filesystem });
const media_service = new MediaService({ node_resolver: async ({ hub_id, nid }) => fixture_nodes.get(`${hub_id}:${nid}`), host_filesystem, representations });
const mfs_permission_backend = new MfsPermissionBackend({
  permission_store: { effectivePermission(uid, node) { return uid === fixture_uid && fixture_nodes.has(`${node.hub_id}:${node.nid}`) ? 63 : 0; } },
  transfer_resource: (value) => mfs_transfer.resourceFor(value)
});

const registry = new DescriptorRegistry({ permissionValue });
registry.registerDirectory("/opt/kernel/server-runtime/acl");
registry.registerDirectory("/opt/kernel/hello/server/acl");
registry.registerDescriptor("mfs-proof", {
  requires: ["system-mfs"],
  modules: { public: "mfs-proof-worker" },
  services: { probe: { permission: { src: "anonymous", fast_check: "public-api" } } }
}, { workdir: __dirname });
registry.registerDescriptor("kernel", {
  services: {
    status: {
      scope: "kernel",
      permission: { src: "anonymous", fast_check: "public-api" }
    }
  },
  modules: { public: "fixture-worker" }
}, { workdir: __dirname });
registry.registerDescriptor("mfs-transfer", {
  services: {
    upload_start: { scope: "mfs", permission: { dest: "write" } },
    upload_chunk: { scope: "mfs", permission: { dest: "write" } },
    upload_status: { scope: "mfs", permission: { dest: "write" } },
    upload_complete: { scope: "mfs", permission: { dest: "write" } },
    upload_abort: { scope: "mfs", permission: { dest: "write" } },
    download_prepare: { scope: "mfs", permission: { src: "read" } },
    download_status: { scope: "mfs", permission: { src: "read" } },
    download_cancel: { scope: "mfs", permission: { src: "read" } },
    download_retrieve: { scope: "mfs", permission: { src: "read" } },
    download_release: { scope: "mfs", permission: { src: "read" } }
  },
  modules: { public: "/opt/kernel/mfs-transfer/server/service/mfs-transfer" }
});
registry.registerDescriptor("media", {
  services: { orig: { scope: "mfs", permission: { src: "read" } } },
  modules: { public: "/opt/kernel/media-service/server/service/media" }
});

const pluginResolver = new FrontendPluginResolver({
  roots: [{ directory: "/srv/drumee/runtime/plugins/ui/main", publicPrefix: "/-/plugins" }]
});
const yellowPage = new Mariadb({ name: process.env.KERNEL_DB_NAME || "yp", user: process.env.KERNEL_DB_USER, limit: 1, throwOnError: true });
const yellowPageStore = new YellowPageStore({ database: yellowPage });
let mfs_api;
let mfs_store;
function resolveMfsStore() {
  if (!fs.existsSync("/opt/kernel/system-mfs/lib/index.js")) return null;
  if (!mfs_store) {
    mfs_api = require("/opt/kernel/system-mfs/lib");
    mfs_store = new mfs_api.SqlMfsStore({ database: yellowPage });
  }
  return mfs_store;
}
const sessionManager = new SessionManager({ store: yellowPageStore });
const authorize = createAuthorizer({ domainAuthorizer: new DomainAuthorizer({ store: yellowPageStore }), mfsPermissionBackend: mfs_permission_backend });
global.endpointAddress = process.env.KERNEL_PUSH_ENDPOINT || "kernel-runtime:23000";
const push = new PushBus({ redisStore: RedisStore, socketStore: yellowPageStore });
const websocketAllowedOrigins = (process.env.KERNEL_WEBSOCKET_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const capability_resolver = new CapabilityResolver({
  providers: {
    "system-mfs": ({ input = {} }) => {
      const store = resolveMfsStore();
      if (!store) return { available: false, status: "not-installed" };
      return mfs_api.capabilityAvailable({
        store, context: { hub_id: input.hub_id }
      });
    }
  }
});
const dispatcher = new ServiceDispatcher({ registry, authorize, capability_resolver, workerOptions: { pluginResolver, push, resolveMfsStore, mfs_transfer, file_io, media_service } });
const server = createServiceServer({
  dispatcher,
  binary_uploads: { "mfs-transfer.upload_chunk": { directory: "/runtime/incoming", max_bytes: 2 * 1024 * 1024, before_receive: ({ input, session }) => mfs_transfer.uploadPreflight(input, { uid: session.uid() }) } },
  sessionFactory: (request) => sessionManager.fromRequest(request),
  allowedOrigins: websocketAllowedOrigins,
  onDispatch: ({ service, session }) => {
    // Deliberately credential-free audit evidence for the cross-site bridge.
    // Never add sid, OTAK, cookies or raw headers to this log.
    const source = session && session.contextSource || "none";
    const cookie = session && session.hasCookieContext ? "present" : "absent";
    console.log(`kernel dispatched ${service} session-source=${source} cookie=${cookie}`);
  }
});
const pushHttpServer = http.createServer((request, response) => {
  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ status: "error", code: "WEBSOCKET_ONLY" }));
});
const websocket = new WebSocketPushRouter({
  httpServer: pushHttpServer,
  sessionManager,
  socketStore: yellowPageStore,
  redisStore: RedisStore,
  allowedOrigins: websocketAllowedOrigins,
  allowMissingOrigin: process.env.KERNEL_WEBSOCKET_ALLOW_MISSING_ORIGIN === "1"
});

async function listen(server, port) {
  await new Promise((resolve, reject) => server.listen(port, "127.0.0.1", (error) => error ? reject(error) : resolve()));
}

async function start() {
  await websocket.start();
  await listen(pushHttpServer, 23000);
  await listen(server, 24000);
  console.log("server-runtime Phase 4.4 REST listening on 24000");
  console.log("server-runtime Phase 4.4 WebSocket listening on 23000");
}

start().catch((error) => {
  console.error(`server-runtime startup failed: ${error.message}`);
  process.exit(1);
});

async function shutdown() {
  mfs_transfer.destroy();
  representations.stop();
  await websocket.stop();
  await Promise.all([server, pushHttpServer].map((entry) => new Promise((resolve) => entry.close(() => resolve()))));
}

process.once("SIGTERM", () => { shutdown().finally(() => process.exit(0)); });
process.once("SIGINT", () => { shutdown().finally(() => process.exit(0)); });
