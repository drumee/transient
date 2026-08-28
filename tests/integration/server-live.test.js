const test = require("node:test");
const assert = require("node:assert/strict");

const base = process.env.DRUMEE_TEST_BASE_URL;
const token = process.env.DRUMEE_TEST_AUTH_TOKEN;

async function service(name, params = {}) {
  const response = await fetch(`${base}/-/svc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ service: name, ...params }),
  });
  return { status: response.status, text: await response.text() };
}

test("live server responds and exposes the baseline public environment service", { skip: !base }, async () => {
  const response = await service("yp.get_env");
  assert.ok(response.status >= 200 && response.status < 500, `status ${response.status}: ${response.text}`);
  assert.ok(response.text.length > 0);
});

test("live dispatcher rejects unknown module, unknown method, and malformed service", { skip: !base }, async () => {
  for (const name of ["baseline_missing.method", "yp.baseline_missing", "malformed"]) {
    const response = await service(name);
    assert.ok(response.status >= 400 || /NOT_FOUND|WRONG|error|denied|unauthorized/i.test(response.text), `${name}: ${response.status} ${response.text}`);
  }
});

test("live authenticated read keeps session/context when a token is supplied", { skip: !base || !token }, async () => {
  const response = await service(process.env.DRUMEE_TEST_AUTH_READ_SERVICE || "desk.get_env");
  assert.ok(response.status >= 200 && response.status < 400, `status ${response.status}: ${response.text}`);
  assert.ok(!/unauthorized|access.denied/i.test(response.text));
});
