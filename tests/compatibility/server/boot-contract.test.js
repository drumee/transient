const test = require("node:test");
const assert = require("node:assert/strict");
const { read } = require("../../helpers/repository");

test("service boot preserves configuration, Redis/cache, ACL, plugin, and HTTP ordering", () => {
  const source = read("sources/server-team/service.js");
  const ordered = [
    "configs.load()",
    ".init()",
    "new Acl()",
    "new Cache()",
    "await Cache.load()",
    "await Acl.loadModules(__dirname)",
    "await Acl.loadPlugins()",
    "HttpServer.createServer",
    "http.listen(env.restPort)",
  ];
  let cursor = -1;
  for (const token of ordered) {
    const next = source.indexOf(token);
    assert.ok(next > cursor, `${token} remains in boot order`);
    cursor = next;
  }
});

test("service boot freezes panic and per-session failure paths", () => {
  const source = read("sources/server-team/service.js");
  for (const code of ["SESSION_FAILED", "SERVICE_FAILED", "SERVICE_ERROR", "SERVER_PANIC"])
    assert.match(source, new RegExp(code));
  assert.match(source, /new Session\(\{ input, output, env \}\)/);
  assert.match(source, /Acl\.run\(session\)/);
});
