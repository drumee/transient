const assert = require("assert/strict");
const childProcess = require("child_process");
const crypto = require("crypto");
const events = require("events");
const fs = require("fs");
const http = require("http");
const os = require("os");
const path = require("path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");
const baseUrl = `http://127.0.0.1:${process.env.KERNEL_HTTP_PORT || "28642"}`;
const websocketUrl = baseUrl.replace(/^http/, "ws") + "/-/websocket/";
const container = process.env.KERNEL_CONTAINER || "transient-kernel-phase2";
const database = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";
const password = process.env.KERNEL_PHASE4_TEST_PASSWORD || "phase4-disposable-user";

function chrome() {
  const candidates = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium", "/usr/bin/chromium-browser"].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(candidate));
  if (!found) throw new Error("A Chromium-compatible browser is required for the WebSocket E2E test");
  return found;
}

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

async function signin(uid) {
  const result = await service("yp.signin", { body: { uid, password } });
  const cookie = result.response.headers.get("set-cookie");
  assert.equal(result.response.status, 200);
  assert.match(cookie || "", /^regsid=/);
  return cookie.split(";", 1)[0];
}

function maskedTextFrame(text) {
  const payload = Buffer.from(text);
  if (payload.length >= 126) throw new Error("Test WebSocket frame is unexpectedly large");
  const mask = crypto.randomBytes(4);
  const frame = Buffer.alloc(2 + mask.length + payload.length);
  frame[0] = 0x81;
  frame[1] = 0x80 | payload.length;
  mask.copy(frame, 2);
  for (let index = 0; index < payload.length; index++) frame[6 + index] = payload[index] ^ mask[index % 4];
  return frame;
}

function attachFrames(socket, messages) {
  let buffer = Buffer.alloc(0);
  socket.on("data", (chunk) => {
    buffer = Buffer.concat([buffer, chunk]);
    while (buffer.length >= 2) {
      const opcode = buffer[0] & 0x0f;
      let length = buffer[1] & 0x7f;
      let offset = 2;
      if (length === 126) {
        if (buffer.length < 4) return;
        length = buffer.readUInt16BE(2);
        offset = 4;
      }
      if (buffer.length < offset + length) return;
      const payload = buffer.subarray(offset, offset + length);
      buffer = buffer.subarray(offset + length);
      if (opcode === 1) {
        try { messages.push(JSON.parse(payload.toString("utf8"))); } catch (_) {}
      }
    }
  });
}

