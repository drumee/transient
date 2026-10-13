"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const { planInfrastructure, renderPlan } = require("../../lib");
const { inputs } = require("../support/inputs");
const { buildBrowser } = require("./build-browser");
const { prepareKernel } = require("./prepare-kernel");
const module_directory = path.resolve(__dirname, "../..");

function command(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout: 300000, maxBuffer: 8 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(`${args[0]} ${args[1]} failed (${result.status}): ${result.stderr || result.stdout}`);
  return result.stdout;
}
function freePort() { return new Promise((resolve) => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); }); }
async function main() {
  for (const file of ["kernel-fixture.js", "gateway.test.js", "browser-entry.js", "build-browser.js"]) command([process.execPath, "--check", path.join(__dirname, file)]);
  const project = process.env.IL1_PROJECT || `drumee-il1-test-${crypto.randomBytes(4).toString("hex")}`;
  if (!/^drumee-il1-test-[a-z0-9-]{1,30}$/.test(project)) throw new Error("DEDICATED_TEST_PROJECT_REQUIRED");
  command(["docker", "version", "--format", "{{.Server.Version}}"]);
  if (command(["docker", "ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}"] ).trim()) throw new Error("TEST_PROJECT_ALREADY_EXISTS");
  const network_name = `${project}-kernel`;
  if (spawnSync("docker", ["network", "inspect", network_name], { stdio: "ignore" }).status === 0) throw new Error("TEST_NETWORK_ALREADY_EXISTS");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `${project}-`)); fs.chmodSync(directory, 0o755);
  try {
  const root = prepareKernel(directory, module_directory);
  const port = await freePort();
  const fixtures = path.join(directory, "fixtures");
  fs.mkdirSync(path.join(fixtures, "artifacts"), { recursive: true }); fs.mkdirSync(path.join(fixtures, "incoming"));
  await buildBrowser(root, fixtures);
  fs.symlinkSync("/etc/passwd", path.join(fixtures, "public/static/escape"));
  const value = inputs(fixtures, port); value.adapter_input.project = project; value.adapter_input.network = network_name;
  const plan = planInfrastructure(value.spec, value.requirements, value.adapter_input);
  assert.equal(plan.applicable, true);
  const rendered = path.join(directory, "rendered"); renderPlan(plan, rendered);
  const plan_file = path.join(directory, "plan.json"); fs.writeFileSync(plan_file, JSON.stringify(plan));
  const compose = JSON.parse(fs.readFileSync(path.join(rendered, "gateway.compose.json")));
  // Only the harness creates the test network and adds its composition fixture.
  // A dedicated bridge is isolated by project membership. Docker 29's internal
  // networks suppress published-port ingress, so this network is not internal:true.
  // Only the gateway publishes a port, and only on host loopback.
  compose.networks.kernel = { name: network_name };
  const image = `drumee-il1-kernel-test:${project}`;
  if (spawnSync("docker", ["image", "inspect", image], { stdio: "ignore" }).status === 0) throw new Error("TEST_IMAGE_ALREADY_EXISTS");
  compose.services.kernel = {
    image, networks: ["kernel"], read_only: true, user: `${process.getuid()}:${process.getgid()}`,
    cap_drop: ["ALL"], security_opt: ["no-new-privileges:true"],
    volumes: [{ type: "bind", source: fixtures, target: "/fixture", bind: { create_host_path: false } }],
    tmpfs: ["/tmp:rw,noexec,nosuid,size=16777216"], labels: { "org.drumee.infra.owner": project },
    healthcheck: { test: ["CMD", "node", "-e", "fetch('http://127.0.0.1:3102/__ready').then(r=>process.exit(r.status===200?0:1)).catch(()=>process.exit(1))"], interval: "2s", timeout: "2s", retries: 20 },
    mem_limit: "256m", pids_limit: 64
  };
  compose.services.gateway.depends_on = { kernel: { condition: "service_healthy" } };
  const compose_file = path.join(rendered, "test.compose.json"); fs.writeFileSync(compose_file, JSON.stringify(compose, null, 2));
  const context = path.join(directory, "build"); fs.mkdirSync(context);
  for (const component of ["foundation/server-runtime", "modules/hello/server", "modules/host-filesystem", "modules/media-service", "modules/mfs-service", "modules/mfs-transfer", "modules/infra-layer/test/integration"]) {
    fs.cpSync(path.join(root, "target", component), path.join(context, "target", component), { recursive: true, filter: (file) => !file.split(path.sep).includes("node_modules") });
  }
  fs.cpSync(path.join(module_directory, "node_modules"), path.join(context, "target/modules/infra-layer/node_modules"), { recursive: true });
  fs.mkdirSync(path.join(context, "sources/server-essentials/lib/lex"), { recursive: true });
  for (const file of ["permission.js", "functions.js"]) fs.copyFileSync(path.join(root, "sources/server-essentials/lib/lex", file), path.join(context, "sources/server-essentials/lib/lex", file));
  fs.copyFileSync(path.join(__dirname, "Dockerfile.kernel"), path.join(context, "Dockerfile"));
  const docker = (...args) => command(["docker", "compose", "-p", project, "-f", compose_file, ...args]);
  let started = false;
  console.log(JSON.stringify({ project, port, directory, revision: plan.revision, image, network: network_name }));
  try {
    docker("config", "-q");
    command(["docker", "build", "--label", `org.drumee.infra.owner=${project}`, "-t", image, context], { stdio: "inherit" });
    started = true; docker("up", "-d", "--wait", "--wait-timeout", "60", "kernel");
    docker("run", "--rm", "--no-deps", "gateway", "-t");
    docker("up", "-d", "--wait", "--wait-timeout", "60");
    docker("exec", "-T", "gateway", "nginx", "-t");
    const gateway_id = docker("ps", "-q", "gateway").trim();
    const kernel_id = docker("ps", "-q", "kernel").trim();
    const result = spawnSync(process.execPath, ["--test", path.join(__dirname, "gateway.test.js")], { stdio: "inherit", timeout: 180000, env: { ...process.env, IL1_PORT: String(port), IL1_GATEWAY_ID: gateway_id, IL1_KERNEL_ID: kernel_id, IL1_REVISION: plan.revision, IL1_FIXTURES: fixtures, IL1_PLAN: plan_file } });
    if (result.status !== 0) throw new Error("GATEWAY_INTEGRATION_FAILED");
    const logs = docker("logs", "--no-color");
    assert.doesNotMatch(logs, /otak=|regsid=|isolated-fixture-password|outside-protected-view|\/__drumee_artifacts\//);
    console.log("IL1 logs: no session, OTAK, password or protected content disclosure");
  } catch (error) {
    if (started) console.error(docker("logs", "--no-color").slice(-10000));
    throw error;
  } finally {
    if (started) docker("down");
    assert.equal(command(["docker", "ps", "-a", "--filter", `label=com.docker.compose.project=${project}`, "--format", "{{.ID}}"] ).trim(), "");
    assert.notEqual(spawnSync("docker", ["network", "inspect", network_name], { stdio: "ignore" }).status, 0);
    if (spawnSync("docker", ["image", "inspect", image], { stdio: "ignore" }).status === 0) command(["docker", "image", "rm", image]);
    console.log(`IL1 cleanup confirmed: ${project}; no volumes created`);
  }
  } finally { if (process.env.IL1_KEEP_OUTPUT !== "1") fs.rmSync(directory, { recursive: true, force: true }); }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
