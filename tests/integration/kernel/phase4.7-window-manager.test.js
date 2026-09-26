"use strict";

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const events = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");

function dependencyRoot() {
  const candidates = [
    process.env.DRUMEE_UI_BUILD_NODE_MODULES,
    path.join(root, "target/tooling/ui-build/node_modules")
  ].filter(Boolean);
  const found = candidates.find((candidate) => fs.existsSync(path.join(candidate, "webpack")));
  if (!found) throw new Error("Webpack is required for the Phase 4.7 browser proof");
  return found;
}

function chrome() {
  const candidates = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean);
  const found = candidates.find(fs.existsSync);
  if (!found) throw new Error("Chromium is required for the Phase 4.7 browser proof");
  return found;
}

function compile(config) {
  const webpack = require(path.join(dependencyRoot(), "webpack"));
  return new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error) return reject(error);
    if (stats.hasErrors()) return reject(new Error(stats.toString({ all: false, errors: true })));
    resolve();
  }));
}

async function endpoint(port) {
  for (let attempt = 0; attempt < 100; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      if (response.ok) return (await response.json()).find((entry) => entry.type === "page");
    } catch (_) {}
    await new Promise((resolve) => setTimeout(resolve, 50));
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
        return new Promise((resolve_command, reject_command) => pending.set(id, { resolve_command, reject_command }));
      }
    }));
    socket.addEventListener("error", () => reject(new Error("Chrome DevTools connection failed")));
    socket.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      const call = pending.get(message.id);
      if (!call) return;
      pending.delete(message.id);
      if (message.error) call.reject_command(new Error(message.error.message));
      else call.resolve_command(message.result);
    });
  });
}

async function evaluate(protocol, expression) {
  const response = await protocol.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true });
  if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text);
  return response.result.value;
}

async function point(protocol, selector) {
  return evaluate(protocol, `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return {x:r.left+r.width/2,y:r.top+r.height/2}})()`);
}

async function drag(protocol, from, to, steps = 10) {
  await protocol.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...from });
  await protocol.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1, clickCount: 1 });
  for (let step = 1; step <= steps; step++) {
    await protocol.send("Input.dispatchMouseEvent", {
      type: "mouseMoved", x: from.x + (to.x - from.x) * step / steps,
      y: from.y + (to.y - from.y) * step / steps, button: "left", buttons: 1
    });
  }
  await protocol.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0, clickCount: 1 });
  await new Promise((resolve) => setTimeout(resolve, 80));
}

