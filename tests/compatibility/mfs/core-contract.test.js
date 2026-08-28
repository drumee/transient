const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { resolveRepo, files, read } = require("../../helpers/repository");

const procedureFiles = files("sources/schemas/common/procedures", (file) => file.endsWith(".sql"));
const procedureText = procedureFiles.map((file) => fs.readFileSync(file, "utf8")).join("\n");

test("MFS schema exposes create, list/read, mkdir, rename, move, copy and delete families", () => {
  for (const operation of ["mfs_create_node", "mfs_list", "mfs_node_attr", "mfs_make_dir", "mfs_rename", "mfs_move", "mfs_copy", "mfs_delete"])
    assert.match(procedureText, new RegExp(operation, "i"), operation);
});

test("MFS contract keeps node identity, parent, storage and permission semantics", () => {
  assert.match(procedureText, /parent_id/i);
  assert.match(procedureText, /home_id/i);
  assert.match(procedureText, /home_dir/i);
  assert.match(procedureText, /permission/i);
  assert.match(procedureText, /__storage__/i);
  const core = read("sources/server-core/lib/mfs.js");
  assert.match(core, /get_access\(nid, PERM_DELETE\)/);
});

test("cross-hub MFS operations remain explicitly registered", () => {
  const media = JSON.parse(fs.readFileSync(resolveRepo("sources/server-team/acl/media.json"), "utf8"));
  const names = Object.keys(media.services || {});
  assert.ok(names.some((name) => /copy|move|relocate/.test(name)), "cross-node copy/move service exists");
  assert.ok(names.some((name) => media.services[name].permission?.dest), "destination ACL is declared");
});
