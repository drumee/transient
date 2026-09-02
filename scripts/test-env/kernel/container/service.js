const {
  DescriptorRegistry,
  ServiceDispatcher,
  createServiceServer
} = require("/opt/kernel/server-runtime/lib");
const { permissionValue } = require("/opt/kernel/server-essentials/lib/lex/permission");

const registry = new DescriptorRegistry({ permissionValue });
registry.registerDescriptor("kernel", {
  services: {
    status: {
      scope: "kernel",
      permission: { src: "anonymous", fast_check: "public-api" }
    }
  },
  modules: { public: "fixture-worker" }
}, { workdir: __dirname });

const dispatcher = new ServiceDispatcher({ registry });
const server = createServiceServer({ dispatcher });
server.listen(24000, "127.0.0.1", () => console.log("server-runtime Phase 2 probe listening on 24000"));
