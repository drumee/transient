"use strict";
// Approved real-kernel distribution fixture. No Team or permissive auth stores.
const fs = require("node:fs"), path = require("node:path"), os = require("node:os"), crypto = require("node:crypto"), net = require("node:net");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, "../../../target/distributions/minimal-kernel-il3");
const load = name => require(require.resolve(name, { paths: [root] }));
const assert = require("node:assert/strict");
const lifecycle = load("@drumee/infra-layer/lifecycle");
const driver = require(path.join(root, "lib/distribution-driver"));
const { compose, images } = require(path.join(root, "lib/distribution"));
function command(args, options = {}) {
  const result = spawnSync(args[0], args.slice(1), { encoding: "utf8", timeout: 600000, maxBuffer: 4 * 1024 * 1024, ...options });
  if (result.error || result.status !== 0) throw Object.assign(Error("FIXTURE_COMMAND_FAILED"), { code: "FIXTURE_COMMAND_FAILED", command: args.slice(0, 2) });
  return result.stdout;
}
const freePort = () => new Promise(resolve => { const server = net.createServer(); server.listen(0, "127.0.0.1", () => { const port = server.address().port; server.close(() => resolve(port)); }); });
async function run() {
  const project = "drumee-il3-kernel-" + crypto.randomBytes(4).toString("hex");
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), project + "-")); fs.chmodSync(directory, 0o700);
  const deployment_root = path.join(directory, "deployment");
  const image = "drumee-il3-kernel-fixture:" + project, tools = "drumee-il3-kernel-tools:" + project;
  let prepared, restored, composition; const built = [];
  try {
    assert.equal(command(["docker", "ps", "-a", "--filter", "label=com.docker.compose.project=" + project, "--format", "{{.ID}}"] ).trim(), "");
    for (const tag of [image, tools]) assert.notEqual(spawnSync("docker", ["image", "inspect", tag], { stdio: "ignore" }).status, 0, "Image collision");
    command(["node", path.join(root, "scripts/sources.js")], { stdio: "inherit" });
    command(["node", path.join(root, "scripts/browser.js")], { stdio: "inherit" });
    for (const ref of Object.values(images)) command(["docker", "pull", ref], { stdio: "pipe" });
    command(["docker", "build", "--label", "org.drumee.infra.owner=" + project, "-t", image, root], { stdio: "inherit" }); built.push(image);
    const infra_root = path.dirname(require.resolve("@drumee/infra-layer/package.json", { paths: [root] }));
    command(["docker", "build", "--label", "org.drumee.infra.owner=" + project, "-t", tools, "-f", path.join(infra_root, "capabilities/docker/Dockerfile.services"), infra_root], { stdio: "inherit" }); built.push(tools);
    const image_id = command(["docker", "image", "inspect", image, "--format", "{{.Id}}"] ).trim();
    const tools_id = command(["docker", "image", "inspect", tools, "--format", "{{.Id}}"] ).trim();
    const source_revision = command(["git", "-C", root, "rev-parse", "HEAD"] ).trim();
    const https_port = process.env.IL3_HTTPS_PORT ? Number(process.env.IL3_HTTPS_PORT) : await freePort();
    const dns_port = process.env.IL3_DNS_PORT ? Number(process.env.IL3_DNS_PORT) : await freePort();
    const address = process.env.IL3_BIND_ADDRESS || "127.0.0.1";
    composition = compose({ root: deployment_root, project, image: image_id, tools_image: tools_id, https_port, dns_port, address, source_revision });
    const context = { root: deployment_root, authorized: true, create_resources: true, driver };
    prepared = await lifecycle.prepareDeployment(composition, context);
    fs.cpSync(path.join(root, "public"), path.join(deployment_root, "durable/public"), { recursive: true });
    // Scoped public/artifact views must be searchable by rootless Nginx 101.
    // The deployment ancestor remains operator-private and no secret is here.
    fs.chmodSync(path.join(deployment_root, "durable/public"), 0o755);
    fs.chmodSync(path.join(deployment_root, "durable/content"), 0o755);
    assert.equal((await lifecycle.activateDeployment(prepared, context)).ready, true);
    console.log("REAL_KERNEL_ACTIVATED");
    const acceptance = require("./acceptance");
    const baseline = await acceptance.verify({ prepared, directory, driver });
    assert.equal((await lifecycle.activateDeployment(prepared, context)).effect, "no-op");
    driver.compose(prepared, ["restart", "database", "redis", "kernel"]);
    // Restart invalidates attestation; explicit reconciliation is required.
    assert.equal((await lifecycle.inspectDeployment(deployment_root, context)).ready, false);
    assert.equal((await lifecycle.activateDeployment(prepared, { ...context, recover: true })).ready, true);
    await acceptance.verify({ prepared, directory, driver, baseline });
    console.log("REAL_KERNEL_RESTART_PRESERVED");
    const backup_root = path.join(directory, "backup");
    await lifecycle.backupDeployment(deployment_root, backup_root, { ...context, quiescence: "stop-owned-writers", resume_after_backup: false });
    const restored_root = path.join(directory, "restored"), restored_project = project + "-restored";
    const restored_composition = compose({ root: restored_root, project: restored_project, image: image_id, tools_image: tools_id, https_port: await freePort(), dns_port: await freePort(), source_revision });
    const restore_context = { ...context, root: restored_root };
    const result = await lifecycle.restoreDeployment(backup_root, restored_composition, restore_context); restored = result.prepared;
    assert.equal(result.kernel_recovery_verified, false);
    assert.equal((await lifecycle.activateDeployment(restored, restore_context)).ready, true);
    await acceptance.verify({ prepared: restored, directory, driver, baseline });
    console.log("REAL_KERNEL_ISOLATED_RECOVERY_VERIFIED");
    const report = { project, source_revision, composition_revision: composition.revision, image_id, tools_id, https_port, dns_port, real_kernel: true, restart: true, isolated_recovery: true, ca_fingerprint: baseline.ca_fingerprint };
    fs.writeFileSync(path.join(directory, "report.json"), JSON.stringify(report, null, 2), { mode: 0o600 });
    console.log(JSON.stringify(report));
  } catch (error) {
    console.error(JSON.stringify({ code: error.code || "FIXTURE_ACCEPTANCE_FAILED", command: error.command || null, assertion: error.code === "ERR_ASSERTION" ? error.message.slice(0, 150) : null }));
    if (prepared) {
      const events = load("@drumee/infra-layer/lifecycle/journal").readJournal(prepared.root);
      console.error(JSON.stringify(events.filter(value => value.phase === "activation-failed").map(value => ({ phase: value.phase, details: value.details }))));
      // Fixture code emits stable codes only; no credentials or SQL are logged.
      for (const name of ["kernel-init", "kernel"]) {
        try { console.error(driver.compose(prepared, ["logs", "--tail", "5", name])); } catch (_) {}
      }
    }
    throw error;
  } finally {
    for (const owned of [restored, prepared].filter(Boolean)) {
      driver.inspectProject(owned.project, Object.keys(owned.compose.services));
      driver.compose(owned, ["down", "--remove-orphans"]);
      driver.helper(owned.composition, owned.root, "const fs=require('node:fs');for(const name of fs.readdirSync('/work'))fs.rmSync('/work/'+name,{recursive:true,force:true});", [], true);
      fs.rmdirSync(owned.root);
    }
    if (composition && fs.existsSync(path.join(directory, "backup"))) {
      driver.helper(composition, path.join(directory, "backup"), "const fs=require('node:fs');for(const name of fs.readdirSync('/work'))fs.rmSync('/work/'+name,{recursive:true,force:true});", [], true);
      fs.rmdirSync(path.join(directory, "backup"));
    }
    for (const tag of built) {
      assert.equal(command(["docker", "image", "inspect", tag, "--format", '{{index .Config.Labels "org.drumee.infra.owner"}}']).trim(), project);
      command(["docker", "image", "rm", tag]);
    }
    console.log("OWNED_FIXTURE_RESOURCES_CLEANED " + directory);
  }
}
run().catch(() => { process.exitCode = 1; });