function connect(cookie, protocol = "service") {
  return new Promise((resolve, reject) => {
    const messages = [];
    const url = new URL(websocketUrl.replace(/^ws/, "http"));
    const request = http.request({
      host: url.hostname,
      port: url.port,
      path: url.pathname,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
        "Sec-WebSocket-Protocol": protocol,
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    request.once("error", reject);
    request.once("response", (response) => {
      response.resume();
      reject(new Error(`WebSocket rejected with HTTP ${response.statusCode}`));
    });
    request.once("upgrade", (response, socket, head) => {
      const connection = {
        connected: true,
        sendUTF(value) { socket.write(maskedTextFrame(value)); },
        close() { connection.connected = false; socket.end(); }
      };
      attachFrames(socket, messages);
      if (head.length) socket.emit("data", head);
      socket.once("close", () => { connection.connected = false; });
      const deadline = setTimeout(() => {
        clearInterval(timer);
        reject(new Error("Timed out waiting for sys.hello"));
      }, 4000);
      const timer = setInterval(() => {
        const hello = messages.find((entry) => entry.service === "sys.hello");
        if (!hello) return;
        clearInterval(timer);
        clearTimeout(deadline);
        resolve({ connection, messages, hello });
      }, 10);
    });
    request.end();
  });
}

function waitFor(socket, predicate, timeout = 4000) {
  return new Promise((resolve, reject) => {
    const existing = socket.messages.find(predicate);
    if (existing) return resolve(existing);
    const timer = setTimeout(() => reject(new Error("Timed out waiting for WebSocket message")), timeout);
    const poll = setInterval(() => {
      const found = socket.messages.find(predicate);
      if (!found) return;
      clearInterval(poll);
      clearTimeout(timer);
      resolve(found);
    }, 20);
  });
}

function connectionFailure(cookie, protocol) {
  return connect(cookie, protocol).then(() => new Error("WebSocket unexpectedly connected"), (error) => error);
}

async function chromeDebugPort(port) {
  for (let attempt = 0; attempt < 80; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return response.json();
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("Chrome DevTools endpoint did not become ready");
}

function devtools(url) {
  return new Promise((resolve, reject) => {
    const socket = new WebSocket(url);
    const pending = new Map();
    let serial = 0;
    socket.addEventListener("open", () => resolve({
      close: () => socket.close(),
      send(method, params = {}) {
        const id = ++serial;
        socket.send(JSON.stringify({ id, method, params }));
        return new Promise((resolveCommand, rejectCommand) => pending.set(id, { resolve: resolveCommand, reject: rejectCommand }));
      }
    }));
    socket.addEventListener("error", () => reject(new Error("Chrome DevTools WebSocket failed")));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const handler = pending.get(message.id);
      if (!handler) return;
      pending.delete(message.id);
      if (message.error) handler.reject(new Error(message.error.message));
      else handler.resolve(message.result);
    });
  });
}

async function runBrowserPushProbe() {
  const debugPort = 29244;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase44-chrome-"));
  const process = childProcess.spawn(chrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`,
    `--user-data-dir=${profile}`, "about:blank"
  ], { stdio: "ignore" });
  let protocol;
  try {
    const pages = await chromeDebugPort(debugPort);
    const page = pages.find((entry) => entry.type === "page");
    protocol = await devtools(page.webSocketDebuggerUrl);
    await protocol.send("Page.enable");
    await protocol.send("Runtime.enable");
    await protocol.send("Page.navigate", {
      url: `${baseUrl}/-/plugins/hello/push-probe.html#${encodeURIComponent(password)}`
    });
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await protocol.send("Runtime.evaluate", {
        expression: "({login:document.body.dataset.login,socket:document.body.dataset.socket,push:document.body.dataset.pushStatus,error:document.body.dataset.browserError,text:document.body.innerText})",
        returnByValue: true
      });
      const value = result.result.value;
      if (value.error) throw new Error(value.error);
      if (value.socket === "connected" && value.push === "Hello over WebSocket") return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("Browser did not reach the authenticated Hello push DOM state");
  } finally {
    if (protocol) protocol.close();
    process.kill("SIGTERM");
    await Promise.race([events.once(process, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    fs.rmSync(profile, { recursive: true, force: true });
  }
}

test("Phase 4.4 authenticates WebSockets through regsid, delivers Redis push only to the caller and updates the real Hello Widget", { timeout: 240000 }, async () => {
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"]);
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  let authorized;
  let denied;
  try {
    assert.ok(await connectionFailure(null, "service"));
    assert.ok(await connectionFailure("regsid=not-a-real-session", "service"));
    assert.ok(await connectionFailure(null, "ping"));

    const authorizedCookie = await signin("phase4-auth@kernel.test");
    const deniedCookie = await signin("phase4-denied@kernel.test");
    authorized = await connect(authorizedCookie);
    denied = await connect(deniedCookie);
    const authorizedSocketId = authorized.hello.data.socket_id;
    const deniedSocketId = denied.hello.data.socket_id;
    assert.match(authorizedSocketId, /^[a-f0-9]{32}$/);
    assert.match(deniedSocketId, /^[a-f0-9]{32}$/);
    assert.equal(db(`SELECT uid FROM socket WHERE id='${authorizedSocketId}'`), "phase4authuser01");
    assert.equal(db(`SELECT uid FROM socket WHERE id='${deniedSocketId}'`), "phase4denyuser02");

    authorized.connection.sendUTF("not-json");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(authorized.connection.connected, true);

    const anonymousPush = await service("hello.push");
    assert.equal(anonymousPush.response.status, 403);
    assert.equal(anonymousPush.payload.code, "PERMISSION_DENIED");
    const deniedPush = await service("hello.push", { cookie: deniedCookie });
    assert.equal(deniedPush.response.status, 403);
    assert.equal(deniedPush.payload.code, "PERMISSION_DENIED");

    const pushed = await service("hello.push", { cookie: authorizedCookie });
    assert.equal(pushed.response.status, 200);
    assert.deepEqual(pushed.payload, {
      status: "ok",
      data: { ok: true, module: "hello", scope: "domain", published: true, service: "hello.push", recipients: 1 }
    });
    const event = await waitFor(authorized, (entry) => entry.service === "hello.push");
    assert.deepEqual(event, { service: "hello.push", data: { message: "Hello over WebSocket" } });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(denied.messages.some((entry) => entry.service === "hello.push"), false);

    const browser = await runBrowserPushProbe();
    assert.equal(browser.login, "true");
    assert.equal(browser.socket, "connected");
    assert.equal(browser.push, "Hello over WebSocket");
    assert.match(browser.text, /Status: Hello over WebSocket/);

    const logs = run("docker", ["logs", container]);
    assert.equal(logs.status, 0, logs.stderr);
    assert.match(logs.stdout, /kernel push published hello\.push recipients=1/);
    assert.match(logs.stdout, /kernel push delivered hello\.push sockets=1/);
    assert.equal(db("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'd\\_%' ESCAPE '\\\\'"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yp' AND table_name LIKE 'mfs%'"), "0");
    assert.deepEqual(db("SELECT table_name FROM information_schema.tables WHERE table_schema='yp' ORDER BY table_name").split("\n"), ["cookie", "domain", "drumate", "entity", "privilege", "socket"]);

    authorized.connection.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(db(`SELECT COUNT(*) FROM socket WHERE id='${authorizedSocketId}'`), "0");
    authorized = null;
  } finally {
    if (authorized) authorized.connection.close();
    if (denied) denied.connection.close();
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});
