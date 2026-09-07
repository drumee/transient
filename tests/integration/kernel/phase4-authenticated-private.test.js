const assert = require("assert/strict");
const childProcess = require("child_process");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const baseUrl = `http://127.0.0.1:${process.env.KERNEL_HTTP_PORT || "28642"}`;
const container = process.env.KERNEL_CONTAINER || "transient-kernel-phase2";
const database = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";
// This is a disposable fixture value only. It is deliberately kept out of
// responses, logs and documentation; operators may override it for a run.
const password = process.env.KERNEL_PHASE4_TEST_PASSWORD || "phase4-disposable-user";

function run(command, args, options = {}) {
  return childProcess.spawnSync(command, args, { cwd: root, encoding: "utf8", ...options });
}

function db(sql) {
  const result = run("docker", [
    "exec",
    "-e", `MYSQL_PWD=${process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root"}`,
    database,
    "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "yp", "--batch", "--skip-column-names",
    "--execute", sql
  ]);
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

async function service(name, { cookie, body = {} } = {}) {
  const response = await fetch(`${baseUrl}/-/svc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {})
    },
    body: JSON.stringify(body)
  });
  return { response, payload: await response.json() };
}

async function signin(uid, value = password) {
  const { response, payload } = await service("yp.signin", { body: { uid, password: value } });
  const header = response.headers.get("set-cookie");
  return { response, payload, cookie: header && header.split(";", 1)[0] };
}

test("Phase 4 authenticates with session_signin then authorizes hello.private through domain_permission", { timeout: 180000 }, async () => {
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"]);
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  try {
    // The target function must retain the historical bitwise result convention:
    // 0 denies, while every requested bit present in privilege is non-zero.
    assert.equal(db("SELECT domain_permission('phase4authuser01', 41, 1)"), "1");
    assert.equal(db("SELECT domain_permission('phase4authuser01', 41, 2)"), "2");
    assert.equal(db("SELECT domain_permission('phase4authuser01', 41, 4)"), "0");

    const ping = await service("hello.ping");
    assert.equal(ping.response.status, 200);
    assert.deepEqual(ping.payload, {
      status: "ok",
      data: { ok: true, message: "Hello from Drumee", module: "hello" }
    });

    const noSession = await service("hello.private");
    assert.equal(noSession.response.status, 403);
    assert.equal(noSession.payload.code, "PERMISSION_DENIED");

    const invalid = await signin("phase4-auth@kernel.test", "not-the-fixture-password");
    assert.equal(invalid.response.status, 401);
    assert.equal(invalid.payload.code, "AUTHENTICATION_FAILED");
    assert.equal(invalid.cookie, null);

    const deniedLogin = await signin("phase4-denied@kernel.test");
    assert.equal(deniedLogin.response.status, 200);
    assert.match(deniedLogin.cookie, /^regsid=/);
    const denied = await service("hello.private", { cookie: deniedLogin.cookie });
    assert.equal(denied.response.status, 403);
    assert.equal(denied.payload.code, "PERMISSION_DENIED");

    const authorizedLogin = await signin("phase4-auth@kernel.test");
    assert.equal(authorizedLogin.response.status, 200);
    assert.match(authorizedLogin.cookie, /^regsid=/);
    const allowed = await service("hello.private", { cookie: authorizedLogin.cookie });
    assert.equal(allowed.response.status, 200);
    assert.deepEqual(allowed.payload, {
      status: "ok",
      data: {
        ok: true,
        authenticated: true,
        module: "hello",
        scope: "domain",
        identity: { id: "phase4authuser01" }
      }
    });

    // The cookie is deliberately reused while only the Yellow Page privilege
    // changes. This proves authentication and Domain authorization are separate
    // and that domain_permission is on the live request path.
    db("UPDATE privilege SET privilege=0 WHERE uid='phase4authuser01' AND domain_id=41");
    const revoked = await service("hello.private", { cookie: authorizedLogin.cookie });
    assert.equal(revoked.response.status, 403);
    assert.equal(revoked.payload.code, "PERMISSION_DENIED");

    db("UPDATE privilege SET privilege=3 WHERE uid='phase4authuser01' AND domain_id=41");
    const restored = await service("hello.private", { cookie: authorizedLogin.cookie });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.payload.data.authenticated, true);

    const tables = db("SELECT table_name FROM information_schema.tables WHERE table_schema='yp' ORDER BY table_name").split("\n");
    assert.deepEqual(tables, ["cookie", "domain", "drumate", "entity", "privilege"]);
    assert.equal(db("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'd\\_%' ESCAPE '\\\\'"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yp' AND table_name LIKE 'mfs%'") , "0");

    const logs = run("docker", ["logs", container]);
    assert.equal(logs.status, 0, logs.stderr);
    assert.match(logs.stdout, /kernel dispatched yp\.signin/);
    assert.match(logs.stdout, /kernel dispatched hello\.private/);
  } finally {
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});
