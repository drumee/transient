const assert = require("assert/strict");
const childProcess = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const workdir = fs.mkdtempSync(path.join(os.tmpdir(), "transient-phase45-"));
const npmCache = path.join(workdir, "npm-cache");

function run(command, args, options = {}) {
  const { env: envOverrides = {}, ...spawnOptions } = options;
  const env = { ...process.env, ...envOverrides };
  // node:test marks children so that nested Node processes report through the
  // parent test protocol. Commands such as npm are Node programs too; leaving
  // the marker set consumes their stdout and makes `npm pack --json` appear
  // successful but empty.
  delete env.NODE_TEST_CONTEXT;
  return childProcess.spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...spawnOptions,
    env: { ...env, NPM_CONFIG_CACHE: npmCache }
  });
}

function mustRun(command, args, options = {}) {
  const result = run(command, args, options);
  assert.equal(result.status, 0, `${command} ${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result;
}

function pack(source) {
  const output = path.join(workdir, "artifacts");
  fs.mkdirSync(output, { recursive: true });
  const before = new Set(fs.readdirSync(output));
  mustRun("npm", ["pack", "--json", "--ignore-scripts", "--pack-destination", output], { cwd: source });
  const created = fs.readdirSync(output).filter((entry) => entry.endsWith(".tgz") && !before.has(entry));
  assert.equal(created.length, 1, `npm pack produced ${created.length} new archives for ${source}`);
  const artifact = path.join(output, created[0]);
  // Under node:test, nested Node CLIs can report through the test protocol
  // instead of their captured stdout. Inspect the archive itself so the
  // assertion is about the shipped manifest, not npm's presentation layer.
  const manifest = JSON.parse(mustRun("tar", ["-xOzf", artifact, "package/package.json"]).stdout);
  return { name: manifest.name, version: manifest.version, filename: created[0], path: artifact };
}

function tarEntries(artifact) {
  return mustRun("tar", ["-tzf", artifact]).stdout.trim().split("\n").filter(Boolean);
}

function assertTarball(artifact, expected) {
  const entries = tarEntries(artifact.path);
  for (const entry of expected) assert.ok(entries.includes(`package/${entry}`), `${artifact.filename} omits ${entry}`);
  for (const entry of entries) {
    assert.doesNotMatch(entry, /^package\/(?:node_modules|sources|tests?|\.tmp|docs)\//, `${artifact.filename} includes forbidden ${entry}`);
  }
  return entries;
}

function installConsumer(name, artifact) {
  const consumer = fs.mkdtempSync(path.join(os.tmpdir(), `transient-phase45-${name}-consumer-`));
  fs.writeFileSync(path.join(consumer, "package.json"), JSON.stringify({ name: `phase45-${name}-consumer`, private: true }, null, 2));
  mustRun("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", artifact], { cwd: consumer });
  return consumer;
}

function installedScript(consumer, script) {
  const filename = path.join(consumer, "smoke.cjs");
  fs.writeFileSync(filename, `${script}\n`);
  return mustRun("node", [filename], {
    cwd: consumer,
    env: { NODE_PATH: "", PHASE45_CONSUMER: consumer }
  });
}

function externalDependencies(source) {
  const names = new Set();
  for (const filename of fs.readdirSync(source, { recursive: true })) {
    if (!filename.endsWith(".js")) continue;
    const text = fs.readFileSync(path.join(source, filename), "utf8");
    for (const match of text.matchAll(/require\((['"])([^'"]+)\1\)/g)) {
      if (!match[2].startsWith(".")) names.add(match[2]);
    }
  }
  return [...names].sort();
}

function assertDeclaredDependencies(packageRoot) {
  const manifest = require(path.join(packageRoot, "package.json"));
  const builtins = new Set(require("module").builtinModules);
  const declared = new Set(Object.keys(manifest.dependencies || {}));
  for (const dependency of externalDependencies(path.join(packageRoot, "lib"))) {
    if (builtins.has(dependency) || dependency.startsWith("node:")) continue;
    assert.ok(declared.has(dependency), `${manifest.name} does not declare runtime dependency ${dependency}`);
  }
}

test("Phase 4.5 packs, installs and starts the Phase 4.4 runtime only from tarballs", { timeout: 900000 }, (t) => {
  const serverRoot = path.join(root, "target/foundation/server-runtime");
  const uiRoot = path.join(root, "target/foundation/ui-runtime");
  const server = pack(serverRoot);
  const ui = pack(uiRoot);

  assert.equal(server.name, "@drumee/server-runtime-extraction");
  assert.equal(server.version, "0.0.0-phase4.5");
  assert.equal(ui.name, "@drumee/ui-runtime-extraction");
  assert.equal(ui.version, "0.0.0-phase4.5");
  const serverEntries = assertTarball(server, [
    "lib/index.js",
    "acl/bootstrap.json",
    "service/bootstrap.js",
    "schemas/SCHEMA_MANIFEST.json",
    "schemas/yellow-page/phase4-schema.sql",
    "schemas/yellow-page/phase4.4-websocket.sql"
  ]);
  const uiEntries = assertTarball(ui, ["src/index.js", "src/browser.js", "src/letc/skin/index.scss"]);

  const schema = JSON.parse(fs.readFileSync(path.join(serverRoot, "schemas/SCHEMA_MANIFEST.json"), "utf8"));
  assert.equal(schema.owner, server.name);
  assert.equal(schema.packageVersion, server.version);
  assert.equal(schema.upgrade.idempotent, true);
  assert.deepEqual(schema.install.map((entry) => entry.order), [10, 20]);
  assert.deepEqual(schema.objects.tables, [
    "domain", "sys_conf", "entity", "drumate", "cookie", "privilege", "authn", "socket"
  ]);
  assert.deepEqual(schema.objects.functions, ["uniqueId", "domain_permission"]);
  assert.deepEqual(schema.objects.procedures, [
    "session_signin", "session_ensure", "authn_store", "socket_bind", "socket_get",
    "socket_free", "socket_list_session", "socket_refresh"
  ]);
  assert.match(schema.upgrade.legacyOtakPolicy, /invalidate/);
  for (const entry of schema.install) {
    assert.ok(tarEntries(server.path).includes(`package/${entry.path}`), `schema manifest entry is absent from tarball: ${entry.path}`);
  }
  assert.doesNotMatch(JSON.stringify(schema), /(?:sources|target)\//, "schema manifest must be package-relative");
  const sourceCommit = mustRun("git", ["rev-parse", "HEAD"]).stdout.trim();
  t.diagnostic(`source=${sourceCommit} server=${server.filename} ui=${ui.filename} schema=${schema.schemaVersion}`);
  t.diagnostic(`server contents=${serverEntries.join(",")}`);
  t.diagnostic(`ui contents=${uiEntries.join(",")}`);

  assertDeclaredDependencies(serverRoot);
  const uiManifest = require(path.join(uiRoot, "package.json"));
  const uiDependencies = new Set(Object.keys(uiManifest.dependencies));
  for (const dependency of externalDependencies(path.join(uiRoot, "src"))) {
    if (new Set(require("module").builtinModules).has(dependency) || dependency.startsWith("node:")) continue;
    assert.ok(uiDependencies.has(dependency), `${uiManifest.name} does not declare runtime dependency ${dependency}`);
  }

  const serverConsumer = installConsumer("server", server.path);
  installedScript(serverConsumer, `
    const assert = require("assert/strict");
    const path = require("path");
    const resolved = require.resolve("@drumee/server-runtime-extraction");
    assert.ok(resolved.startsWith(path.join(process.env.PHASE45_CONSUMER, "node_modules") + path.sep));
    const runtime = require("@drumee/server-runtime-extraction");
    assert.equal(typeof runtime.createServiceServer, "function");
    assert.equal(typeof runtime.SessionManager, "function");
    assert.equal(typeof runtime.WebSocketPushRouter, "function");
  `);

  const uiConsumer = installConsumer("ui", ui.path);
  installedScript(uiConsumer, `
    const assert = require("assert/strict");
    const path = require("path");
    const resolved = require.resolve("@drumee/ui-runtime-extraction");
    assert.ok(resolved.startsWith(path.join(process.env.PHASE45_CONSUMER, "node_modules") + path.sep));
    const runtime = require("@drumee/ui-runtime-extraction");
    let registry;
    registry = new runtime.KindRegistry({
      bootstrapPlugin: async () => ({ path: "/-/plugins/packed/index.js" }),
      loadJS: async () => registry.registerAddons({ packed: class PackedWidget {} })
    });
    registry.setReady(Promise.resolve());
    registry.loadPlugin({ name: "packed", kind: "packed" }).then((Widget) => {
      assert.equal(typeof Widget, "function");
    }).catch((error) => { throw error; });
  `);

  const packageEnvironment = {
    KERNEL_BUILD_QUIET: "1",
    KERNEL_SERVER_RUNTIME_TGZ: server.path,
    KERNEL_UI_RUNTIME_TGZ: ui.path,
    // Do not contend with a developer's normal Phase 4.4 validation. Every
    // exportability run owns a separate disposable Docker namespace and port.
    KERNEL_CONTAINER: "transient-phase45-runtime",
    KERNEL_DB_CONTAINER: "transient-phase45-runtime-db",
    KERNEL_REDIS_CONTAINER: "transient-phase45-runtime-redis",
    KERNEL_NETWORK: "transient-phase45-runtime-net",
    KERNEL_HTTP_PORT: "28645"
  };
  // A previously interrupted artifact test may have left only its own
  // disposable namespace behind. Clear that namespace before claiming it.
  mustRun("scripts/test-env/kernel/down.sh", [], { env: packageEnvironment });
  // Each integration test starts its own disposable environment. `up.sh`
  // extracts only these archives below `.tmp/test-env/kernel/package-input`,
  // mounts the server package SQL, and Docker builds the runtime from that
  // extracted artifact rather than the target runtime directories.
  mustRun("node", ["--test", "tests/integration/kernel/phase4-authenticated-private.test.js"], {
    env: { ...packageEnvironment, KERNEL_SCHEMA_MODE: "clean" }
  });
  for (const schemaMode of ["clean", "upgrade"]) {
    mustRun("node", ["--test", "tests/integration/kernel/phase4.4-websocket-push.test.js"], {
      env: { ...packageEnvironment, KERNEL_SCHEMA_MODE: schemaMode }
    });
  }
});

test.after(() => {
  childProcess.spawnSync("scripts/test-env/kernel/down.sh", [], {
    cwd: root,
    encoding: "utf8",
    env: {
      ...process.env,
      KERNEL_CONTAINER: "transient-phase45-runtime",
      KERNEL_DB_CONTAINER: "transient-phase45-runtime-db",
      KERNEL_REDIS_CONTAINER: "transient-phase45-runtime-redis",
      KERNEL_NETWORK: "transient-phase45-runtime-net",
      KERNEL_HTTP_PORT: "28645"
    }
  });
  fs.rmSync(workdir, { recursive: true, force: true });
});
