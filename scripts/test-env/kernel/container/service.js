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
const authorize = createAuthorizer({ domainAuthorizer: new DomainAuthorizer({ store: yellowPageStore }) });
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
        store, context: { organisation_id: Number(input.organisation_id || 1), principal_id: input.principal_id }
      });
    }
  }
});
const dispatcher = new ServiceDispatcher({ registry, authorize, capability_resolver, workerOptions: { pluginResolver, push, resolveMfsStore } });
const server = createServiceServer({
  dispatcher,
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
  await websocket.stop();
  await Promise.all([server, pushHttpServer].map((entry) => new Promise((resolve) => entry.close(() => resolve()))));
}

process.once("SIGTERM", () => { shutdown().finally(() => process.exit(0)); });
process.once("SIGINT", () => { shutdown().finally(() => process.exit(0)); });
