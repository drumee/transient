const test = require("node:test");
const assert = require("node:assert/strict");
const { read } = require("../../helpers/repository");

test("CLI keeps user, hub, settings, MFS and backend command surfaces", () => {
  const entry = read("sources/cli/bin/drumee.js");
  for (const group of ["registerUser", "registerHub", "registerSettings", "registerMfs"])
    assert.match(entry, new RegExp(group));
  assert.match(entry, /--backend <kind>/);
  assert.match(entry, /db \| api/);
});

test("user and hub lifecycle command verbs remain available", () => {
  const user = read("sources/cli/src/commands/user.js");
  for (const verb of ["list", "get <key>", "add", "update <key>", "delete <key>"])
    assert.ok(user.includes(`command(\"${verb}\")`), `user ${verb}`);
  const hub = read("sources/cli/src/commands/hub.js");
  for (const verb of ["list", "get <key>", "members <key>", "create", "delete <key>"])
    assert.ok(hub.includes(`command(\"${verb}\")`), `hub ${verb}`);
});

test("MFS and settings command verbs remain available", () => {
  const mfs = read("sources/cli/src/commands/mfs.js");
  for (const verb of ["ls", "node", "import", "export"])
    assert.ok(mfs.includes(`command(\"${verb}\")`), `mfs ${verb}`);
  const settings = read("sources/cli/src/commands/settings.js");
  for (const verb of ["list", "get <key>", "set <key> <value>"])
    assert.ok(settings.includes(`command(\"${verb}\")`), `settings ${verb}`);
});
