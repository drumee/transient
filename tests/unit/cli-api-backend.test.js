const test = require("node:test");
const assert = require("node:assert/strict");
const { ApiBackend } = require("../../sources/cli/src/backend/api");
const { createBackend } = require("../../sources/cli/src/backend");

test("the current API backend fails explicitly instead of silently using DB access", async () => {
  const backend = new ApiBackend({ domain: "example.test" });
  await assert.rejects(
    backend.connect(),
    /remote API backend is not implemented yet.*backend db/i
  );
  await backend.disconnect();
});

test("the backend factory recognizes only db and api", () => {
  assert.equal(createBackend("api").constructor.name, "ApiBackend");
  assert.equal(createBackend("db").constructor.name, "DbBackend");
  assert.throws(() => createBackend("other"), /expected: db \| api/);
});
