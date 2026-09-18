const assert = require("assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const test = require("node:test");

const { loadSchemaEntries } = require("../../../scripts/test-env/kernel/schema-manifest");

function packageFixture(change = () => {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "transient-schema-manifest-"));
  fs.mkdirSync(path.join(root, "schemas", "sql"), { recursive: true });
  fs.writeFileSync(path.join(root, "package.json"), JSON.stringify({ name: "@drumee/test-runtime", version: "1.2.3" }));
  for (const name of ["first.sql", "second.sql"]) fs.writeFileSync(path.join(root, "schemas", "sql", name), `SELECT '${name}';\n`);
  const manifest = {
    owner: "@drumee/test-runtime",
    packageVersion: "1.2.3",
    schemaVersion: "test-1",
    install: [
      { order: 20, path: "schemas/sql/second.sql" },
      { order: 10, path: "schemas/sql/first.sql" }
    ],
    upgrade: { entrypoints: ["schemas/sql/first.sql", "schemas/sql/second.sql"] }
  };
  change(manifest, root);
  fs.writeFileSync(path.join(root, "schemas", "SCHEMA_MANIFEST.json"), JSON.stringify(manifest, null, 2));
  return root;
}

function relative(root, paths) {
  return paths.map((filename) => path.relative(root, filename));
}

test("install entries are validated and sorted by their declared integer order", (t) => {
  const root = packageFixture();
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.deepEqual(relative(root, loadSchemaEntries(root, "install").paths), [
    "schemas/sql/first.sql",
    "schemas/sql/second.sql"
  ]);
  assert.deepEqual(relative(root, loadSchemaEntries(root, "upgrade").paths), [
    "schemas/sql/first.sql",
    "schemas/sql/second.sql"
  ]);
});

test("a traversing manifest path is rejected", (t) => {
  const root = packageFixture((manifest) => { manifest.install[0].path = "../outside.sql"; });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => loadSchemaEntries(root, "install"), /traverses outside the package/);
});

test("absolute and repository-tree manifest paths are rejected", (t) => {
  const roots = [
    packageFixture((manifest) => { manifest.install[0].path = "/tmp/outside.sql"; }),
    packageFixture((manifest) => { manifest.install[0].path = "sources/schemas/outside.sql"; }),
    packageFixture((manifest) => { manifest.install[0].path = "target/runtime/outside.sql"; })
  ];
  t.after(() => roots.forEach((root) => fs.rmSync(root, { recursive: true, force: true })));
  assert.throws(() => loadSchemaEntries(roots[0], "install"), /must be package-relative/);
  assert.throws(() => loadSchemaEntries(roots[1], "install"), /references a repository tree/);
  assert.throws(() => loadSchemaEntries(roots[2], "install"), /references a repository tree/);
});

test("a missing schema file is rejected before installation", (t) => {
  const root = packageFixture((manifest) => { manifest.install[0].path = "schemas/sql/missing.sql"; });
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  assert.throws(() => loadSchemaEntries(root, "install"), /file is missing/);
});

test("manifest owner and package version must match package metadata", (t) => {
  for (const mismatch of [
    (manifest) => { manifest.owner = "@drumee/other-runtime"; },
    (manifest) => { manifest.packageVersion = "9.9.9"; }
  ]) {
    const root = packageFixture(mismatch);
    t.after(() => fs.rmSync(root, { recursive: true, force: true }));
    assert.throws(() => loadSchemaEntries(root, "install"), /does not match package/);
  }
});

test("ambiguous install orders and duplicate schema paths are rejected", (t) => {
  const duplicateOrder = packageFixture((manifest) => { manifest.install[1].order = manifest.install[0].order; });
  const duplicatePath = packageFixture((manifest) => { manifest.install[1].path = manifest.install[0].path; });
  const nonIntegerOrder = packageFixture((manifest) => { manifest.install[0].order = 1.5; });
  t.after(() => {
    fs.rmSync(duplicateOrder, { recursive: true, force: true });
    fs.rmSync(duplicatePath, { recursive: true, force: true });
    fs.rmSync(nonIntegerOrder, { recursive: true, force: true });
  });
  assert.throws(() => loadSchemaEntries(duplicateOrder, "install"), /order is duplicated/);
  assert.throws(() => loadSchemaEntries(duplicatePath, "install"), /path is duplicated/);
  assert.throws(() => loadSchemaEntries(nonIntegerOrder, "install"), /order must be an integer/);
});

test("the kernel installer has no duplicate current-schema filename list", () => {
  const root = path.resolve(__dirname, "../../..");
  const installer = fs.readFileSync(path.join(root, "scripts/test-env/kernel/up.sh"), "utf8");
  assert.match(installer, /schema_manifest_entries/);
  assert.doesNotMatch(installer, /\$KERNEL_SERVER_RUNTIME_SOURCE\/schemas\/yellow-page\//);
});
