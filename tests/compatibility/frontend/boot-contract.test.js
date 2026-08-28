const test = require("node:test");
const assert = require("node:assert/strict");
const { read } = require("../../helpers/repository");

test("Team entry waits for bootstrap bundles, registers seeds, and starts Drumee", () => {
  const entry = read("sources/ui-team/src/drumee/index.web.js");
  assert.match(entry, /drumee:bootstraping/);
  assert.match(entry, /Kind\.registerAddons\(require\("\.\/seeds"\)\)/);
  assert.match(entry, /window\.Drumee = new App/);
  assert.match(entry, /Drumee\.start\(\)/);
});

test("signin and sandbox UI freeze both current dynamic frontend readiness patterns", () => {
  const signin = read("sources/signin/src/index.js");
  assert.match(signin, /loadWidgets\(\)/);
  assert.match(signin, /drumee:plugins:ready/);
  assert.match(signin, /drumee:router:ready/);
  const sandbox = read("sources/sandbox-ui/app/bootstrap.js");
  assert.match(sandbox, /drumee:router:ready/);
  assert.match(sandbox, /Kind\.register/);
  assert.match(sandbox, /Kind\.waitFor/);
  assert.match(sandbox, /uiRouter\.ensurePart/);
});

test("Window Manager retains open, active-window, raise, and multi-layer behavior", () => {
  const manager = read("sources/ui-team/src/drumee/builtins/window/manager.js");
  for (const token of ["getActiveWindow", "openContent", "launch", "windowsLayer", ".raise()"])
    assert.match(manager, new RegExp(token.replace(".", "\\.")));
  const wm = read("sources/ui-team/src/drumee/modules/desk/wm/index.js");
  assert.match(wm, /loadWorkspace/);
  assert.match(wm, /openFileLocation/);
  assert.match(wm, /headlessLayer/);
});
