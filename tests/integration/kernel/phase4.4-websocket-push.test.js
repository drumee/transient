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
const apiHostname = "api.kernel.test";
const externalHostname = "app.external.test";
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

async function service(name, { cookie, origin, body = {}, headers = {}, serviceBase = baseUrl } = {}) {
  const response = await fetch(`${serviceBase}/-/svc/${name}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(cookie ? { cookie } : {}),
      ...(origin ? { origin } : {}),
      ...headers
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

async function authn({ cookie, origin, headers, serviceBase } = {}) {
  const result = await service("bootstrap.authn", { cookie, origin, headers, serviceBase });
  assert.equal(result.response.status, 200);
  assert.match(result.payload.data.token, /^[A-Za-z0-9_-]{22}$/);
  return {
    token: result.payload.data.token,
    cookie: result.response.headers.get("set-cookie") && result.response.headers.get("set-cookie").split(";", 1)[0]
  };
}

function historicalSessionHeaders(sid) {
  return { "x-param-keysel": "regsid", "x-param-regsid": sid };
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
  let page = "<!doctype html><html><body>not configured</body></html>";
  const server = http.createServer((request, response) => {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end(page);
  });
  await new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve()));
  const address = server.address();
  const origin = `http://${externalHostname}:${address.port}`;
  return {
    origin,
    setPage(value) { page = value; },
    close: () => new Promise((resolve) => server.close(resolve))
  };
}

function externalRuntimeProbePage({ apiBase, coreEntry, anonymous = false, reconnect = false }) {
  const options = {
    serviceBase: `${apiBase}/-/svc/`,
    serviceCredentials: "omit",
    websocketUrl: `${apiBase.replace(/^http/, "ws")}/-/websocket/`
  };
  const action = anonymous
    ? `try { await runtime.serviceClient.postService("hello.private", {}); throw new Error("anonymous private request unexpectedly passed"); } catch (error) { if (error.status !== 403) throw error; document.body.dataset.private = "denied"; }`
    : `var HelloWidget=await runtime.Kind.loadPlugin({name:"hello",kind:"hello"});var widget=runtime.mount({kind:"hello"},document.getElementById("hello-root"));var possibleSessionValues=[runtime.regsid,runtime.sessionAuthorization,runtime.options&&runtime.options.regsid,runtime.options&&runtime.options.sessionAuthorization,runtime.serviceClient&&runtime.serviceClient.regsid,runtime.serviceClient&&runtime.serviceClient.sessionAuthorization,widget.runtime&&widget.runtime.regsid,widget.runtime&&widget.runtime.sessionAuthorization,widget.options&&widget.options.regsid,widget.options&&widget.options.sessionAuthorization,widget.model&&widget.model.get("regsid"),widget.model&&widget.model.get("sessionAuthorization"),widget.state&&widget.state.regsid];document.body.dataset.sessionReadable=String(possibleSessionValues.some(function(value){return value!==undefined&&value!==null;}));await widget._pingPromise;var intercepted=false;runtime.serviceClient.fetch=function(url,options){intercepted=Boolean(options&&options.headers&&options.headers["x-param-regsid"]);throw new Error("plugin intercepted private transport");};var pushed=new Promise(function(resolve,reject){widget.once("hello:push",resolve);widget.push().catch(reject);});await pushed;document.body.dataset.transportIntercepted=String(intercepted);document.body.dataset.push=widget.mget("status");`;
  const initialSession = anonymous
    ? ""
    : `var login=await runtime.serviceClient.postService("yp.signin",{uid:"phase4authuser01",password:${JSON.stringify(password)}});if(!login||login.authenticated!==true)throw new Error("cross-site sign-in did not establish a session");`;
  const reconnectStep = reconnect
    ? `await new Promise(function(resolve,reject){var timer=setTimeout(function(){reject(new Error("cross-site reconnect timed out"));},12000);var once=function(){if(connections<2)return;runtime.Websocket.off("connected",once);clearTimeout(timer);resolve();};runtime.Websocket.on("connected",once);runtime.Websocket.socket.close();});document.body.dataset.reconnected="true";`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"></head><body><main id="hello-root"></main><script>window.onerror=function(message,source,line,column){document.body.dataset.error=[message,line,column].join(":");};</script><script src="${apiBase}/-/plugins/ui-runtime/${coreEntry}"></script><script>(async function(){try{var runtime=await window.DrumeeUiRuntime.bootstrap(${JSON.stringify(options)});${initialSession}document.body.dataset.sessionInDom=String(/regsid=[A-Za-z0-9_-]{16,64}/.test(document.documentElement.innerHTML));var connections=0;runtime.Websocket.on("connected",function(data){connections++;document.body.dataset.socket="connected";document.body.dataset.connections=String(connections);document.body.dataset.socketId=(data&&data.socket_id)||"";document.body.dataset.socketUser=(data&&data.user&&data.user.id)||"";});await runtime.Websocket.connect();${reconnectStep}${action}document.body.dataset.complete="true";}catch(error){document.body.dataset.error=String(error);}})();</script></body></html>`;
}

async function runExternalOriginPushProbe(origin) {
  const debugPort = 29245;
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase44-external-chrome-"));
  const process = childProcess.spawn(chrome(), [
    "--headless=new", "--no-sandbox", "--disable-gpu", `--remote-debugging-port=${debugPort}`,
    `--host-resolver-rules=MAP ${apiHostname} 127.0.0.1,MAP ${externalHostname} 127.0.0.1`,
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
        expression: "({complete:document.body.dataset.complete,socket:document.body.dataset.socket,push:document.body.dataset.push,private:document.body.dataset.private,reconnected:document.body.dataset.reconnected,connections:document.body.dataset.connections,socketId:document.body.dataset.socketId,socketUser:document.body.dataset.socketUser,sessionInDom:document.body.dataset.sessionInDom,sessionReadable:document.body.dataset.sessionReadable,transportIntercepted:document.body.dataset.transportIntercepted,error:document.body.dataset.error})",
        returnByValue: true
      });
      const value = result.result.value;
      if (value.error) throw new Error(value.error);
      if (value.complete === "true") return value;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    throw new Error("External-origin browser did not complete the runtime probe");
  } finally {
    if (protocol) protocol.close();
    process.kill("SIGTERM");
    await Promise.race([events.once(process, "exit"), new Promise((resolve) => setTimeout(resolve, 2000))]);
    await removeChromeProfile(profile);
  }
}

