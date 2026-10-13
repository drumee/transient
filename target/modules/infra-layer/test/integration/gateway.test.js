"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const http = require("node:http");
const crypto = require("node:crypto");
const { spawn, spawnSync } = require("node:child_process");
const { once } = require("node:events");
const test = require("node:test");
const { client: WebSocketClient } = require("websocket");
const api = require("../../lib");
const adapter = require("../../adapters/docker/nginx");
const { inputs } = require("../support/inputs");
const port = Number(process.env.IL1_PORT);
if (!port) throw new Error("Run through test/integration/run.js; an isolated gateway is mandatory");
const hostname = `kernel.test:${port}`, origin = `http://${hostname}`;
const hub_a = "b000000000000002", hub_b = "c000000000000003", nid = "d000000000000004";
const root_node = { hub_id: hub_a, nid: "e000000000000005" };
const cookies = new Map();
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function request(method, route, { headers = {}, body } = {}) {
  return new Promise((resolve, reject) => {
    const req = http.request({ hostname: "127.0.0.1", port, path: route, method, headers: { host: hostname, ...headers }, timeout: 15000 }, (response) => {
      const chunks = []; response.on("data", (chunk) => chunks.push(chunk)); response.on("end", () => resolve({ status: response.statusCode, headers: response.headers, body: Buffer.concat(chunks) })); response.on("error", reject);
    });
    req.on("error", reject); req.on("timeout", () => req.destroy(new Error("HTTP_TEST_TIMEOUT"))); req.end(body);
  });
}
async function service(name, input = {}, user = "owner", options = {}) {
  const result = await request("POST", `/-/svc/${name}`, { headers: { "content-type": "application/json", ...(cookies.has(user) ? { cookie: cookies.get(user) } : {}), ...options.headers }, body: JSON.stringify(input) });
  assert.equal(result.status, options.status || 200, `Unexpected ${name} status (no credential output)`);
  return { ...result, value: JSON.parse(result.body.toString()) };
}
async function login(user) {
  const response = await service("yp.signin", { uid: user, password: "isolated-fixture-password" }, "anonymous");
  assert.equal(response.value.data.authenticated, true); assert.ok(/HttpOnly; SameSite=Strict/.test(response.headers["set-cookie"][0]), "session cookie attributes required");
  cookies.set(user, response.headers["set-cookie"][0].split(";")[0]);
  assert.ok(response.headers.regsid === cookies.get(user).split("=")[1], "session response bridge must match cookie");
}
function media(node = nid, hub_id = hub_a) { return `/-/svc/media.orig?hub_id=${hub_id}&nid=${node}`; }
function docker(...args) { const result = spawnSync("docker", args, { encoding: "utf8", timeout: 20000 }); assert.equal(result.status, 0, result.stderr); return result.stdout; }
function openSocket(token, protocol = "service", requested_origin = origin) {
  return new Promise((resolve, reject) => {
    const client = new WebSocketClient();
    client.once("connectFailed", () => reject(new Error("WEBSOCKET_REJECTED")));
    client.once("httpResponse", () => reject(new Error("WEBSOCKET_REJECTED")));
    client.once("connect", (connection) => {
      const messages = []; connection.on("message", (message) => { if (message.type === "utf8") messages.push(JSON.parse(message.utf8Data)); });
      resolve({ connection, messages, async wait(service_name) { for (let index = 0; index < 100; index++) { const message = messages.find((entry) => entry.service === service_name); if (message) return message; await delay(30); } throw new Error("WEBSOCKET_MESSAGE_TIMEOUT"); } });
    });
    client.connect(`ws://127.0.0.1:${port}/-/websocket/${token ? `?otak=${encodeURIComponent(token)}` : ""}`, protocol, requested_origin, { Host: hostname });
  });
}
test.before(async () => { for (const user of ["owner", "reader", "intruder"]) await login(user); });

