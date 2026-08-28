const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { read, resolveRepo } = require("../../helpers/repository");

const names = ["check", "build", "up", "status", "e2e", "logs", "down", "reset", "debian-tests"];

test("baseline environment exposes the complete wrapper command set", () => {
  for (const name of names) {
    const file = resolveRepo(`scripts/test-env/${name}.sh`);
    assert.equal(fs.existsSync(file), true, `${name}.sh exists`);
  }
});

test("builder maps every imported source explicitly and disables media dependencies by default", () => {
  const build = read("scripts/test-env/build.sh");
  for (const mapping of ["SERVER_SRC", "UI_SRC", "SCHEMAS_SRC", "SETUP_SCHEMAS_SRC", "STATIC_SRC", "SETUP_INFRA_SRC"])
    assert.match(build, new RegExp(`export ${mapping}=`));
  assert.match(build, /MEDIA_DEPS="\$\{MEDIA_DEPS:-0\}"/);
  assert.match(build, /build-images-local\.sh/);
});

test("runtime is isolated, loopback-only, pool-enabled, and machine-readable", () => {
  const lib = read("scripts/test-env/lib.sh");
  const up = read("scripts/test-env/up.sh");
  assert.match(lib, /\.tmp\/test-env/);
  assert.match(lib, /transient-baseline/);
  assert.match(up, /127\.0\.0\.1:\$UI_HOST_PORT:23000/);
  assert.match(up, /127\.0\.0\.1:\$API_HOST_PORT:24000/);
  assert.match(up, /POOL_COUNT=5/);
  assert.match(up, /POOL_WATERMARK=5/);
  assert.match(lib, /runtime\.env/);
});

test("cleanup requires the exact baseline runtime root", () => {
  const lib = read("scripts/test-env/lib.sh");
  const reset = read("scripts/test-env/reset.sh");
  assert.match(lib, /assert_runtime_dir/);
  assert.match(lib, /refusing runtime operation outside/);
  assert.match(reset, /assert_runtime_dir/);
  assert.match(reset, /REMOVE_TEST_IMAGES/);
});
