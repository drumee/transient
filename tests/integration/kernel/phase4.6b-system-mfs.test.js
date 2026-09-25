"use strict";

const assert = require("assert/strict");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const module_root = process.env.KERNEL_SYSTEM_MFS_ROOT || path.resolve(root, "../system-mfs");
const base_url = `http://127.0.0.1:${process.env.KERNEL_HTTP_PORT || "28642"}`;
const container = process.env.KERNEL_CONTAINER || "transient-kernel-phase2";
const database = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";

function run(command, args, options = {}) {
  return child_process.spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
}

function db(sql) {
  const result = run("docker", [
    "exec", "-e", `MYSQL_PWD=${process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root"}`,
    database, "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "yp",
    "--batch", "--skip-column-names", "--execute", sql
  ]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

function mfs(operation, principal_id) {
  const args = ["scripts/test-env/kernel/system-mfs.js", operation];
  if (principal_id) args.push(principal_id, "1");
  const result = run("node", args);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function installModule() {
  const create_root = run("docker", ["exec", "--user", "root", container, "mkdir", "-p", "/opt/kernel/system-mfs"]);
  assert.equal(create_root.status, 0, create_root.stderr);
  for (const entry of ["lib", "schemas", "package.json"]) {
    const copy_entry = run("docker", ["cp", path.join(module_root, entry), `${container}:/opt/kernel/system-mfs/${entry}`]);
    assert.equal(copy_entry.status, 0, copy_entry.stderr);
  }
}

async function post(service, body) {
  const response = await fetch(`${base_url}/-/svc/${service}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

test("Phase 4.6B keeps kernel boot independent and adds explicit real MFS capability", { timeout: 240000 }, async () => {
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"]);
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  try {
    assert.equal(db("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yp' AND table_name LIKE 'system_mfs%'"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'mfs\\_%'"), "0");
    const module_absent = run("docker", ["exec", container, "test", "!", "-e", "/opt/kernel/system-mfs"]);
    assert.equal(module_absent.status, 0, module_absent.stderr);

    const principal_id = db("SELECT id FROM drumate WHERE username='system' AND domain_id=1");
    assert.match(principal_id, /^[a-f0-9]{16}$/);
    const placeholders = db(`SELECT CONCAT(db_name,'|',home_dir,'|',IFNULL(home_id,'NULL')) FROM entity WHERE id='${principal_id}'`);
    assert.match(placeholders, /^identity_[a-f0-9]{16}\|\/platform-identities\/[a-f0-9]{16}\|NULL$/);

    const authn = await post("bootstrap.authn", {});
    assert.equal(authn.response.status, 200);
    assert.match(authn.payload.data.token, /^[A-Za-z0-9_-]{22}$/);
    const sid = authn.response.headers.get("set-cookie").match(/^regsid=([^;]+)/)[1];
    assert.equal(db(`SELECT uid FROM cookie WHERE id='${sid}'`), "ffffffffffffffff");

    const absent = await post("mfs-proof.probe", { organisation_id: 1, principal_id, parent_id: "unknown" });
    assert.equal(absent.response.status, 500);
    assert.equal(absent.payload.code, "CAPABILITY_UNAVAILABLE");

    installModule();
    assert.equal(mfs("validate-installation").status, "not-installed");
    assert.equal(mfs("install").changed, true);
    assert.equal(mfs("install").changed, false);
    assert.equal(mfs("validate", principal_id).status, "installed");
    assert.equal(db(`SELECT CONCAT(db_name,'|',home_dir,'|',IFNULL(home_id,'NULL')) FROM entity WHERE id='${principal_id}'`), placeholders);

    const first = mfs("provision", principal_id);
    assert.equal(first.valid, true);
    assert.equal(first.changed, true);
    const exercise = mfs("exercise", principal_id);
    assert.equal(exercise.created.nid, exercise.resolved.nid);
    assert.ok(exercise.children.some((node) => node.nid === exercise.created.nid));

    const present = await post("mfs-proof.probe", { organisation_id: 1, principal_id, parent_id: first.root_id, name: "RuntimeProof" });
    assert.equal(present.response.status, 200);
    assert.equal(present.payload.status, "ok");
    assert.equal(present.payload.data.created.nid, present.payload.data.resolved.nid);

    const resource_snapshot = db(`SELECT CONCAT((SELECT root_id FROM system_mfs_provisioning WHERE principal_id='${principal_id}'),'|',(SELECT COUNT(*) FROM mfs_${principal_id}.media),'|',(SELECT COUNT(*) FROM mfs_${principal_id}.permission))`);
    const restart = run("docker", ["restart", container]);
    assert.equal(restart.status, 0, restart.stderr);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        if ((await fetch(`${base_url}/-/svc/kernel.status`)).ok) { ready = true; break; }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(ready, true);
    assert.equal(mfs("validate", principal_id).status, "provisioned");
    assert.equal(mfs("provision", principal_id).changed, false);
    assert.equal(db(`SELECT CONCAT((SELECT root_id FROM system_mfs_provisioning WHERE principal_id='${principal_id}'),'|',(SELECT COUNT(*) FROM mfs_${principal_id}.media),'|',(SELECT COUNT(*) FROM mfs_${principal_id}.permission))`), resource_snapshot);
    assert.equal(db(`SELECT CONCAT(db_name,'|',home_dir,'|',IFNULL(home_id,'NULL')) FROM entity WHERE id='${principal_id}'`), placeholders);
  } finally {
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});

test("system-mfs stays module-relative and excludes forbidden ownership", () => {
  assert.equal(require(path.join(module_root, "package.json")).name, "@drumee/system-mfs");
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else files.push(filename);
    }
  }
  for (const directory of ["lib", "schemas"]) visit(path.join(module_root, directory));
  const implementation = files.map((filename) => fs.readFileSync(filename, "utf8")).join("\n");
  assert.doesNotMatch(implementation, /require\([^)]*sources\/|NODE_PATH|server-team|ui-team|desk_create_hub|createHub|\/data\/mfs/i);
});
