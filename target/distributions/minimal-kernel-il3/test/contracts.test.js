"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), os = require("node:os");
const { statements, identifier, privateFile, manifestEntries } = require("../lib/database");
test("manifest SQL interpreter preserves procedure bodies and declared delimiters", () => {
  assert.deepEqual(statements("-- comment\nCREATE TABLE x (id INT);\nDELIMITER $\nCREATE PROCEDURE p()\nBEGIN\nSELECT 1;\nEND$\nDELIMITER ;\n"), ["CREATE TABLE x (id INT)", "CREATE PROCEDURE p()\nBEGIN\nSELECT 1;\nEND"]);
  assert.throws(() => statements("SELECT 1"), { code: "INCOMPLETE_SCHEMA_STATEMENT" });
  assert.throws(() => identifier("yp; DROP DATABASE yp"), { code: "INVALID_SQL_IDENTIFIER" });
});
test("private resources reject symlinks, hardlinks and permissive modes", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "il3-private-test-"));
  try {
    const file = path.join(root, "value"); fs.writeFileSync(file, "test-only", { mode: 0o600 }); assert.equal(privateFile(file), "test-only");
    fs.symlinkSync(file, path.join(root, "link")); assert.throws(() => privateFile(path.join(root, "link")), { code: "UNSAFE_PRIVATE_RESOURCE" });
    fs.linkSync(file, path.join(root, "hard")); assert.throws(() => privateFile(file), { code: "UNSAFE_PRIVATE_RESOURCE" }); fs.unlinkSync(path.join(root, "hard"));
    fs.chmodSync(file, 0o644); assert.throws(() => privateFile(file), { code: "UNSAFE_PRIVATE_RESOURCE" });
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
test("installed runtime schema manifest resolves only package files and parses its actual SQL", () => {
  const root = path.dirname(require.resolve("@drumee/server-runtime/package.json"));
  const entries = manifestEntries(root); assert.equal(entries.length, 2);
  assert.ok(entries.flatMap(entry => statements(fs.readFileSync(entry.file, "utf8"))).length > 15);
});
test("distribution composition passes the canonical lifecycle verification", () => {
  const { compose } = require("../lib/distribution");
  const composition = compose({ root: "/tmp/il3-unit", project: "il3-unit", image: "sha256:" + "a".repeat(64), tools_image: "sha256:" + "b".repeat(64), https_port: 29443, dns_port: 29553, source_revision: "5469b48109dbb20eacbbc9314a6772264b388843" });
  assert.deepEqual(require("@drumee/infra-layer/lifecycle/composition").verifyComposition(composition), composition);
});
