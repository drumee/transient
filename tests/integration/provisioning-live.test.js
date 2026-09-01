const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { resolveRepo } = require("../helpers/repository");

const armed = process.env.DRUMEE_TEST_ALLOW_DESTRUCTIVE === "YES_I_ACCEPT_DISPOSABLE_DATA_LOSS";
const email = process.env.DRUMEE_TEST_USER_EMAIL || "";
const hubName = process.env.DRUMEE_TEST_HUB_NAME || "";
const cli = resolveRepo("sources/cli/bin/drumee.js");

function guard() {
  assert.equal(armed, true, "destructive guard is not armed");
  assert.match(email, /^phase1[-+].+@.+\.test$/i, "email must be a phase1 .test fixture");
  assert.match(hubName, /^phase1[-_]/i, "hub name must start phase1-/phase1_");
  assert.match(process.env.DRUMEE_TEST_STORAGE_ROOT || "", /phase1/i, "storage root must contain phase1");
}

function run(args, expected = 0) {
  const result = spawnSync(process.execPath, [cli, "--json", ...args], { encoding: "utf8", env: process.env });
  assert.equal(result.status, expected, `${args.join(" ")}\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("CLI DB backend read/list and invalid-entity behavior", { skip: !process.env.DRUMEE_TEST_DB_INTEGRATION }, () => {
  run(["user", "list"]);
  run(["hub", "list"]);
  run(["settings", "list"]);
  const invalid = spawnSync(process.execPath, [cli, "--json", "mfs", "ls", "--entity", "phase1-does-not-exist"], { encoding: "utf8", env: process.env });
  assert.notEqual(invalid.status, 0);
  assert.match(`${invalid.stdout}${invalid.stderr}`, /Unknown entity/i);
});

test("disposable drumate, hub, MFS round-trip, and purge lifecycle", { skip: !armed }, (t) => {
  guard();
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase1-live-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const input = path.join(temp, "input");
  const output = path.join(temp, "output");
  fs.mkdirSync(path.join(input, "nested"), { recursive: true });
  fs.writeFileSync(path.join(input, "hello.txt"), "phase1 fixture\n");
  fs.writeFileSync(path.join(input, "nested", "world.txt"), "nested fixture\n");

  try {
    run(["user", "add", "--email", email, "--firstname", "Phase", "--lastname", "One"]);
    run(["user", "get", email]);
    run(["user", "update", email, "--firstname", "Phase1"]);
    run(["hub", "create", "--name", hubName, "--owner", email]);
    const hubs = JSON.parse(run(["hub", "list", "--owner", email]));
    const hub = (Array.isArray(hubs) ? hubs : [hubs]).find((item) => item && (item.name === hubName || item.filename === hubName));
    assert.ok(hub, "created hub is visible to owner");
    const entity = hub.id || hub.hub_id;
    run(["hub", "members", entity]);
    run(["mfs", "import", "--entity", entity, "--src", input]);
    run(["mfs", "ls", "--entity", entity]);
    run(["mfs", "export", "--entity", entity, "--dest", output]);
    assert.equal(fs.readFileSync(path.join(output, "input", "hello.txt"), "utf8"), "phase1 fixture\n");
    run(["hub", "delete", entity]);
    run(["user", "delete", email]);
  } catch (error) {
    throw new Error(`${error.message}\nManual cleanup may be required for fixture ${email} / ${hubName}.`);
  }
});
