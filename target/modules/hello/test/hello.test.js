const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const {
  DescriptorRegistry,
  DomainAuthorizer,
  ServiceDispatcher,
  authorizeFastPath,
  createAuthorizer,
  createServiceServer
} = require("../../../foundation/server-runtime/lib");
const { KindRegistry, LetcBox } = require("../../../foundation/ui-runtime/src");
const { permissionValue } = require("../../../../sources/server-essentials/lib/lex/permission");

const helloRoot = path.join(__dirname, "..");
const workerPath = path.join(helloRoot, "server/service/hello.js");

function helloRegistry() {
  const registry = new DescriptorRegistry({ permissionValue });
  registry.registerDirectory(path.join(helloRoot, "server/acl"));
  return registry;
}

test("hello.ping is discovered through acl JSON, uses public-api and lazily caches its WorkerClass", async () => {
  const registry = helloRegistry();
  const loads = [];
  const dispatcher = new ServiceDispatcher({
    registry,
    authorize: authorizeFastPath,
    requireWorker: (file) => {
      loads.push(file);
      return require(file);
    }
  });
  const session = { isAnonymous: () => true };
  assert.equal(loads.length, 0);
  assert.deepEqual(registry.resolve("hello.ping", session).permission.fast_check, "public-api");
  const first = await dispatcher.dispatch({ service: "hello.ping", session, input: {} });
  const second = await dispatcher.dispatch({ service: "hello.ping", session, input: {} });
  assert.deepEqual(first, { ok: true, message: "Hello from Drumee", module: "hello" });
  assert.deepEqual(second, first);
  assert.deepEqual(loads, [workerPath]);
});

test("hello does not bypass ACL when the public-api descriptor is absent", async () => {
  const registry = new DescriptorRegistry({ permissionValue });
  registry.registerDescriptor("denied", {
    services: { ping: { scope: "kernel", permission: { src: "anonymous" } } },
    modules: { public: workerPath }
  });
  const dispatcher = new ServiceDispatcher({ registry, authorize: authorizeFastPath });
  await assert.rejects(
    dispatcher.dispatch({ service: "denied.ping", session: { isAnonymous: () => true }, input: {} }),
    (error) => error.code === "PERMISSION_DENIED"
  );
});

test("hello.private explicitly uses the Domain ACL path and remains lazy", async () => {
  const registry = helloRegistry();
  const calls = [];
  const authorize = createAuthorizer({
    domainAuthorizer: new DomainAuthorizer({
      store: {
        async domainPermission(uid, domainId, permission) {
          calls.push({ uid, domainId, permission });
          return 2;
        }
      }
    })
  });
  const loads = [];
  const dispatcher = new ServiceDispatcher({
    registry,
    authorize,
    requireWorker(file) {
      loads.push(file);
      return require(file);
    }
  });
  const anonymous = { isAnonymous: () => true };
  await assert.rejects(
    dispatcher.dispatch({ service: "hello.private", session: anonymous, input: {} }),
    (error) => error.code === "PERMISSION_DENIED"
  );
  assert.deepEqual(loads, []);

  const session = {
    isAnonymous: () => false,
    identity: () => ({ id: "phase4authuser01", domainId: 41 })
  };
  const result = await dispatcher.dispatch({ service: "hello.private", session, input: {} });
  assert.deepEqual(result, {
    ok: true,
    authenticated: true,
    module: "hello",
    scope: "domain",
    identity: { id: "phase4authuser01" }
  });
  assert.deepEqual(registry.resolve("hello.private", session).permission, { src: permissionValue("read"), scope: "domain" });
  assert.deepEqual(calls, [{ uid: "phase4authuser01", domainId: 41, permission: permissionValue("read") }]);
  assert.deepEqual(loads, [workerPath]);
});

test("hello.push uses the existing private Domain ACL and the generic runtime push API", async () => {
  const registry = helloRegistry();
  const published = [];
  const dispatcher = new ServiceDispatcher({
    registry,
    authorize: createAuthorizer({
      domainAuthorizer: new DomainAuthorizer({
        store: { async domainPermission() { return permissionValue("read"); } }
      })
    }),
    workerOptions: {
      push: {
        async publish(args) {
          published.push(args);
          return { published: true, service: args.service, recipients: 1 };
        }
      }
    }
  });
  await assert.rejects(
    dispatcher.dispatch({ service: "hello.push", session: { isAnonymous: () => true }, input: {} }),
    (error) => error.code === "PERMISSION_DENIED"
  );
  const result = await dispatcher.dispatch({
    service: "hello.push",
    session: {
      sid: "real-session",
      isAnonymous: () => false,
      identity: () => ({ id: "phase4authuser01", domainId: 41 })
    },
    input: {}
  });
  assert.deepEqual(result, { ok: true, module: "hello", scope: "domain", published: true, service: "hello.push", recipients: 1 });
  assert.deepEqual(published, [{
    service: "hello.push",
    sessionId: "real-session",
    data: { message: "Hello over WebSocket" }
  }]);
});

test("hello.ping reaches the generic HTTP adapter with a POST body and returns the standard envelope", async () => {
  const observed = [];
  const server = createServiceServer({
    dispatcher: new ServiceDispatcher({ registry: helloRegistry(), authorize: authorizeFastPath }),
    onDispatch: ({ service, input }) => observed.push({ service, input })
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    const response = await fetch(`http://127.0.0.1:${address.port}/-/svc/hello.ping`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ probe: "browser-compatible" })
    });
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      status: "ok",
      data: { ok: true, message: "Hello from Drumee", module: "hello" }
    });
    assert.deepEqual(observed, [{ service: "hello.ping", input: { probe: "browser-compatible" } }]);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("hello bundle uses the normal addon registration contract and has no legacy KIND", () => {
  const originalKind = global.Kind;
  const originalLetcBox = global.LetcBox;
  const pluginPath = require.resolve("../ui");
  const kind = new KindRegistry();
  try {
    global.Kind = kind;
    global.LetcBox = LetcBox;
    delete require.cache[pluginPath];
    require(pluginPath);
    const HelloWidget = kind.get("hello");
    assert.equal(typeof HelloWidget, "function");
    assert.ok(HelloWidget.prototype instanceof LetcBox);
    assert.doesNotMatch(fs.readFileSync(path.join(helloRoot, "ui/index.js"), "utf8"), /KIND\s*\./);
  } finally {
    delete require.cache[pluginPath];
    if (originalKind === undefined) delete global.Kind;
    else global.Kind = originalKind;
    if (originalLetcBox === undefined) delete global.LetcBox;
    else global.LetcBox = originalLetcBox;
  }
});
