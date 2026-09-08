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

async function service(name, { cookie, origin, body = {} } = {}) {
  const response = await fetch(`${baseUrl}/-/svc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {})
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

async function authn({ cookie, origin } = {}) {
  const result = await service("bootstrap.authn", { cookie, origin });
  assert.equal(result.response.status, 200);
  assert.match(result.payload.data.token, /^[A-Za-z0-9_-]{22}$/);
  return {
    token: result.payload.data.token,
    cookie: result.response.headers.get("set-cookie") && result.response.headers.get("set-cookie").split(";", 1)[0]
  };
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

function connect({ token, protocol = "service", origin = baseUrl, cookie } = {}) {
  return new Promise((resolve, reject) => {
    const messages = [];
    const url = new URL(websocketUrl.replace(/^ws/, "http"));
    const request = http.request({
      host: url.hostname,
      port: url.port,
      path: `${url.pathname}${token ? `?otak=${encodeURIComponent(token)}` : ""}`,
      headers: {
        Connection: "Upgrade",
        Upgrade: "websocket",
        "Sec-WebSocket-Version": "13",
        "Sec-WebSocket-Key": crypto.randomBytes(16).toString("base64"),
        "Sec-WebSocket-Protocol": protocol,
        ...(origin ? { Origin: origin } : {}),
        ...(cookie ? { Cookie: cookie } : {})
      }
    });
    request.once("error", reject);
    request.once("response", (response) => {
      response.resume();
      const error = new Error(`WebSocket rejected with HTTP ${response.statusCode}`);
      error.status = response.statusCode;
      reject(error);
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
        resolve({ connection, messages, hello, requestPath: request.path, protocol, origin });
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

function connectionFailure(options) {
  return connect(options).then(() => new Error("WebSocket unexpectedly connected"), (error) => error);
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

async function removeChromeProfile(profile) {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      fs.rmSync(profile, { recursive: true, force: true, maxRetries: 2, retryDelay: 100 });
      return;
    } catch (error) {
      if (error.code !== "ENOTEMPTY" || attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 200));
    }
  }
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
    await removeChromeProfile(profile);
  }
}

async function startExternalOriginProbe() {
  const page = `<!doctype html><html><body><script>(async function(){try{const base=${JSON.stringify(baseUrl)};const wsBase=base.replace(/^http/,"ws")+"/-/websocket/";const password=${JSON.stringify(password)};const call=async function(name,body){const response=await fetch(base+"/-/svc/"+name,{method:"POST",credentials:"include",headers:{"content-type":"application/json"},body:JSON.stringify(body||{})});const payload=await response.json();if(!response.ok||payload.status!=="ok")throw new Error(payload.code||"service failed");return payload.data;};await call("yp.signin",{uid:"phase4-auth@kernel.test",password:password});document.body.dataset.login="true";const authn=await call("bootstrap.authn",{});const socket=new WebSocket(wsBase+"?otak="+encodeURIComponent(authn.token),"service");socket.onmessage=async function(event){const message=JSON.parse(event.data);if(message.service==="sys.hello"){document.body.dataset.socket="connected";await call("hello.push",{});}if(message.service==="hello.push"){document.body.dataset.push=message.data.message;}};socket.onerror=function(){document.body.dataset.error="socket";};}catch(error){document.body.dataset.error=String(error);}})();</script></body></html>`;
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
  });
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  const address = server.address();
  const origin = `http://127.0.0.1:${address.port}`;
  return {
    origin,
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

async function runExternalOriginPushProbe(origin) {
  const debugPort = 29245;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase44-external-chrome-"));
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
    await protocol.send("Page.navigate", { url: origin });
    for (let attempt = 0; attempt < 100; attempt++) {
      const result = await protocol.send("Runtime.evaluate", {
        expression: "({login:document.body.dataset.login,socket:document.body.dataset.socket,push:document.body.dataset.push,error:document.body.dataset.error})",
        returnByValue: true
      });
      const value = result.result.value;
      if (value.error) throw new Error(value.error);
      if (value.login === "true" && value.socket === "connected" && value.push === "Hello over WebSocket") return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("External-origin browser did not receive targeted push");
  } finally {
    if (protocol) protocol.close();
    process.kill("SIGTERM");
    await Promise.race([events.once(process, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    await removeChromeProfile(profile);
  }
}

test("Phase 4.4 authenticates WebSockets through OTAK, preserves anonymous transport and delivers targeted Redis push", { timeout: 240000 }, async () => {
  const externalHost = await startExternalOriginProbe();
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"], {
    env: { ...process.env, KERNEL_WEBSOCKET_ALLOWED_ORIGINS: externalHost.origin }
  });
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  let authorized;
  let denied;
  let anonymous;
  let externalSocket;
  let rejectedThenAccepted;
  try {
    const missing = await connectionFailure({ token: null });
    assert.equal(missing.status, 401);
    const invalid = await connectionFailure({ token: "invalid-otak-token-0000" });
    assert.equal(invalid.status, 401);
    const noOrigin = await connectionFailure({ token: "invalid-otak-token-0000", origin: null });
    assert.equal(noOrigin.status, 403);

    const unsupportedAuthn = await authn({ origin: baseUrl });
    const unsupported = await connectionFailure({ token: unsupportedAuthn.token, protocol: "ping" });
    assert.equal(unsupported.status, 400);
    const protocolRecovery = await connect({ token: unsupportedAuthn.token });
    protocolRecovery.connection.close();

    const foreignAuthn = await authn({ origin: baseUrl });
    const foreign = await connectionFailure({ token: foreignAuthn.token, origin: "https://foreign.example" });
    assert.equal(foreign.status, 403);
    rejectedThenAccepted = await connect({ token: foreignAuthn.token });

    const anonymousAuthn = await authn({ origin: baseUrl });
    assert.match(anonymousAuthn.cookie || "", /^regsid=/);
    const anonymousSid = anonymousAuthn.cookie.split("=", 2)[1];
    anonymous = await connect({ token: anonymousAuthn.token });
    assert.match(anonymous.hello.data.socket_id, /^[a-f0-9]{32}$/);
    assert.equal(anonymous.requestPath.includes("regsid"), false);
    assert.equal(anonymous.protocol, "service");
    assert.deepEqual(anonymous.hello.data.user, {});
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${anonymous.hello.data.socket_id}'`), anonymousSid);
    assert.equal(db(`SELECT COUNT(*) FROM socket WHERE id='${anonymous.hello.data.socket_id}' AND uid IS NULL`), "1");

    const existingAnonymousAuthn = await authn({ cookie: anonymousAuthn.cookie, origin: baseUrl });
    assert.equal(existingAnonymousAuthn.cookie, null);
    const existingAnonymous = await connect({ token: existingAnonymousAuthn.token });
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${existingAnonymous.hello.data.socket_id}'`), anonymousSid);
    existingAnonymous.connection.close();

    const anonymousPrivate = await service("hello.private", { cookie: anonymousAuthn.cookie });
    assert.equal(anonymousPrivate.response.status, 403);
    assert.equal(anonymousPrivate.payload.code, "PERMISSION_DENIED");
    const anonymousPush = await service("hello.push", { cookie: anonymousAuthn.cookie });
    assert.equal(anonymousPush.response.status, 403);
    assert.equal(anonymousPush.payload.code, "PERMISSION_DENIED");

    const authorizedCookie = await signin("phase4-auth@kernel.test");
    const deniedCookie = await signin("phase4-denied@kernel.test");
    const authorizedSid = authorizedCookie.split("=", 2)[1];
    const authorizedAuthn = await authn({ cookie: authorizedCookie, origin: baseUrl });
    const deniedAuthn = await authn({ cookie: deniedCookie, origin: baseUrl });
    assert.equal(authorizedAuthn.cookie, null);
    authorized = await connect({ token: authorizedAuthn.token, cookie: "regsid=untrusted-client-value" });
    denied = await connect({ token: deniedAuthn.token });
    const authorizedSocketId = authorized.hello.data.socket_id;
    const deniedSocketId = denied.hello.data.socket_id;
    assert.match(authorizedSocketId, /^[a-f0-9]{32}$/);
    assert.match(deniedSocketId, /^[a-f0-9]{32}$/);
    assert.equal(db(`SELECT uid FROM socket WHERE id='${authorizedSocketId}'`), "phase4authuser01");
    assert.equal(db(`SELECT uid FROM socket WHERE id='${deniedSocketId}'`), "phase4denyuser02");
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${authorizedSocketId}'`), authorizedSid);
    assert.equal(db(`SELECT COUNT(*) FROM authn WHERE token='${authorizedAuthn.token}'`), "0");
    assert.equal(authorized.requestPath.includes("regsid"), false);

    authorized.connection.sendUTF("not-json");
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(authorized.connection.connected, true);

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

    const externalAuthn = await authn({ origin: externalHost.origin });
    externalSocket = await connect({ token: externalAuthn.token, origin: externalHost.origin });
    assert.match(externalSocket.hello.data.socket_id, /^[a-f0-9]{32}$/);
    assert.equal(externalSocket.requestPath.includes("regsid"), false);

    const externalBrowser = await runExternalOriginPushProbe(externalHost.origin);
    assert.equal(externalBrowser.login, "true");
    assert.equal(externalBrowser.socket, "connected");
    assert.equal(externalBrowser.push, "Hello over WebSocket");
    assert.equal(externalBrowser.error, undefined);

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
    assert.deepEqual(db("SELECT table_name FROM information_schema.tables WHERE table_schema='yp' ORDER BY table_name").split("\n"), ["authn", "cookie", "domain", "drumate", "entity", "privilege", "socket"]);

    authorized.connection.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(db(`SELECT COUNT(*) FROM socket WHERE id='${authorizedSocketId}'`), "0");
    authorized = null;
  } finally {
    if (authorized) authorized.connection.close();
    if (denied) denied.connection.close();
    if (anonymous) anonymous.connection.close();
    if (externalSocket) externalSocket.connection.close();
    if (rejectedThenAccepted) rejectedThenAccepted.connection.close();
    await externalHost.close();
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});
