const http = require("http");
const {
  DescriptorRegistry,
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
const sessionManager = new SessionManager({ store: yellowPageStore });
const authorize = createAuthorizer({ domainAuthorizer: new DomainAuthorizer({ store: yellowPageStore }) });
global.endpointAddress = process.env.KERNEL_PUSH_ENDPOINT || "kernel-runtime:23000";
const push = new PushBus({ redisStore: RedisStore, socketStore: yellowPageStore });
const websocketAllowedOrigins = (process.env.KERNEL_WEBSOCKET_ALLOWED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const dispatcher = new ServiceDispatcher({ registry, authorize, workerOptions: { pluginResolver, push } });
const server = createServiceServer({
  dispatcher,
  sessionFactory: (request) => sessionManager.fromRequest(request),
  allowedOrigins: websocketAllowedOrigins,
  onDispatch: ({ service }) => console.log(`kernel dispatched ${service}`)
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
