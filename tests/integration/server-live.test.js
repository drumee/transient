const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { normalizeResponse, loadGolden } = require("../helpers/rest-contract");

const base = process.env.DRUMEE_TEST_BASE_URL;
const token = process.env.DRUMEE_TEST_AUTH_TOKEN;
const headerName = process.env.DRUMEE_TEST_AUTH_HEADER_NAME || "authorization";
const headerValue = process.env.DRUMEE_TEST_AUTH_HEADER_VALUE || (token ? `Bearer ${token}` : "");
const fixturePath = path.resolve(__dirname, "../fixtures/rest/baseline.json");
const golden = fs.existsSync(fixturePath) ? loadGolden(fixturePath) : null;

async function service(name, params = {}, authenticated = false) {
  const headers = { "content-type": "application/json" };
  if (authenticated && headerValue) headers[headerName] = headerValue;
  const response = await fetch(`${base}/-/svc/${name}`, {
    method: "POST",
    headers,
    body: JSON.stringify({ service: name, ...params }),
  });
  const text = await response.text();
  return { status: response.status, text, normalized: normalizeResponse(response.status, response.headers.get("content-type"), text) };
}

function matchesGolden(name, response) {
  if (golden) assert.deepEqual(response.normalized, golden.cases[name]);
}

test("live server responds and exposes the baseline public environment service", { skip: !base }, async () => {
  const response = await service("yp.get_env");
  assert.ok(response.status >= 200 && response.status < 500, `status ${response.status}: ${response.text}`);
  assert.ok(response.text.length > 0);
  matchesGolden("yp_get_env", response);
});

test("live dispatcher rejects unknown module, unknown method, and malformed service", { skip: !base }, async () => {
  for (const [goldenName, name] of [["unknown_module", "baseline_missing.method"], ["unknown_method", "yp.baseline_missing"], ["malformed_service", "malformed"]]) {
    const response = await service(name);
    assert.ok(response.status >= 400 || /NOT_FOUND|WRONG|error|denied|unauthorized/i.test(response.text), `${name}: ${response.status} ${response.text}`);
    matchesGolden(goldenName, response);
  }
});

test("live representative ACL denial is observable", { skip: !base }, async () => {
  const response = await service(process.env.DRUMEE_TEST_DENIED_SERVICE || "desk.get_env");
  assert.ok(response.status >= 400 || /denied|unauthorized|permission|error/i.test(response.text));
  matchesGolden("acl_denied", response);
});

test("live authenticated read keeps session/context when authentication is supplied", { skip: !base || !headerValue }, async () => {
  const response = await service(process.env.DRUMEE_TEST_AUTH_READ_SERVICE || "desk.get_env", {}, true);
  assert.ok(response.status >= 200 && response.status < 400, `status ${response.status}: ${response.text}`);
  assert.ok(!/unauthorized|access.denied/i.test(response.text));
  matchesGolden("authenticated_read", response);
});
