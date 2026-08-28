const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DbBackend } = require("../../sources/cli/src/backend/db");

function backend(root, rows = []) {
  const b = new DbBackend();
  b.mfsDir = root;
  b.toArray = (value) => value;
  b.query = async () => rows;
  return b;
}

test("storage deletion refuses empty, root, and outside paths", async () => {
  const b = backend("/srv/drumee/mfs");
  await assert.rejects(b.assertExclusiveStorage("", "test-a"), /empty home_dir/);
  await assert.rejects(b.assertExclusiveStorage("/srv/drumee/mfs", "test-a"), /strictly inside/);
  await assert.rejects(b.assertExclusiveStorage("/srv/other", "test-a"), /strictly inside/);
});

test("storage deletion refuses a tree containing another tenant", async () => {
  const b = backend("/srv/drumee/mfs", [
    { id: "test-b", home_dir: "/srv/drumee/mfs/test-a/nested" },
  ]);
  await assert.rejects(
    b.assertExclusiveStorage("/srv/drumee/mfs/test-a", "test-a"),
    /storage of 1 other tenant/
  );
});

test("storage deletion removes only an approved disposable child", async (t) => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-baseline-storage-"));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const target = path.join(root, "test-entity");
  fs.mkdirSync(target);
  fs.writeFileSync(path.join(target, "marker"), "fixture");
  assert.equal(await backend(root).removeStorage(target, "test-entity"), true);
  assert.equal(fs.existsSync(target), false);
  assert.equal(fs.existsSync(root), true);
});
