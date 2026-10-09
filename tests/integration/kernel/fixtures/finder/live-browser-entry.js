"use strict";

const runtime_api = require("@drumee/ui-runtime/browser");
const window_manager_api = require("@drumee/window-manager/browser");
const finder_api = require("@drumee/finder");
const { FinderWindow } = require("@drumee/finder/window");

class HttpTransport {
  constructor(base_url) { this.base_url = base_url; this.regsid = null; this.exchanges = []; }
  headers(extra = {}) { return { ...extra, ...(this.regsid ? { "x-param-keysel": "regsid", "x-param-regsid": this.regsid } : {}) }; }
  async response(service, options) {
    const response = await fetch(`${this.base_url}/-/svc/${service}`, options);
    const regsid = response.headers.get("regsid");
    if (regsid) this.regsid = regsid;
    return response;
  }
  async postService(service, input = {}) {
    const response = await this.response(service, { method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify(input) });
    const payload = await response.json();
    this.exchanges.push(JSON.stringify(payload));
    if (!response.ok || payload.status !== "ok") throw Object.assign(new Error(`${service}: ${payload.code || "SERVICE_FAILED"}`), { code: payload.code || "SERVICE_FAILED", service });
    return payload.data;
  }
  async uploadBinary(service, input, body) {
    const query = new URLSearchParams(Object.fromEntries(Object.entries(input).map(([key, value]) => [key, String(value)])));
    const response = await this.response(`${service}?${query}`, { method: "POST", headers: this.headers({ "content-type": "application/octet-stream" }), body });
    const payload = await response.json();
    this.exchanges.push(JSON.stringify(payload));
    if (!response.ok) throw Object.assign(new Error(payload.code), { code: payload.code });
    return payload.data;
  }
  async bytes(node) {
    const response = await this.response("phase49.bytes", { method: "POST", headers: this.headers({ "content-type": "application/json" }), body: JSON.stringify({ node }) });
    if (!response.ok) throw new Error(`Byte retrieval failed: ${response.status}`);
    return new Uint8Array(await response.arrayBuffer());
  }
}

window.Phase49Ready = (async () => {
  const config = window.PHASE49_CONFIG;
  const owner_transport = new HttpTransport(config.service_url);
  const reader_transport = new HttpTransport(config.service_url);
  await owner_transport.postService("yp.signin", { uid: "phase49-owner@kernel.test", password: config.password });
  await reader_transport.postService("yp.signin", { uid: "phase49-reader@kernel.test", password: config.password });
  const created = await owner_transport.postService("phase49.create", {});
  await owner_transport.postService("phase49.grant", { hub_id: created.a.hub_id, target_uid: created.reader_uid });
  await owner_transport.postService("phase49.grant", { hub_id: created.b.hub_id, target_uid: created.reader_uid });

  const owner_socket = new runtime_api.Websocket({ global: window, url: config.websocket_url, serviceClient: owner_transport, WebSocket });
  const reader_socket = new runtime_api.Websocket({ global: window, url: config.websocket_url, serviceClient: reader_transport, WebSocket });
  const socket_events = { owner: [], reader: [] };
  owner_socket.on("message", (value) => socket_events.owner.push(value));
  reader_socket.on("message", (value) => socket_events.reader.push(value));
  await Promise.all([owner_socket.connect(), reader_socket.connect()]);

  const runtime = await runtime_api.bootstrap({ serviceClient: owner_transport, websocket: owner_socket });
  finder_api.registerFinderKinds(runtime);
  const owner_sync = new finder_api.MfsSync({ websocket: owner_socket });
  const reader_sync = new finder_api.MfsSync({ websocket: reader_socket });
  const owner_client = new finder_api.MfsClient({ transport: owner_transport });
  const reader_client = new finder_api.MfsClient({ transport: reader_transport });
  const transfer_client = new finder_api.MfsTransferClient({ transport: owner_transport });
  const manager = window_manager_api.createWindowManager({ workspace: document.getElementById("workspace"), runtime, jquery: runtime_api.Backbone.$ });
  const common = { mfs_client: owner_client, mfs_sync: owner_sync, transfer_client };
  const a = new FinderWindow({ manager, runtime, finder_options: { finder_id: "live-a", location: created.a.root, title: "Hub A", ...common }, window_options: { window_id: "live-window-a", geometry: { left: 10, top: 10, width: 430, height: 350 } } });
  const b = new FinderWindow({ manager, runtime, finder_options: { finder_id: "live-b", location: created.b.root, title: "Hub B", ...common }, window_options: { window_id: "live-window-b", geometry: { left: 460, top: 10, width: 430, height: 350 } } });
  const reader = runtime.mount({ kind: "finder", finder_id: "live-reader", location: created.a.root, mfs_client: reader_client, mfs_sync: reader_sync }, document.getElementById("reader-host"));
  await Promise.all([a.finder.refresh(), b.finder.refresh(), reader.refresh()]);
  window.phase49 = { runtime, manager, a, b, reader, created, owner_transport, reader_transport, owner_client, reader_client, transfer_client, owner_socket, reader_socket, owner_sync, reader_sync, socket_events };
  document.body.dataset.ready = "true";
  return window.phase49;
})().catch((error) => { document.body.dataset.error = error.stack || String(error); throw error; });
