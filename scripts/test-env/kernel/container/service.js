const {
  DescriptorRegistry,
  DomainAuthorizer,
  FrontendPluginResolver,
  SessionManager,
  ServiceDispatcher,
  YellowPageStore,
  createAuthorizer,
  createServiceServer
} = require("/opt/kernel/server-runtime/lib");
const { permissionValue } = require("/opt/kernel/server-essentials/lib/lex/permission");
const Mariadb = require("/opt/kernel/server-essentials/lib/mariadb");

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
const dispatcher = new ServiceDispatcher({ registry, authorize, workerOptions: { pluginResolver } });
const server = createServiceServer({
  dispatcher,
  sessionFactory: (request) => sessionManager.fromRequest(request),
  onDispatch: ({ service }) => console.log(`kernel dispatched ${service}`)
});
server.listen(24000, "127.0.0.1", () => console.log("server-runtime Phase 2 probe listening on 24000"));
