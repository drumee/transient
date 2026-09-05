const {
  DescriptorRegistry,
  FrontendPluginResolver,
  ServiceDispatcher,
  createServiceServer
} = require("/opt/kernel/server-runtime/lib");
const { permissionValue } = require("/opt/kernel/server-essentials/lib/lex/permission");

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
const dispatcher = new ServiceDispatcher({ registry, workerOptions: { pluginResolver } });
const server = createServiceServer({
  dispatcher,
  onDispatch: ({ service }) => console.log(`kernel dispatched ${service}`)
});
server.listen(24000, "127.0.0.1", () => console.log("server-runtime Phase 2 probe listening on 24000"));
