const test = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { resolveRepo, read } = require("../../helpers/repository");

function run(relative) {
  const result = spawnSync("bash", [resolveRepo(relative)], { cwd: resolveRepo("sources/debian"), encoding: "utf8" });
  assert.equal(result.status, 0, `${relative}\n${result.stdout}\n${result.stderr}`);
}

test("Docker/self-host configuration renderer passes its baseline smoke checks", () => {
  run("sources/debian/tests/smoke-config.sh");
});

test("native Debian package ordering and configuration bridge pass baseline checks", () => {
  run("sources/debian/tests/native/control-deps.sh");
});

test("deployment remains coupled to current Team artifacts", () => {
  const readme = read("sources/debian/README.md");
  for (const token of ["server-team", "ui-team", "setup-schemas", "schemas"]) assert.match(readme, new RegExp(token));
});
