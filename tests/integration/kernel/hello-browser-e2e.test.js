const assert = require("assert/strict");
const childProcess = require("child_process");
const fs = require("fs");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const baseUrl = `http://127.0.0.1:${process.env.KERNEL_HTTP_PORT || "28642"}`;
const container = process.env.KERNEL_CONTAINER || "transient-kernel-phase2";

function chrome() {
  const candidates = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("A Chromium-compatible browser is required for the Hello E2E test");
  return found;
}

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
}

test("Hello dynamically loads a real plugin and reaches the public-api worker through Nginx", { timeout: 180000 }, async () => {
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"]);
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  try {
    const direct = await fetch(`${baseUrl}/-/svc/hello.ping`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{}"
    });
    assert.equal(direct.status, 200);
    assert.deepEqual(await direct.json(), {
      status: "ok",
      data: { ok: true, message: "Hello from Drumee", module: "hello" }
    });

    const unknownMethod = await fetch(`${baseUrl}/-/svc/hello.unknown`);
    assert.equal(unknownMethod.status, 404);
    assert.equal((await unknownMethod.json()).code, "SERVICE_NOT_FOUND");
    const unknownPlugin = await fetch(`${baseUrl}/-/svc/bootstrap.plugin?name=missing`);
    assert.equal(unknownPlugin.status, 404);
    assert.equal((await unknownPlugin.json()).code, "PLUGIN_NOT_FOUND");

    const browser = run(chrome(), [
      "--headless=new", "--no-sandbox", "--disable-gpu", "--virtual-time-budget=5000", "--dump-dom",
      `${baseUrl}/-/plugins/hello/probe.html`
    ]);
    assert.equal(browser.status, 0, browser.stderr);
    assert.match(browser.stdout, /data-ready="true"/);
    assert.match(browser.stdout, /data-kind-before="false"/);
    assert.match(browser.stdout, /data-kind-after="true"/);
    assert.match(browser.stdout, /data-widget-parent="true"/);
    assert.match(browser.stdout, /data-reply-module="hello"/);
    assert.match(browser.stdout, /data-reply-ok="true"/);
    assert.match(browser.stdout, /data-final-status="Hello from Drumee"/);
    assert.match(browser.stdout, /Drumee kernel/);
    assert.match(browser.stdout, /Status: Hello from Drumee/);
    assert.doesNotMatch(browser.stdout, /data-browser-error=/);

    const logs = run("docker", ["logs", container]);
    assert.equal(logs.status, 0, logs.stderr);
    assert.match(logs.stdout, /kernel dispatched bootstrap\.plugin/);
    assert.match(logs.stdout, /kernel dispatched hello\.ping/);
  } finally {
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});

test("Hello source remains outside Team, MFS, schema and legacy KIND boundaries", () => {
  const helloRoot = path.join(root, "target/modules/hello");
  const source = fs.readdirSync(helloRoot, { recursive: true })
    .filter((file) => file.endsWith(".js") || file.endsWith(".json"))
    .map((file) => fs.readFileSync(path.join(helloRoot, file), "utf8"))
    .join("\n")
    .replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, "");
  assert.doesNotMatch(source, /(?:window\.|global\.)KIND|KIND\s*\./);
  assert.doesNotMatch(source, /ui-team|server-team|DrumeeMFS|Finder|WindowManager|mariadb|acl_check|user_permission|user_expiry/i);
});
