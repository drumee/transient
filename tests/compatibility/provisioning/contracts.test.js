const test = require("node:test");
const assert = require("node:assert/strict");
const { read } = require("../../helpers/repository");

test("drumate provisioning consumes a factory entity and initializes MFS folders", () => {
  const cli = read("sources/cli/src/backend/db/users.js");
  assert.match(cli, /proc\("drumate_create", pw, profile\)/);
  assert.match(cli, /EMPTY_FACTORY/);
  assert.match(cli, /\.mfs_init_folders/);
  const setup = read("sources/setup-schemas/lib/drumate.js");
  assert.match(setup, /drumate_create/);
  assert.match(setup, /desk_create_hub/);
});

test("entity provisioning couples database, MFS root, physical storage, yp state and pool state", () => {
  const schema = read("sources/setup-schemas/lib/schema.js");
  for (const token of ["entity_create", "__storage__", "home_id", "clean"]) assert.match(schema, new RegExp(token));
  assert.match(schema, /mfs_create_root|create_vfs_root/);
});

test("hub provisioning reports pool failures and resolves ownership/home identity", () => {
  const hubs = read("sources/cli/src/backend/db/hubs.js");
  assert.match(hubs, /desk_create_hub/);
  assert.match(hubs, /owner_id/);
  assert.match(hubs, /actual_home_id/);
  assert.match(hubs, /r\.failed/);
});

test("deployment explicitly detects an empty factory pool", () => {
  const postinst = read("sources/debian/schemas/debian/postinst");
  assert.match(postinst, /area='pool'/);
  assert.match(postinst, /EMPTY_FACTORY/);
});
