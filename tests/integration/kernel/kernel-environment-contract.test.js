const assert = require("assert/strict");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

test("kernel environment consumes setup-infra routes and excludes historical Team image sources", () => {
  const dockerfile = read("scripts/test-env/kernel/Dockerfile");
  const build = read("scripts/test-env/kernel/build.sh");
  assert.match(dockerfile, /FROM node:22-bookworm-slim/);
  assert.match(build, /sources\/setup-infra/);
  assert.doesNotMatch(dockerfile, /server-team|ui-team|sources\/debian|server-pod|ui-pod/);
  assert.doesNotMatch(build, /sources\/server-team|sources\/ui-team|sources\/debian/);
});

test("only the generated setup-infra route file supplies kernel HTTP routes", () => {
  const entrypoint = read("scripts/test-env/kernel/container/entrypoint.sh");
  const render = read("scripts/test-env/kernel/container/render-config.sh");
  assert.match(render, /node infra\.js/);
  assert.match(render, /--outdir \/out\/generated/);
  assert.match(entrypoint, /generated\/etc\/drumee\/infrastructure\/routes\/app\.conf/);
  assert.match(entrypoint, /include \$\{route\}/);
  assert.doesNotMatch(entrypoint, /proxy_pass/);
});

test("kernel cleanup is bounded to the known disposable root", () => {
  const helper = read("scripts/test-env/kernel/lib.sh");
  const reset = read("scripts/test-env/kernel/reset.sh");
  assert.match(helper, /\.tmp\/test-env\/kernel/);
  assert.match(helper, /Refusing path outside kernel test root/);
  assert.match(reset, /assert_kernel_root "\$KERNEL_RUNTIME_ROOT"/);
  assert.match(reset, /rm -rf "\$KERNEL_RUNTIME_ROOT"/);
});
