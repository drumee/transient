"use strict";

const { bootstrap } = require("../../../../foundation/ui-runtime/src/browser");
globalThis.IL1_BROWSER_RESULT = { errors: [] };
window.addEventListener("error", () => { IL1_BROWSER_RESULT.errors.push("JAVASCRIPT_ERROR"); });
window.addEventListener("unhandledrejection", () => { IL1_BROWSER_RESULT.errors.push("UNHANDLED_REJECTION"); });
(async () => {
  const login = await fetch("/-/svc/yp.signin", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ uid: "owner", password: "isolated-fixture-password" }) });
  if (login.status !== 200) throw new Error("LOGIN_FAILED");
  const runtime = await bootstrap({ global: window });
  await runtime.Kind.loadPlugin({ name: "hello", kind: "hello" });
  const widget = runtime.mount({ kind: "hello" }, document.getElementById("widget"));
  await widget.ping();
  let pushed = 0; runtime.Websocket.bindEvent("hello.push", () => { pushed++; });
  await runtime.Websocket.connect();
  await widget.push();
  for (let index = 0; pushed < 1 && index < 100; index++) await new Promise((resolve) => setTimeout(resolve, 20));
  runtime.Websocket.close();
  await runtime.Websocket.connect(); await widget.push();
  for (let index = 0; pushed < 2 && index < 100; index++) await new Promise((resolve) => setTimeout(resolve, 20));
  IL1_BROWSER_RESULT.ready = runtime.isReady;
  IL1_BROWSER_RESULT.widget_kind = widget.model.get("kind");
  IL1_BROWSER_RESULT.bootstrap = IL1_BOOTSTRAP.fixture;
  IL1_BROWSER_RESULT.pushed = pushed;
  IL1_BROWSER_RESULT.connected = runtime.Websocket.state;
})().catch(() => { IL1_BROWSER_RESULT.errors.push("BROWSER_CONTRACT_FAILED"); });