test("Phase 4.7 mounts real LETC windows and physically exercises drag, resize and generic drop", { timeout: 90000 }, async () => {
  const output_path = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase47-"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase47-profile-"));
  const runtime_root = path.join(root, "target/foundation/ui-runtime");
  const module_root = process.env.KERNEL_WINDOW_MANAGER_ROOT || path.resolve(root, "../window-manager");
  assert.equal(fs.existsSync(path.join(module_root, "package.json")), true, `Standalone Window Manager repository not found: ${module_root}`);
  const { createConfig } = require(path.join(root, "target/tooling/ui-build/lib"));
  const config = createConfig({
    root,
    name: "phase47-window-manager",
    type: "test-fixture",
    entry: "./tests/integration/kernel/fixtures/window-manager/browser-entry.js",
    outputPath: output_path,
    publicPath: "./",
    version: "0.1.0-alpha.1",
    rev: "phase4.7",
    loaderRoots: [dependencyRoot(), path.join(module_root, "node_modules")],
    moduleRoots: [path.join(module_root, "node_modules"), path.join(runtime_root, "node_modules"), dependencyRoot()]
  });
  config.resolve = config.resolve || {};
  config.resolve.alias = {
    ...(config.resolve.alias || {}),
    jquery: path.join(runtime_root, "node_modules/jquery"),
    "@drumee/window-manager/browser$": path.join(module_root, "lib/browser.js")
  };
  await compile(config);
  const metadata = JSON.parse(fs.readFileSync(path.join(output_path, "index.json"), "utf8"));
  fs.writeFileSync(path.join(output_path, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden}#workspace{width:1000px;height:700px;background:#eef2f7}#token{position:absolute;left:20px;top:640px;width:52px;height:32px;background:#ef4444;z-index:9999}</style></head><body><main id="workspace"></main><div id="token" class="generic-token">token</div><script>window.onerror=(m,s,l,c,e)=>document.body.dataset.error=String(e||m)</script><script src="${metadata.entry}"></script></body></html>`);
  const port = 29570 + Math.floor(Math.random() * 100);
  const chrome_process = child_process.spawn(chrome(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--window-size=1200,800", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: ["ignore", "ignore", "pipe"] });
  let chrome_stderr = "";
  chrome_process.stderr.on("data", (chunk) => { chrome_stderr += chunk; });
  let protocol;
  try {
    let page;
    try {
      page = await endpoint(port);
    } catch (error) {
      throw new Error(`${error.message}; Chrome exit=${chrome_process.exitCode}; ${chrome_stderr}`);
    }
    protocol = await devtools(page.webSocketDebuggerUrl);
    await protocol.send("Page.enable");
    await protocol.send("Runtime.enable");
    await protocol.send("Page.navigate", { url: `file://${path.join(output_path, "index.html")}` });
    for (let attempt = 0; attempt < 100; attempt++) {
      const state = await evaluate(protocol, "({ready:document.body.dataset.ready,error:document.body.dataset.error})");
      if (state.error) throw new Error(state.error);
      if (state.ready === "true") break;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    const initial = await evaluate(protocol, "({runtime:document.body.dataset.runtime_ready,jquery:document.body.dataset.jquery_shared,ids:phase47.manager.windows().map(w=>w.window_id),active:phase47.manager.active_window.window_id,a:phase47.a.geometry(),b:phase47.b.geometry(),c:phase47.c.geometry(),text:document.body.innerText})");
    assert.equal(initial.runtime, "true");
    assert.equal(initial.jquery, "true");
    assert.deepEqual(initial.ids, ["window-a", "window-b", "window-c"]);
    assert.match(initial.text, /LETC Window A/);
    assert.match(initial.text, /LETC Window B/);
    assert.match(initial.text, /LETC Window C/);

    const header = await point(protocol, "[data-window_id=window-a] .drumee-window__header");
    await drag(protocol, header, { x: header.x + 100, y: header.y + 70 });
    const moved = await evaluate(protocol, "({a:phase47.a.geometry(),b:phase47.b.geometry(),c:phase47.c.geometry(),stops:phase47.events.drag_stop,active:phase47.manager.active_window.window_id})");
    assert.ok(moved.a.left > initial.a.left + 75 && moved.a.top > initial.a.top + 45);
    assert.deepEqual(moved.b, initial.b);
    assert.deepEqual(moved.c, initial.c);
    assert.equal(moved.stops, 1);
    assert.equal(moved.active, "window-a");

    const body = await point(protocol, "[data-window_id=window-a] .drumee-window__body");
    await drag(protocol, body, { x: body.x + 60, y: body.y + 35 });
    assert.deepEqual(await evaluate(protocol, "phase47.a.geometry()"), moved.a);

    const resize = await evaluate(protocol, "(()=>{const r=document.querySelector('[data-window_id=window-b]').getBoundingClientRect();return {x:r.right-3,y:r.bottom-3}})()");
    await drag(protocol, resize, { x: resize.x + 100, y: resize.y + 75 });
    const resized = await evaluate(protocol, "({a:phase47.a.geometry(),b:phase47.b.geometry(),c:phase47.c.geometry(),stops:phase47.events.resize_stop})");
    assert.ok(resized.b.width > initial.b.width + 70 && resized.b.height > initial.b.height + 45);
    assert.deepEqual(resized.a, moved.a);
    assert.deepEqual(resized.c, initial.c);
    assert.equal(resized.stops, 1);

    const token = await point(protocol, "#token");
    const target = await point(protocol, "[data-window_id=window-a] .drumee-window__body");
    await drag(protocol, token, target, 12);
    const dropped = await evaluate(protocol, "phase47.events");
    assert.ok(dropped.over >= 1);
    assert.equal(dropped.drop, 1);
    assert.deepEqual(dropped.payload, { type: "generic-token", id: 47 });

    await evaluate(protocol, "phase47.manager.activate('window-b');phase47.closed_b=phase47.b;phase47.manager.close('window-b')");
    const closed = await evaluate(protocol, "({ids:phase47.manager.windows().map(w=>w.window_id),active:phase47.manager.active_window.window_id,connected:phase47.closed_b.el.isConnected,installed:phase47.closed_b.interactions.installed,hasData:jQuery.hasData(phase47.closed_b.el),a:phase47.a.state,c:phase47.c.state})");
    assert.deepEqual(closed.ids, ["window-a", "window-c"]);
    assert.equal(closed.connected, false);
    assert.deepEqual(closed.installed, { draggable: false, resizable: false, droppable: false });
    assert.equal(closed.hasData, false);
    assert.equal(closed.a, "open");
    assert.equal(closed.c, "open");
    assert.ok(["window-a", "window-c"].includes(closed.active));
  } finally {
    if (protocol) protocol.close();
    chrome_process.kill("SIGTERM");
    await Promise.race([events.once(chrome_process, "exit"), new Promise((resolve) => setTimeout(resolve, 1500))]);
    fs.rmSync(output_path, { recursive: true, force: true });
    fs.rmSync(profile, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
});
