const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const { files } = require("../../helpers/repository");

const roots = ["sources/server-team/acl", "sources/loby/acl", "sources/sandbox-server/acl"];
const aclFiles = roots.flatMap((root) => files(root, (file) => file.endsWith(".json")));

test("every registered service has scope, source permission, and a resolvable implementation", () => {
  let count = 0;
  const descriptorOnly = [];
  const missingSourcePermission = [];
  const emptyImplementations = [];
  for (const file of aclFiles) {
    const acl = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    if (!acl.modules) descriptorOnly.push(path.basename(file));
    for (const [name, service] of Object.entries(acl.services || {})) {
      count++;
      assert.ok(service.scope, `${file}:${name} has scope`);
      if (!service.permission?.src) missingSourcePermission.push(`${path.basename(file)}:${name}`);
    }
    for (const implementation of Object.values(acl.modules || {})) {
      if (!implementation) {
        emptyImplementations.push(path.basename(file));
        continue;
      }
      const candidate = path.resolve(path.dirname(path.dirname(file)), `${implementation}.js`);
      assert.equal(require("node:fs").existsSync(candidate), true, `${candidate} exists`);
    }
  }
  assert.ok(count > 100, `catalogued ${count} services`);
  assert.deepEqual(descriptorOnly.sort(), ["block.json", "menu.json", "ops.json", "wicket.json", "ws.json"]);
  assert.deepEqual(missingSourcePermission, ["desk.json:set_online_status"]);
  assert.deepEqual(emptyImplementations, ["secure_share.json"]);
});

test("representative public/authenticated/read/write/admin ACL cases remain present", () => {
  const permissions = new Set();
  for (const file of aclFiles) {
    const acl = JSON.parse(require("node:fs").readFileSync(file, "utf8"));
    for (const svc of Object.values(acl.services || {})) permissions.add(svc.permission?.src);
  }
  for (const expected of ["anyone", "anonymous", "read", "write", "admin", "owner"]) {
    assert.equal(permissions.has(expected), true, `ACL catalog contains ${expected}`);
  }
});

test("sandbox destructive provisioning is currently public", () => {
  const acl = require("../../helpers/repository").json("sources/sandbox-server/acl/sandbox.json");
  assert.equal(acl.services.create.permission.src, "anyone");
  assert.equal(acl.services.remove.permission.src, "anyone");
});
