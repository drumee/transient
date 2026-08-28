const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { MfsStore } = require("../../sources/cli/src/backend/db/mfs");

test("MFS list freezes the qualified procedure and stable projection", async () => {
  let call;
  const store = new MfsStore({
    dbName: async () => "x_fixture",
    proc: async (...args) => { call = args; return [{ id: "n1", filename: "A", category: "folder", extra: 1 }]; },
    toArray: (v) => v,
  });
  assert.deepEqual(await store.ls({ entity: "fixture", parent: "p1", page: 2 }), [
    { id: "n1", filename: "A", category: "folder", extension: undefined, filesize: undefined },
  ]);
  assert.deepEqual(call, ["x_fixture.mfs_list_by", { pid: "p1", type: "", page: 2, sort: "name", order: "asc" }]);
});

test("MFS import/export preserves a small hierarchy and physical blob convention", async (t) => {
  const temp = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-baseline-mfs-"));
  t.after(() => fs.rmSync(temp, { recursive: true, force: true }));
  const home = path.join(temp, "entity");
  const input = path.join(temp, "input");
  const output = path.join(temp, "output");
  fs.mkdirSync(path.join(input, "nested"), { recursive: true });
  fs.writeFileSync(path.join(input, "hello.TXT"), "hello");
  fs.writeFileSync(path.join(input, "nested", "world.bin"), "world");

  let seq = 0;
  const children = new Map([["root", []]]);
  const conn = {
    async await_proc(name, ...args) {
      if (name === "mfs_home" || name === "mfs_node_attr") return { id: "root", nid: "root", home_id: "root", home_dir: home, owner_id: "owner" };
      if (name === "mfs_make_dir") {
        const parent = args[0];
        const id = `d${++seq}`;
        children.set(id, []);
        children.get(parent)?.push({ id, user_filename: args[1][0], category: "folder", extension: "" });
        return { id, nid: id, home_dir: home, owner_id: "owner" };
      }
      if (name === "mfs_create_node") {
        const data = args[0];
        const id = `f${++seq}`;
        children.get(data.pid)?.push({ id, user_filename: data.filename, category: data.category, extension: data.ext });
        return { id };
      }
      throw new Error(`unexpected procedure ${name}`);
    },
    async await_query(_sql, parent) { return children.get(parent) || []; },
    async stop() {},
  };
  const store = new MfsStore({
    dbName: async () => "x_fixture",
    entityConn: () => conn,
    toArray: (v) => v,
    Cache: { getFilecap: (ext) => ({ category: ext === "txt" ? "text" : "other", mimetype: "fixture/type" }) },
  });
  const imported = await store.import({ entity: "fixture", src: input });
  assert.equal(imported.imported, 2);
  assert.equal(fs.readFileSync(path.join(home, "__storage__", "f2", "orig.txt"), "utf8"), "hello");
  assert.equal(fs.readFileSync(path.join(home, "__storage__", "f4", "orig.bin"), "utf8"), "world");
  const exported = await store.export({ entity: "fixture", dest: output });
  assert.equal(exported.exported, 2);
  assert.equal(fs.readFileSync(path.join(output, "input", "hello.txt"), "utf8"), "hello");
  assert.equal(fs.readFileSync(path.join(output, "input", "nested", "world.bin"), "utf8"), "world");
});

test("MFS rejects missing entities and invalid local paths", async () => {
  const store = new MfsStore({ dbName: async () => null });
  await assert.rejects(store.ls({}), /requires --entity/);
  await assert.rejects(store.node({ entity: "missing", id: "n" }), /Unknown entity/);
  await assert.rejects(store.import({ entity: "x", src: "/definitely/not/here" }), /source not found/);
  await assert.rejects(store.export({ entity: "x" }), /requires --dest/);
});