test("Nginx syntax, rootless/read-only mounts and observed functional readiness", async () => {
  docker("exec", process.env.IL1_GATEWAY_ID, "nginx", "-t");
  const inspected = JSON.parse(docker("inspect", process.env.IL1_GATEWAY_ID))[0];
  assert.equal(inspected.Config.User, "101:101"); assert.equal(inspected.HostConfig.ReadonlyRootfs, true);
  assert.equal(inspected.HostConfig.Privileged, false); assert.ok(inspected.Mounts.every((mount) => mount.Type !== "bind" || mount.RW === false));
  assert.ok(Object.values(inspected.HostConfig.PortBindings).flat().every((binding) => binding.HostIp === "127.0.0.1"));
  const plan = JSON.parse(fs.readFileSync(process.env.IL1_PLAN));
  const observed = await api.inspectInfrastructure({ id: "il1-gateway", desired_revision: process.env.IL1_REVISION, container_id: process.env.IL1_GATEWAY_ID, plan }, adapter);
  assert.equal(observed.observed_revision, plan.revision); assert.equal(observed.verification.functional, true);
  assert.equal(observed.loaded_configuration.status, "unverified");
  assert.equal(api.diagnoseInfrastructure(observed, inputs().requirements).ready, false);
  assert.ok(observed.capabilities[0].diagnostic_codes.includes("LOADED_CONFIGURATION_NOT_VERIFIED"));
  const kernel_ports = JSON.parse(docker("inspect", "--format", "{{json .NetworkSettings.Ports}}", process.env.IL1_KERNEL_ID));
  assert.ok(!kernel_ports || Object.values(kernel_ports).every((binding) => binding === null));
});
test("native services, session cookie/header bridge and kernel authorization pass through Nginx", async () => {
  assert.equal((await service("hello.ping", {}, "anonymous")).value.data.message, "Hello from Drumee");
  await service("hello.private", {}, "anonymous", { status: 403 });
  assert.equal((await service("hello.private")).value.data.authenticated, true);
  const sid = cookies.get("owner").split("=")[1];
  const bridged = await service("hello.private", {}, "anonymous", { headers: { "x-param-keysel": "regsid", "x-param-regsid": sid } }); assert.equal(bridged.status, 200);
  await service("hello.private", {}, "owner", { headers: { "x-param-keysel": "regsid", "x-param-regsid": "conflicting-session-value" }, status: 401 });
  await service("yp.signin", { uid: "owner", password: "wrong-fixture-password" }, "anonymous", { status: 401 });
  const preflight = await request("OPTIONS", "/-/svc/bootstrap.authn", { headers: { origin: "https://external-fixture.example" } });
  assert.equal(preflight.status, 204); assert.equal(preflight.headers["access-control-allow-origin"], "https://external-fixture.example"); assert.match(preflight.headers["access-control-expose-headers"], /regsid/);
  const alias = await request("GET", "/-/service/hello.ping"); assert.equal(alias.status, 200);
});
test("page/bootstrap, public bundles and dynamic plugin resolution work, unknown paths fail closed", async () => {
  assert.equal((await request("GET", "/")).status, 200); assert.equal((await request("GET", "/bootstrap.js")).status, 200);
  for (const route of ["/-/app/core.js", "/-/plugins/hello/hello.js", "/-/static/smoke.css"]) assert.equal((await request("GET", route)).status, 200);
  assert.equal((await service("bootstrap.plugin", { name: "hello" }, "anonymous")).value.data.path, "/-/plugins/hello/hello.js");
  for (const route of ["/unregistered", "/-/letc/legacy", "/mfs/anything", "/-/file/raw/x", "/-/svc/hello.ping/extra"]) assert.equal((await request("GET", route)).status, 404);
  assert.equal((await request("GET", "/", { headers: { host: "untrusted.invalid" } })).status, 404);
  assert.equal((await request("GET", "/", { headers: { host: "kernel.test:443" } })).status, 404);
});
test("the direct-edge proxy overwrites forged forwarding metadata and preserves query/method", async () => {
  const response = await request("GET", "/-/svc/probe.headers?value=query-kept", { headers: { "x-real-ip": "203.0.113.77", "x-connecting-ip": "203.0.113.77", "x-forwarded-for": "203.0.113.77", "x-forwarded-proto": "https", "x-forwarded-port": "443", "x-forwarded-host": "evil.example", forwarded: "for=203.0.113.77;host=evil.example" } });
  const data = JSON.parse(response.body).data; assert.equal(data.echoed, "query-kept"); assert.equal(data.host, hostname); assert.notEqual(data.real_ip, "203.0.113.77");
  assert.equal(data.forwarded_for, data.real_ip); assert.equal(data.forwarded_proto, "http"); assert.equal(data.forwarded_port, String(port)); assert.equal(data.forwarded, null); assert.equal(data.forwarded_host, null);
});
test("OTAK, Origin, subprotocol and socket continuity stay kernel-authorized", async (t) => {
  await assert.rejects(() => openSocket(null), /WEBSOCKET_REJECTED/);
  await assert.rejects(() => openSocket(cookies.get("owner").split("=")[1]), /WEBSOCKET_REJECTED/);
  const anonymous = (await service("bootstrap.authn", {}, "anonymous")).value.data.token;
  const anonymous_socket = await openSocket(anonymous); t.after(() => anonymous_socket.connection.close()); assert.deepEqual((await anonymous_socket.wait("sys.hello")).data.user, {});
  const obtain = async () => (await service("bootstrap.authn")).value.data.token;
  await assert.rejects(async () => openSocket(await obtain(), "other"), /WEBSOCKET_REJECTED/);
  await assert.rejects(async () => openSocket(await obtain(), "service", "http://untrusted.invalid"), /WEBSOCKET_REJECTED/);
  const external = await openSocket(await obtain(), "service", "https://external-fixture.example"); t.after(() => external.connection.close()); assert.equal((await external.wait("sys.hello")).data.user.id, "a000000000000001");
  const token = await obtain(); const socket = await openSocket(token); t.after(() => socket.connection.close());
  assert.equal((await socket.wait("sys.hello")).data.user.id, "a000000000000001");
  socket.connection.sendUTF(JSON.stringify(["sys.ping", { marker: "through-nginx" }])); assert.equal((await socket.wait("sys.ping")).data.ok, true);
  await service("hello.push"); assert.equal((await socket.wait("hello.push")).data.message, "Hello over WebSocket");
  await assert.rejects(() => openSocket(token), /WEBSOCKET_REJECTED/);
  socket.connection.close(); const reconnect = await openSocket(await obtain()); t.after(() => reconnect.connection.close()); assert.ok((await reconnect.wait("sys.hello")).data.socket_id);
});
test("every successful original/representation response follows real FileIo; anonymous/user/Hub negatives deny", async () => {
  const before = (await service("probe.statistics")).value.data.delegation_count;
  const response = await request("GET", media(), { headers: { cookie: cookies.get("owner") } });
  assert.equal(response.status, 200); assert.equal(response.body.length, 256 * 1024); assert.equal(Number(response.headers["content-length"]), response.body.length);
  assert.equal(response.headers["content-type"], "application/octet-stream"); assert.match(response.headers["content-disposition"], /original\.bin/); assert.match(response.headers["cache-control"], /no-store/); assert.equal(response.headers["x-accel-redirect"], undefined);
  assert.equal((await service("probe.statistics")).value.data.delegation_count, before + 1);
  for (const user of ["anonymous", "intruder"]) assert.equal((await request("GET", media(), { headers: cookies.has(user) ? { cookie: cookies.get(user) } : {} })).status, user === "anonymous" ? 404 : 403);
  assert.equal((await request("GET", media(nid, hub_b), { headers: { cookie: cookies.get("owner") } })).status, 403);
  assert.equal((await request("GET", media("d000000000000006"), { headers: { cookie: cookies.get("reader") } })).status, 403);
  assert.equal((await service("probe.statistics")).value.data.delegation_count, before + 1, "negative decisions never invoke FileIo");
  assert.equal((await request("GET", media(), { headers: { cookie: cookies.get("reader") } })).status, 200);
  assert.equal((await request("GET", `/-/svc/media.preview?hub_id=${hub_a}&nid=${nid}`, { headers: { cookie: cookies.get("owner") } })).body.toString(), "preview-fixture");
  const master = await request("GET", `/-/vdo/${nid}/${hub_a}/master.m3u8`, { headers: { cookie: cookies.get("owner") } }); assert.equal(master.status, 200); assert.match(master.body.toString(), /#EXTM3U/);
  assert.equal((await request("GET", `/-/vdo/${nid}/${hub_a}/stream-1/segment-1.ts`, { headers: { cookie: cookies.get("owner") } })).body.toString(), "segment-fixture");
});
test("internal URLs, raw/double-encoded traversal and symlink escapes are never public", async () => {
  for (const route of [`/__drumee_artifacts/${hub_a}/${nid}`, `/__drumee_artifacts/${hub_a}/../${nid}`, "/__drumee_artifacts/%252e%252e/outside.txt", "/-/static/../artifacts/file", "/-/static/%2e%2e/outside.txt", "/-/static/%252fetc/passwd"]) {
    const response = await request("GET", route); assert.ok([400, 403, 404].includes(response.status)); assert.doesNotMatch(response.body.toString(), /outside-protected-view|\/fixture\/artifacts/);
  }
  const escaped = await request("GET", media("d000000000000008"), { headers: { cookie: cookies.get("owner") } }); assert.equal(escaped.status, 403); assert.doesNotMatch(escaped.body.toString(), /root:|outside-protected-view/);
  const public_link = await request("GET", "/-/static/escape"); assert.equal(public_link.status, 403); assert.doesNotMatch(public_link.body.toString(), /root:/);
  const invalid = await service("probe.invalid", { hub_id: hub_a }, "owner", { status: 400 }); assert.equal(invalid.value.code, "HOST_ORIGINAL_INVALID");
  const deleted = await request("GET", `/-/svc/probe.deleted?hub_id=${hub_a}`, { headers: { cookie: cookies.get("owner") } }); assert.equal(deleted.status, 404);
  assert.equal((await request("GET", media("ffffffffffffffff"), { headers: { cookie: cookies.get("owner") } })).status, 404);
});
test("Nginx implements actual HEAD, 206, 416, suffix ranges and If-Range", async () => {
  const headers = { cookie: cookies.get("owner") };
  const head = await request("HEAD", media(), { headers }); assert.equal(head.status, 200); assert.equal(head.body.length, 0); assert.equal(Number(head.headers["content-length"]), 256 * 1024);
  const partial = await request("GET", media(), { headers: { ...headers, range: "bytes=10-19" } }); assert.equal(partial.status, 206); assert.equal(partial.headers["content-range"], "bytes 10-19/262144"); assert.deepEqual([...partial.body], [10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
  const suffix = await request("GET", media(), { headers: { ...headers, range: "bytes=-10" } }); assert.equal(suffix.status, 206); assert.equal(suffix.body.length, 10);
  const invalid = await request("GET", media(), { headers: { ...headers, range: "bytes=900000-" } }); assert.equal(invalid.status, 416); assert.equal(invalid.headers["content-range"], "bytes */262144");
  const stale = await request("GET", media(), { headers: { ...headers, range: "bytes=10-19", "if-range": '"not-current"' } }); assert.equal(stale.status, 200); assert.equal(stale.body.length, 262144);
});
test("offline archive worker delivers a real ZIP via FileIo and Nginx", async () => {
  const prepared = (await service("mfs-transfer.download_prepare", { roots: [{ hub_id: hub_a, nid }] })).value.data;
  let status;
  for (let index = 0; index < 100; index++) { status = (await service("mfs-transfer.download_status", { transfer_id: prepared.transfer_id })).value.data; if (status.status === "ready") break; await delay(40); }
  assert.equal(status.status, "ready");
  const response = await request("GET", `/-/svc/mfs-transfer.download_retrieve?transfer_id=${prepared.transfer_id}`, { headers: { cookie: cookies.get("owner") } });
  assert.equal(response.status, 200); assert.equal(response.headers["content-type"], "application/zip"); assert.match(response.headers["content-disposition"], /download\.zip/); assert.deepEqual([...response.body.subarray(0, 4)], [80, 75, 3, 4]);
  // unzip needs seekable input; use an exclusively owned fixture file.
  const zip_file = path.join(process.env.IL1_FIXTURES, "assertion.zip"); fs.writeFileSync(zip_file, response.body);
  const bytes = spawnSync("unzip", ["-p", zip_file], { maxBuffer: 1024 * 1024 }); fs.unlinkSync(zip_file); assert.equal(bytes.status, 0); assert.equal(bytes.stdout.length, 262144);
  await service("mfs-transfer.download_status", { transfer_id: prepared.transfer_id }, "reader", { status: 403 });
  await service("mfs-transfer.download_release", { transfer_id: prepared.transfer_id });
});
test("binary Content-Length, duplicate/out-of-order chunks and hash commit preserve bytes", async () => {
  const content = Buffer.alloc(2 * 256 * 1024 + 71); for (let index = 0; index < content.length; index++) content[index] = index % 251;
  const started = (await service("mfs-transfer.upload_start", { destination: root_node, size: content.length, metadata: { filename: "uploaded.bin", size: content.length } })).value.data;
  const send = async (index) => {
    const body = content.subarray(index * started.chunk_size, Math.min((index + 1) * started.chunk_size, content.length));
    return request("POST", `/-/${index === 1 ? "service" : "svc"}/mfs-transfer.upload_chunk?transfer_id=${started.transfer_id}&index=${index}`, { headers: { cookie: cookies.get("owner"), "content-type": "application/octet-stream", "content-length": body.length }, body });
  };
  for (const index of [2, 0, 0, 1]) assert.equal((await send(index)).status, 200);
  await service("mfs-transfer.upload_chunk", { transfer_id: started.transfer_id, index: -1 }, "owner", { status: 400 });
  const committed = (await service("mfs-transfer.upload_complete", { transfer_id: started.transfer_id, sha256: crypto.createHash("sha256").update(content).digest("hex") })).value.data.result;
  assert.deepEqual((await request("GET", media(committed.nid), { headers: { cookie: cookies.get("owner") } })).body, content);
  assert.equal((await service("probe.statistics")).value.data.incoming, 0);
});
test("slow chunked upload without Content-Length streams before end and respects client backpressure", async () => {
  const size = 256 * 1024;
  const started = (await service("mfs-transfer.upload_start", { destination: root_node, size, metadata: { filename: "streamed.bin", size } })).value.data;
  const req = http.request({ hostname: "127.0.0.1", port, path: `/-/svc/mfs-transfer.upload_chunk?transfer_id=${started.transfer_id}&index=0`, method: "POST", headers: { host: hostname, cookie: cookies.get("owner"), "content-type": "application/octet-stream" } });
  const reply = new Promise((resolve, reject) => { req.on("response", (res) => { res.resume(); res.once("end", () => resolve(res.statusCode)); }); req.once("error", reject); });
  let drains = 0;
  for (let index = 0; index < 4; index++) {
    if (!req.write(Buffer.alloc(64 * 1024, index))) { drains++; await once(req, "drain"); }
    await delay(100);
    if (index === 0) assert.equal((await service("probe.statistics")).value.data.incoming, 1, "backend receives before client end; proxy body buffering is off");
  }
  req.end(); assert.equal(await reply, 200); assert.ok(drains > 0); await service("mfs-transfer.upload_complete", { transfer_id: started.transfer_id });
});
test("a file larger than the binary request ceiling is uploaded in bounded chunks and downloaded intact", async () => {
  const bytes = Buffer.alloc(16 * 1024 * 1024 + 17, 91);
  const started = (await service("mfs-transfer.upload_start", { destination: root_node, size: bytes.length, metadata: { filename: "large-upload.bin", size: bytes.length } })).value.data;
  for (let index = 0; index < Math.ceil(bytes.length / started.chunk_size); index++) {
    const chunk = bytes.subarray(index * started.chunk_size, Math.min((index + 1) * started.chunk_size, bytes.length));
    assert.equal((await request("POST", `/-/svc/mfs-transfer.upload_chunk?transfer_id=${started.transfer_id}&index=${index}`, { headers: { cookie: cookies.get("owner"), "content-type": "application/octet-stream", "content-length": chunk.length }, body: chunk })).status, 200);
  }
  const checksum = crypto.createHash("sha256").update(bytes).digest("hex");
  const node = (await service("mfs-transfer.upload_complete", { transfer_id: started.transfer_id, sha256: checksum })).value.data.result;
  const received = await request("GET", media(node.nid), { headers: { cookie: cookies.get("owner") } });
  assert.equal(received.body.length, bytes.length); assert.equal(crypto.createHash("sha256").update(received.body).digest("hex"), checksum);
});
test("gateway idle-body timeout logs 408, closes the stalled upload and cleans its partial tempfile", { timeout: 15000 }, async () => {
  const started = (await service("mfs-transfer.upload_start", { destination: root_node, size: 256 * 1024, metadata: { filename: "timeout.bin", size: 256 * 1024 } })).value.data;
  const req = http.request({ hostname: "127.0.0.1", port, method: "POST", path: `/-/svc/mfs-transfer.upload_chunk?transfer_id=${started.transfer_id}&index=0`, headers: { host: hostname, cookie: cookies.get("owner"), "content-type": "application/octet-stream", "content-length": 256 * 1024 } });
  const response = new Promise((resolve, reject) => { req.once("response", (res) => { res.resume(); res.once("end", () => resolve(res.statusCode)); }); req.once("error", (error) => error.code === "ECONNRESET" ? resolve("closed") : reject(error)); });
  const begin = Date.now();
  req.write(Buffer.alloc(16384));
  assert.ok([408, "closed"].includes(await response)); assert.ok(Date.now() - begin >= 4500); req.destroy();
  assert.match(docker("logs", process.env.IL1_GATEWAY_ID), /POST \/-\/svc\/mfs-transfer.upload_chunk 408/);
  for (let index = 0; index < 40; index++) { if (!(await service("probe.statistics")).value.data.incoming) break; await delay(50); }
  assert.equal((await service("probe.statistics")).value.data.incoming, 0); await service("mfs-transfer.upload_abort", { transfer_id: started.transfer_id });
});
test("oversized chunks yield 413; unauthorized and aborted uploads leave no incoming tempfiles", async () => {
  const start = async () => (await service("mfs-transfer.upload_start", { destination: root_node, size: 256 * 1024, metadata: { filename: "abort.bin", size: 256 * 1024 } })).value.data;
  const started = await start(); const route = `/-/svc/mfs-transfer.upload_chunk?transfer_id=${started.transfer_id}&index=0`;
  assert.equal((await request("POST", route, { headers: { cookie: cookies.get("owner"), "content-type": "application/octet-stream", "content-length": 1024 * 1024 + 1 }, body: Buffer.alloc(1024 * 1024 + 1) })).status, 413);
  assert.equal((await request("POST", route, { headers: { cookie: cookies.get("intruder"), "content-type": "application/octet-stream" }, body: Buffer.alloc(32) })).status, 403);
  const req = http.request({ hostname: "127.0.0.1", port, path: route, method: "POST", headers: { host: hostname, cookie: cookies.get("owner"), "content-type": "application/octet-stream", "content-length": 256 * 1024 } });
  req.on("error", () => {}); req.write(Buffer.alloc(32 * 1024));
  for (let index = 0; index < 30; index++) { if ((await service("probe.statistics")).value.data.incoming) break; await delay(30); }
  req.destroy();
  for (let index = 0; index < 50; index++) { if (!(await service("probe.statistics")).value.data.incoming) break; await delay(40); }
  assert.equal((await service("probe.statistics")).value.data.incoming, 0); await service("mfs-transfer.upload_abort", { transfer_id: started.transfer_id });
});
test("canceled large download leaves durable original bytes and gateway service available", async () => {
  await new Promise((resolve, reject) => {
    const req = http.get({ hostname: "127.0.0.1", port, path: media("d000000000000007"), headers: { host: hostname, cookie: cookies.get("owner") } }, (res) => { assert.equal(res.statusCode, 200); res.once("data", () => { req.destroy(); resolve(); }); res.on("error", () => {}); }); req.on("error", (error) => { if (error.code !== "ECONNRESET") reject(error); });
  });
  assert.equal(fs.statSync(path.join(process.env.IL1_FIXTURES, "artifacts", hub_a, "d000000000000007")).size, 32 * 1024 * 1024);
  assert.equal((await service("hello.ping")).status, 200);
});
test("gateway/kernel restart preserves original fixtures; interrupted transfer IDs are not resumable", async () => {
  const file = path.join(process.env.IL1_FIXTURES, "artifacts", hub_a, nid); const before = crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex");
  docker("restart", process.env.IL1_GATEWAY_ID);
  for (let index = 0; index < 60; index++) { try { if ((await request("GET", "/__infra_ready")).status === 200) break; } catch (_) {} await delay(100); }
  assert.equal((await request("GET", media(), { headers: { cookie: cookies.get("owner") } })).status, 200);
  const started = (await service("mfs-transfer.upload_start", { destination: root_node, size: 0, metadata: { filename: "restart.bin", size: 0 } })).value.data;
  docker("restart", process.env.IL1_KERNEL_ID);
  for (let index = 0; index < 60; index++) { try { if ((await request("GET", "/__infra_ready")).status === 200) break; } catch (_) {} await delay(100); }
  await login("owner"); await service("mfs-transfer.upload_status", { transfer_id: started.transfer_id }, "owner", { status: 403 });
  assert.equal(crypto.createHash("sha256").update(fs.readFileSync(file)).digest("hex"), before); assert.equal((await service("probe.statistics")).value.data.uploads, 0);
});
test("Chromium loads real LETC + hello through gateway, native services and WebSocket reconnection", { timeout: 45000 }, async (t) => {
  const chrome = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find((file) => fs.existsSync(file));
  assert.ok(chrome, "Chromium is mandatory for Level 4; not silently skipped");
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "il1-chrome-"));
  const child = spawn(chrome, ["--headless=new", "--no-sandbox", "--disable-gpu", "--no-proxy-server", "--remote-debugging-port=0", `--user-data-dir=${profile}`, "--host-resolver-rules=MAP kernel.test 127.0.0.1", "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let stderr = ""; child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
  t.after(async () => { child.kill("SIGTERM"); for (let index = 0; child.exitCode === null && index < 50; index++) await delay(50); if (child.exitCode === null) child.kill("SIGKILL"); fs.rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); });
  let devtools_port;
  for (let index = 0; index < 100; index++) { const match = stderr.match(/DevTools listening on ws:\/\/127\.0\.0\.1:(\d+)/); if (match) { devtools_port = Number(match[1]); break; } await delay(50); }
  assert.ok(devtools_port, "Chrome DevTools did not start");
  const pages = await (await fetch(`http://127.0.0.1:${devtools_port}/json/list`)).json();
  const socket = new WebSocket(pages.find((entry) => entry.type === "page").webSocketDebuggerUrl); await once(socket, "open"); t.after(() => socket.close());
  let serial = 0; const pending = new Map(), failures = [];
  socket.addEventListener("message", ({ data }) => {
    const message = JSON.parse(data); const call = pending.get(message.id);
    if (call) { pending.delete(message.id); message.error ? call.reject(new Error("DEVTOOLS_COMMAND_FAILED")) : call.resolve(message.result); }
    if (message.method === "Runtime.exceptionThrown") failures.push("JAVASCRIPT_EXCEPTION");
    if (message.method === "Network.loadingFailed" && message.params.type !== "WebSocket") failures.push("NETWORK_LOAD_FAILED");
    if (message.method === "Network.responseReceived" && message.params.response.status >= 400) failures.push(`HTTP_${message.params.response.status}`);
  });
  const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++serial; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
  await send("Runtime.enable"); await send("Network.enable"); await send("Page.navigate", { url: `${origin}/` });
  let result;
  for (let index = 0; index < 200; index++) { const inspected = await send("Runtime.evaluate", { expression: "window.IL1_BROWSER_RESULT || null", returnByValue: true }); result = inspected.result.value; if (result && (result.ready || result.errors.length)) break; await delay(75); }
  assert.deepEqual(failures, []); assert.ok(result); assert.deepEqual(result.errors, []); assert.equal(result.ready, true); assert.equal(result.widget_kind, "hello"); assert.equal(result.bootstrap, true); assert.equal(result.pushed, 2); assert.equal(result.connected, "connected");
});
