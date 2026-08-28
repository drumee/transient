const test = require("node:test");
const assert = require("node:assert/strict");

const url = process.env.DRUMEE_TEST_UI_URL;

test("live Team frontend entry returns bootable HTML", { skip: !url }, async () => {
  const response = await fetch(url, { redirect: "follow" });
  const html = await response.text();
  assert.equal(response.ok, true, `${response.status} ${response.statusText}`);
  assert.match(response.headers.get("content-type") || "", /text\/html/);
  assert.match(html, /<html|<!doctype/i);
  assert.match(html, /script/i);
});

test("live frontend bootstrap endpoint is available", { skip: !url }, async () => {
  const response = await fetch(new URL("/-/svc/bootstrap.js", url));
  const source = await response.text();
  assert.equal(response.ok, true, `${response.status} ${response.statusText}`);
  assert.ok(source.length > 0);
});
