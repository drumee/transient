"use strict";

const assert = require("assert/strict");
const child_process = require("child_process");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
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

function platform(operation) {
  const result = run("node", ["scripts/test-env/kernel/bootstrap-platform.js", operation, "kernel.test"]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

function runtime_implementation() {
  const package_root = path.join(root, "target/foundation/server-runtime");
  const files = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const filename = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(filename);
      else if (/\.(js|sql)$/.test(entry.name)) files.push(filename);
    }
  }
  visit(package_root);
  return files.map((filename) => fs.readFileSync(filename, "utf8")).join("\n");
}

test("Phase 4.6A bootstraps and validates a minimal platform without MFS", { timeout: 180000 }, async () => {
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"]);
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  try {
    const validation = platform("validate");
    assert.equal(validation.valid, true);
    assert.equal(validation.identities.nobody, "ffffffffffffffff");
    assert.match(validation.identities.guest, /^[a-f0-9]{16}$/);
    assert.match(validation.identities.system, /^[a-f0-9]{16}$/);
    assert.notEqual(validation.identities.guest, validation.identities.nobody);
    assert.notEqual(validation.identities.system, validation.identities.nobody);
    assert.notEqual(validation.identities.system, validation.identities.guest);

    const before = db("SELECT CONCAT((SELECT id FROM organisation WHERE sys_id=1),'|',(SELECT conf_value FROM sys_conf WHERE conf_key='guest_id'),'|',(SELECT id FROM drumate WHERE username='system' AND domain_id=1),'|',(SELECT COUNT(*) FROM drumate))");
    const rerun = platform("bootstrap");
    assert.equal(rerun.after.changed, false);
    assert.equal(db("SELECT CONCAT((SELECT id FROM organisation WHERE sys_id=1),'|',(SELECT conf_value FROM sys_conf WHERE conf_key='guest_id'),'|',(SELECT id FROM drumate WHERE username='system' AND domain_id=1),'|',(SELECT COUNT(*) FROM drumate))"), before);

    assert.equal(db("SELECT COUNT(*) FROM domain WHERE id=1 AND name='kernel.test'"), "1");
    assert.equal(db("SELECT COUNT(*) FROM organisation WHERE sys_id=1 AND domain_id=1 AND link='kernel.test'"), "1");
    assert.equal(db("SELECT COUNT(*) FROM sys_conf WHERE conf_key IN ('public_id','domain_name','mfs_root','sys_root')"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yp' AND (table_name LIKE 'mfs%' OR table_name IN ('hub','dmz_user','map_role'))"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema='yp' AND routine_name IN ('mfs_init_folders','desk_create_hub')"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'd\\_%'"), "0");

    const response = await fetch(`${base_url}/-/svc/bootstrap.authn`, {
      method: "POST", headers: { "content-type": "application/json" }, body: "{}"
    });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.match(payload.data.token, /^[A-Za-z0-9_-]{22}$/);
    const cookie = response.headers.get("set-cookie");
    assert.match(cookie, /^regsid=/);
    const sid = cookie.match(/^regsid=([^;]+)/)[1];
    assert.equal(db(`SELECT uid FROM cookie WHERE id='${sid}'`), "ffffffffffffffff");

    const restart = run("docker", ["restart", container]);
    assert.equal(restart.status, 0, restart.stderr);
    let ready = false;
    for (let attempt = 0; attempt < 30; attempt++) {
      try {
        const status = await fetch(`${base_url}/-/svc/kernel.status`);
        if (status.ok) { ready = true; break; }
      } catch (_) {}
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    assert.equal(ready, true);
    assert.equal(db("SELECT CONCAT((SELECT id FROM organisation WHERE sys_id=1),'|',(SELECT conf_value FROM sys_conf WHERE conf_key='guest_id'),'|',(SELECT id FROM drumate WHERE username='system' AND domain_id=1),'|',(SELECT COUNT(*) FROM drumate))"), before);

    const runtime = runtime_implementation();
    assert.doesNotMatch(runtime, /INSERT\s+INTO\s+(organisation|drumate|privilege)/i);
    assert.doesNotMatch(runtime, /createNobody|createGuest|createSystemUser/i);
  } finally {
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});