test("Phase 4.4 authenticates WebSockets through OTAK, preserves anonymous transport and delivers targeted Redis push", { timeout: 240000 }, async () => {
  const externalHost = await startExternalOriginProbe();
  const crossSiteApiBase = `http://${apiHostname}:${process.env.KERNEL_HTTP_PORT || "28642"}`;
  const start = run("/bin/bash", ["-lc", "KERNEL_BUILD_QUIET=1 KERNEL_KEEP_RUNNING=1 scripts/test-env/kernel/test.sh"], {
    env: { ...process.env, KERNEL_WEBSOCKET_ALLOWED_ORIGINS: externalHost.origin }
  });
  assert.equal(start.status, 0, `${start.stdout}\n${start.stderr}`);
  let authorized;
  let denied;
  let anonymous;
  let externalSocket;
  let headerAuthorized;
  let headerAnonymous;
  let rejectedThenAccepted;
  try {
    if (process.env.KERNEL_SCHEMA_MODE === "upgrade") {
      assert.equal(db("SELECT COUNT(*) FROM authn WHERE token='legacy-authn-token-00001'"), "0");
      assert.equal(db("SELECT COUNT(*) FROM authn WHERE token='legacy-null-ctime-otak-01'"), "0");
      assert.equal(db("SELECT uid FROM cookie WHERE id='upgrade-null-session-01'"), "ffffffffffffffff");
      assert.equal(db("SELECT uid FROM socket WHERE id='upgrade-null-socket-000001'"), "ffffffffffffffff");
      assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='authn' AND column_name='ctime'"), "NO");
      assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='cookie' AND column_name='uid'"), "NO");
      assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='socket' AND column_name='uid'"), "NO");
      assert.equal(db("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema='yp' AND table_name='entity' AND column_name='type'"), "1");
    }
    const preflight = await fetch(`${baseUrl}/-/svc/bootstrap.authn`, {
      method: "OPTIONS",
      headers: {
        origin: externalHost.origin,
        "access-control-request-method": "POST",
        "access-control-request-headers": "content-type, x-param-keysel, x-param-regsid"
      }
    });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers.get("access-control-allow-origin"), externalHost.origin);
    assert.match(preflight.headers.get("access-control-allow-headers") || "", /x-param-keysel/i);
    assert.match(preflight.headers.get("access-control-allow-headers") || "", /x-param-regsid/i);
    assert.equal(preflight.headers.get("access-control-expose-headers"), "regsid");

    const missing = await connectionFailure({ token: null });
    assert.equal(missing.status, 401);
    const invalid = await connectionFailure({ token: "invalid-otak-token-0000" });
    assert.equal(invalid.status, 401);
    const noOrigin = await connectionFailure({ token: "invalid-otak-token-0000", origin: null });
    assert.equal(noOrigin.status, 403);

    const expiredAuthn = await authn({ origin: baseUrl });
    db(`UPDATE authn SET ctime = UNIX_TIMESTAMP() - 61 WHERE token='${expiredAuthn.token}'`);
    const expired = await connectionFailure({ token: expiredAuthn.token });
    assert.equal(expired.status, 401);
    assert.equal(db(`SELECT COUNT(*) FROM authn WHERE token='${expiredAuthn.token}'`), "0");

    const unsupportedAuthn = await authn({ origin: baseUrl });
    const unsupported = await connectionFailure({ token: unsupportedAuthn.token, protocol: "ping" });
    assert.equal(unsupported.status, 400);
    const protocolRecovery = await connect({ token: unsupportedAuthn.token });
    protocolRecovery.connection.close();

    const foreignAuthn = await authn({ origin: baseUrl });
    const foreign = await connectionFailure({ token: foreignAuthn.token, origin: "https://foreign.example" });
    assert.equal(foreign.status, 403);
    rejectedThenAccepted = await connect({ token: foreignAuthn.token });

    const concurrentAuthn = await authn({ origin: baseUrl });
    const concurrent = await Promise.allSettled([
      connect({ token: concurrentAuthn.token }),
      connect({ token: concurrentAuthn.token })
    ]);
    assert.equal(concurrent.filter((entry) => entry.status === "fulfilled").length, 1);
    assert.equal(concurrent.filter((entry) => entry.status === "rejected").length, 1);
    const concurrentWinner = concurrent.find((entry) => entry.status === "fulfilled").value;
    concurrentWinner.connection.close();
    assert.equal(db(`SELECT COUNT(*) FROM authn WHERE token='${concurrentAuthn.token}'`), "0");

    const anonymousAuthn = await authn({ origin: baseUrl });
    assert.match(anonymousAuthn.cookie || "", /^regsid=/);
    const anonymousSid = anonymousAuthn.cookie.split("=", 2)[1];
    anonymous = await connect({ token: anonymousAuthn.token });
    assert.match(anonymous.hello.data.socket_id, /^[a-f0-9]{32}$/);
    assert.equal(anonymous.requestPath.includes("regsid"), false);
    assert.equal(anonymous.protocol, "service");
    assert.deepEqual(anonymous.hello.data.user, {});
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${anonymous.hello.data.socket_id}'`), anonymousSid);
    assert.equal(db(`SELECT uid FROM cookie WHERE id='${anonymousSid}'`), "ffffffffffffffff");
    assert.equal(db(`SELECT uid FROM socket WHERE id='${anonymous.hello.data.socket_id}'`), "ffffffffffffffff");
    assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='cookie' AND column_name='uid'"), "NO");
    assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='socket' AND column_name='uid'"), "NO");

    const existingAnonymousAuthn = await authn({ cookie: anonymousAuthn.cookie, origin: baseUrl });
    assert.equal(existingAnonymousAuthn.cookie, null);
    const existingAnonymous = await connect({ token: existingAnonymousAuthn.token });
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${existingAnonymous.hello.data.socket_id}'`), anonymousSid);
    existingAnonymous.connection.close();

    const anonymousHeaderAuthn = await authn({
      headers: historicalSessionHeaders(anonymousSid),
      origin: externalHost.origin
    });
    assert.equal(anonymousHeaderAuthn.cookie, null);
    headerAnonymous = await connect({ token: anonymousHeaderAuthn.token, origin: externalHost.origin });
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${headerAnonymous.hello.data.socket_id}'`), anonymousSid);

    const anonymousPrivate = await service("hello.private", { cookie: anonymousAuthn.cookie });
    assert.equal(anonymousPrivate.response.status, 403);
    assert.equal(anonymousPrivate.payload.code, "PERMISSION_DENIED");
    const anonymousPush = await service("hello.push", { cookie: anonymousAuthn.cookie });
    assert.equal(anonymousPush.response.status, 403);
    assert.equal(anonymousPush.payload.code, "PERMISSION_DENIED");
    const anonymousHeaderPrivate = await service("hello.private", {
      headers: historicalSessionHeaders(anonymousSid),
      origin: externalHost.origin
    });
    assert.equal(anonymousHeaderPrivate.response.status, 403);
    assert.equal(anonymousHeaderPrivate.payload.code, "PERMISSION_DENIED");

    const guestId = db("SELECT conf_value FROM sys_conf WHERE conf_key='guest_id'");
    assert.notEqual(guestId, "ffffffffffffffff");
    assert.equal(db(`SELECT username FROM drumate WHERE id='${guestId}'`), "guest");
    db(`INSERT INTO cookie (id, uid, ctime, mtime, ua, ttl, failed, status) VALUES ('guest-session-phase4-01', '${guestId}', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 'fixture', 2592000, 0, 'ok')`);
    const guestCookie = "regsid=guest-session-phase4-01";
    const guestAuthn = await authn({ cookie: guestCookie, origin: baseUrl });
    const guestSocket = await connect({ token: guestAuthn.token });
    assert.equal(db(`SELECT uid FROM socket WHERE id='${guestSocket.hello.data.socket_id}'`), guestId);
    assert.deepEqual(guestSocket.hello.data.user, {});
    const guestPrivate = await service("hello.private", { cookie: guestCookie });
    assert.equal(guestPrivate.response.status, 403);
    assert.equal(guestPrivate.payload.code, "PERMISSION_DENIED");
    guestSocket.connection.close();
    // A missing guest configuration must never reinterpret this actual
    // provisioned guest UID as a signed-in normal Drumate.
    db("DELETE FROM sys_conf WHERE conf_key='guest_id'");
    const missingGuestPrivate = await service("hello.private", { cookie: guestCookie });
    assert.equal(missingGuestPrivate.response.status, 403);
    assert.equal(missingGuestPrivate.payload.code, "PERMISSION_DENIED");
    db(`INSERT INTO sys_conf (conf_key, conf_value) VALUES ('guest_id', '${guestId}')`);

    // Fresh target schemas are NOT NULL, but a pre-existing nullable legacy
    // row is repaired through session_ensure before it reaches a KernelSession.
    db("ALTER TABLE cookie MODIFY uid varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL");
    try {
      db("INSERT INTO cookie (id, uid, ctime, mtime, ua, ttl, failed, status) VALUES ('legacy-null-session-01', NULL, UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 'legacy', 2592000, 0, 'new')");
      const legacyCookie = "regsid=legacy-null-session-01";
      const legacyAuthn = await authn({ cookie: legacyCookie, origin: baseUrl });
      assert.equal(legacyAuthn.cookie, null);
      assert.equal(db("SELECT uid FROM cookie WHERE id='legacy-null-session-01'"), "ffffffffffffffff");
      const legacySocket = await connect({ token: legacyAuthn.token });
      assert.equal(db(`SELECT uid FROM socket WHERE id='${legacySocket.hello.data.socket_id}'`), "ffffffffffffffff");
      legacySocket.connection.close();
    } finally {
      db("UPDATE cookie SET uid='ffffffffffffffff' WHERE uid IS NULL");
      db("ALTER TABLE cookie MODIFY uid varchar(64) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL");
    }
    assert.equal(db("SELECT IS_NULLABLE FROM information_schema.columns WHERE table_schema='yp' AND table_name='cookie' AND column_name='uid'"), "NO");

    // An active OTP carries the selected Drumate principal but cannot use a
    // Domain-protected service. Expiry returns it to the nobody principal.
    db("INSERT INTO cookie (id, uid, ctime, mtime, ua, ttl, failed, status) VALUES ('otp-session-phase4-live', 'phase4authuser01', UNIX_TIMESTAMP(), UNIX_TIMESTAMP(), 'fixture', 2592000, 0, 'otp')");
    const otpCookie = "regsid=otp-session-phase4-live";
    const otpAuthn = await authn({ cookie: otpCookie, origin: baseUrl });
    const otpSocket = await connect({ token: otpAuthn.token });
    assert.equal(db(`SELECT uid FROM socket WHERE id='${otpSocket.hello.data.socket_id}'`), "phase4authuser01");
    assert.deepEqual(otpSocket.hello.data.user, {});
    const otpPrivate = await service("hello.private", { cookie: otpCookie });
    assert.equal(otpPrivate.response.status, 403);
    otpSocket.connection.close();
    db("INSERT INTO cookie (id, uid, ctime, mtime, ua, ttl, failed, status) VALUES ('otp-session-phase4-expired', 'phase4authuser01', UNIX_TIMESTAMP()-601, UNIX_TIMESTAMP()-601, 'fixture', 2592000, 0, 'otp')");
    const expiredOtpCookie = "regsid=otp-session-phase4-expired";
    const expiredOtpAuthn = await authn({ cookie: expiredOtpCookie, origin: baseUrl });
    assert.equal(db("SELECT uid FROM cookie WHERE id='otp-session-phase4-expired'"), "ffffffffffffffff");
    assert.equal(db("SELECT status FROM cookie WHERE id='otp-session-phase4-expired'"), "new");
    const expiredOtpSocket = await connect({ token: expiredOtpAuthn.token });
    assert.equal(db(`SELECT uid FROM socket WHERE id='${expiredOtpSocket.hello.data.socket_id}'`), "ffffffffffffffff");
    expiredOtpSocket.connection.close();

    const unknownHeader = await service("bootstrap.authn", {
      headers: historicalSessionHeaders("unknown-session-000000"),
      origin: externalHost.origin
    });
    assert.equal(unknownHeader.response.status, 401);
    assert.equal(unknownHeader.payload.code, "SESSION_CONTEXT_INVALID");
    const malformedHeader = await service("bootstrap.authn", {
      headers: { "x-param-keysel": "regsid", "x-param-regsid": "bad" },
      origin: externalHost.origin
    });
    assert.equal(malformedHeader.response.status, 401);
    assert.equal(malformedHeader.payload.code, "SESSION_CONTEXT_INVALID");

    const authorizedCookie = await signin("phase4-auth@kernel.test");
    const deniedCookie = await signin("phase4-denied@kernel.test");
    const authorizedSid = authorizedCookie.split("=", 2)[1];
    const deniedSid = deniedCookie.split("=", 2)[1];
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
    assert.equal(db(`SELECT uid FROM cookie WHERE id='${authorizedSid}'`), "phase4authuser01");
    assert.equal(db(`SELECT status FROM cookie WHERE id='${authorizedSid}'`), "ok");
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${authorizedSocketId}'`), authorizedSid);
    assert.equal(db(`SELECT COUNT(*) FROM authn WHERE token='${authorizedAuthn.token}'`), "0");
    assert.equal(authorized.requestPath.includes("regsid"), false);

    const matchingContext = await authn({
      cookie: authorizedCookie,
      headers: historicalSessionHeaders(authorizedSid),
      origin: externalHost.origin
    });
    assert.equal(matchingContext.cookie, null);
    const conflictingContext = await service("bootstrap.authn", {
      cookie: authorizedCookie,
      headers: historicalSessionHeaders(deniedSid),
      origin: externalHost.origin
    });
    assert.equal(conflictingContext.response.status, 401);
    assert.equal(conflictingContext.payload.code, "SESSION_CONTEXT_CONFLICT");

    const authorizedHeaderAuthn = await authn({
      headers: historicalSessionHeaders(authorizedSid),
      origin: externalHost.origin
    });
    assert.equal(authorizedHeaderAuthn.cookie, null);
    headerAuthorized = await connect({ token: authorizedHeaderAuthn.token, origin: externalHost.origin });
    assert.equal(db(`SELECT session_id FROM socket WHERE id='${headerAuthorized.hello.data.socket_id}'`), authorizedSid);
    const authorizedHeaderPrivate = await service("hello.private", {
      headers: historicalSessionHeaders(authorizedSid),
      origin: externalHost.origin
    });
    assert.equal(authorizedHeaderPrivate.response.status, 200);

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
      // The cookie and header-recovered connections deliberately share the
      // same session; targeted delivery reaches both, never the denied user.
      data: { ok: true, module: "hello", scope: "domain", published: true, service: "hello.push", recipients: 2 }
    });
    const event = await waitFor(authorized, (entry) => entry.service === "hello.push");
    assert.deepEqual(event, { service: "hello.push", data: { message: "Hello over WebSocket" } });
    await new Promise((resolve) => setTimeout(resolve, 150));
    assert.equal(denied.messages.some((entry) => entry.service === "hello.push"), false);

    const externalAuthn = await authn({ origin: externalHost.origin });
    externalSocket = await connect({ token: externalAuthn.token, origin: externalHost.origin });
    assert.match(externalSocket.hello.data.socket_id, /^[a-f0-9]{32}$/);
    assert.equal(externalSocket.requestPath.includes("regsid"), false);

    const runtimeMetadata = await (await fetch(`${baseUrl}/-/plugins/ui-runtime/index.json`)).json();
    assert.match(runtimeMetadata.entry, /\.js$/);
    externalHost.setPage(externalRuntimeProbePage({
      apiBase: crossSiteApiBase,
      coreEntry: runtimeMetadata.entry,
      reconnect: true
    }));
    const externalBrowser = await runExternalOriginPushProbe(externalHost.origin);
    assert.equal(externalBrowser.socket, "connected");
    assert.equal(externalBrowser.push, "Hello over WebSocket");
    assert.equal(externalBrowser.reconnected, "true");
    assert.equal(externalBrowser.connections, "2");
    assert.match(externalBrowser.socketId, /^[a-f0-9]{32}$/);
    assert.equal(externalBrowser.socketUser, "phase4authuser01");
    assert.equal(externalBrowser.sessionInDom, "false");
    assert.equal(externalBrowser.sessionReadable, "false");
    assert.equal(externalBrowser.transportIntercepted, "false");
    assert.equal(externalBrowser.error, undefined);

    externalHost.setPage(externalRuntimeProbePage({
      apiBase: crossSiteApiBase,
      coreEntry: runtimeMetadata.entry,
      anonymous: true
    }));
    const anonymousBrowser = await runExternalOriginPushProbe(externalHost.origin);
    assert.equal(anonymousBrowser.socket, "connected");
    assert.equal(anonymousBrowser.private, "denied");
    assert.match(anonymousBrowser.socketId, /^[a-f0-9]{32}$/);
    assert.equal(anonymousBrowser.socketUser, "");
    assert.equal(anonymousBrowser.sessionInDom, "false");
    assert.equal(anonymousBrowser.error, undefined);

    const browser = await runBrowserPushProbe();
    assert.equal(browser.login, "true");
    assert.equal(browser.socket, "connected");
    assert.equal(browser.push, "Hello over WebSocket");
    assert.match(browser.text, /Status: Hello over WebSocket/);

    const logs = run("docker", ["logs", container]);
    assert.equal(logs.status, 0, logs.stderr);
    assert.match(logs.stdout, /kernel push published hello\.push recipients=1/);
    assert.match(logs.stdout, /kernel push delivered hello\.push sockets=1/);
    assert.match(logs.stdout, /kernel dispatched bootstrap\.authn session-source=authorization cookie=absent/);
    assert.equal(logs.stdout.includes(authorizedSid), false);
    assert.equal(logs.stdout.includes(authorizedHeaderAuthn.token), false);
    assert.equal(logs.stdout.includes("?otak="), false);
    assert.equal(db("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name LIKE 'd\\_%' ESCAPE '\\\\'"), "0");
    assert.equal(db("SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='yp' AND table_name LIKE 'mfs%'"), "0");
    assert.deepEqual(db("SELECT table_name FROM information_schema.tables WHERE table_schema='yp' ORDER BY table_name").split("\n"), ["authn", "cookie", "domain", "drumate", "entity", "privilege", "socket", "sys_conf"]);

    authorized.connection.close();
    await new Promise((resolve) => setTimeout(resolve, 100));
    assert.equal(db(`SELECT COUNT(*) FROM socket WHERE id='${authorizedSocketId}'`), "0");
    authorized = null;
  } finally {
    if (authorized) authorized.connection.close();
    if (denied) denied.connection.close();
    if (anonymous) anonymous.connection.close();
    if (externalSocket) externalSocket.connection.close();
    if (headerAuthorized) headerAuthorized.connection.close();
    if (headerAnonymous) headerAnonymous.connection.close();
    if (rejectedThenAccepted) rejectedThenAccepted.connection.close();
    await externalHost.close();
    const stop = run("scripts/test-env/kernel/down.sh", []);
    assert.equal(stop.status, 0, `${stop.stdout}\n${stop.stderr}`);
  }
});
