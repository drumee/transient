"use strict";

const runtime_api = require("@drumee/ui-runtime/browser");
const window_manager_api = require("@drumee/window-manager/browser");
const finder_api = require("@phase48/finder");
const { FinderWindow } = require("@phase48/finder/window");

const hub_x = "a000000000000001";
const hub_y = "b000000000000002";
const x_root = { hub_id: hub_x, nid: "1000000000000001" };
const x_docs = { hub_id: hub_x, nid: "1000000000000002" };
const y_root = { hub_id: hub_y, nid: "2000000000000001" };

function model() {
  const by_parent = new Map();
  const add = (parent, item) => { const key = `${parent.hub_id}:${parent.nid}`; const values = by_parent.get(key) || []; values.push(item); by_parent.set(key, values); };
  add(x_root, { ...x_docs, parent_id: x_root.nid, filename: "Documents", filetype: "folder" });
  add(x_root, { hub_id: hub_x, nid: "3000000000000001", parent_id: x_root.nid, filename: "readme.txt", filetype: "file", mimetype: "text/plain" });
  for (let index = 0; index < 250; index++) add(x_docs, { hub_id: hub_x, nid: (4000 + index).toString(16).padStart(16, "0"), parent_id: x_docs.nid, filename: `item-${String(index).padStart(3, "0")}.txt`, filetype: "file", mimetype: index % 2 ? "image/png" : "application/pdf" });
  add(y_root, { hub_id: hub_y, nid: "5000000000000001", parent_id: y_root.nid, filename: "Existing", filetype: "folder" });
  return { by_parent };
}

window.Phase48Ready = runtime_api.bootstrap().then((runtime) => {
  finder_api.registerFinderKinds(runtime);
  const state = model();
  let copy_serial = 0;
  let transfer_serial = 0;
  const telemetry = { list_calls: 0, media: [], binary: [], transfer: [] };
  const key = (node) => `${node.hub_id}:${node.nid}`;
  const emit = (event) => runtime.Websocket._onMessage({ data: JSON.stringify({ service: "mfs.event", data: event }) });
  const transport = {
    async postService(service, input) {
      if (service === "mfs.list") {
        telemetry.list_calls++;
        const all = state.by_parent.get(key(input.location)) || [];
        const offset = input.cursor ? Number(atob(input.cursor)) : 0;
        const limit = input.limit || 100;
        return { items: all.slice(offset, offset + limit), next_cursor: offset + limit < all.length ? btoa(String(offset + limit)) : null };
      }
      if (service === "mfs.get") {
        for (const items of state.by_parent.values()) { const found = items.find((item) => key(item) === key(input.node)); if (found) return found; }
        return { ...input.node, parent_id: "0", filename: "Root", filetype: "root" };
      }
      if (service === "mfs.move") {
        const moved = [];
        for (const identity of input.nodes) {
          for (const [parent_key, items] of state.by_parent) {
            const index = items.findIndex((item) => key(item) === key(identity));
            if (index < 0) continue;
            const [item] = items.splice(index, 1);
            const [source_hub, source_nid] = parent_key.split(":");
            item.parent_id = input.destination.nid;
            const target = state.by_parent.get(key(input.destination)) || [];
            target.push(item); state.by_parent.set(key(input.destination), target);
            moved.push({ ...item, source_parent: { hub_id: source_hub, nid: source_nid }, destination: input.destination });
          }
        }
        const operation_id = input.operation_id || "move";
        for (const item of moved) emit({ type: "node.moved", operation_id, node: { hub_id: item.hub_id, nid: item.nid }, source_parent: item.source_parent, destination: input.destination, result: { nodes: [item] } });
        return { operation_id, result: { nodes: moved, destination: input.destination } };
      }
      if (service === "mfs.copy") {
        const copied = [];
        for (const identity of input.nodes) for (const items of state.by_parent.values()) {
          const source = items.find((item) => key(item) === key(identity)); if (!source) continue;
          const item = { ...source, hub_id: input.destination.hub_id, nid: (++copy_serial).toString(16).padStart(16, "f"), parent_id: input.destination.nid };
          const target = state.by_parent.get(key(input.destination)) || []; target.push(item); state.by_parent.set(key(input.destination), target); copied.push({ item, node: { hub_id: item.hub_id, nid: item.nid }, source: identity }); break;
        }
        const operation_id = input.operation_id || "copy";
        emit({ type: "node.copied", operation_id, destination: input.destination, result: { nodes: copied } });
        return { operation_id, result: { nodes: copied, destination: input.destination } };
      }
      if (service === "mfs-transfer.upload_start") { const transfer_id = `upload-${++transfer_serial}`; telemetry.transfer.push(["upload_start", transfer_id]); return { transfer_id, chunk_size: 4 }; }
      if (service === "mfs-transfer.upload_complete") { telemetry.transfer.push(["upload_complete", input.transfer_id]); return { result: { hub_id: input.destination && input.destination.hub_id || hub_x, nid: `upload-node-${transfer_serial}` } }; }
      if (service === "mfs-transfer.upload_abort") { telemetry.transfer.push(["upload_abort", input.transfer_id]); return { cancelled: true }; }
      if (service === "mfs-transfer.download_prepare") { const transfer_id = `download-${++transfer_serial}`; telemetry.transfer.push(["download_prepare", transfer_id]); return { transfer_id, status: "ready" }; }
      if (service === "mfs-transfer.download_status") return { transfer_id: input.transfer_id, status: "ready" };
      if (service === "mfs-transfer.download_retrieve") { telemetry.transfer.push(["download_retrieve", input.transfer_id]); return { url: `/-/svc/mfs-transfer.download_retrieve?transfer_id=${input.transfer_id}`, filename: "finder.zip" }; }
      if (service === "mfs-transfer.download_cancel") { telemetry.transfer.push(["download_cancel", input.transfer_id]); return { cancelled: true }; }
      if (service === "mfs-transfer.download_release") { telemetry.transfer.push(["download_release", input.transfer_id]); return { released: true }; }
      throw new Error(`Unsupported fixture service ${service}`);
    },
    async uploadBinary(service, input, body) { telemetry.binary.push({ service, input, is_blob: body instanceof Blob, size: body.size }); return { uploaded: body.size }; },
    serviceUrl(service, input) { telemetry.media.push({ service, input }); return `https://kernel.test/-/svc/${service}?hub_id=${input.hub_id}&nid=${input.nid}`; }
  };
  const mfs_client = new finder_api.MfsClient({ transport });
  const transfer_client = new finder_api.MfsTransferClient({ transport });
  const media_client = new finder_api.MediaClient({ transport });
  const sync = new finder_api.MfsSync({ websocket: runtime.Websocket });
  const common = { mfs_client, mfs_sync: sync, transfer_client, media_client };
  const plain = runtime.mount({ kind: "finder", finder_id: "plain-finder", location: x_docs, title: "Documents", ...common }, document.getElementById("plain-host"));
  const manager = window_manager_api.createWindowManager({ workspace: document.getElementById("workspace"), runtime, jquery: runtime_api.Backbone.$ });
  const a = new FinderWindow({ manager, runtime, finder_options: { finder_id: "finder-a", location: x_root, title: "Hub X", ...common }, window_options: { window_id: "finder-window-a", geometry: { left: 20, top: 20, width: 420, height: 330 } } });
  const b = new FinderWindow({ manager, runtime, finder_options: { finder_id: "finder-b", location: y_root, title: "Hub Y", ...common }, window_options: { window_id: "finder-window-b", geometry: { left: 470, top: 20, width: 420, height: 330 } } });
  window.phase48 = { runtime, manager, plain, a, b, sync, state, emit, common, telemetry };
  document.body.dataset.runtimeReady = String(runtime.isReady);
  return Promise.all([plain.refresh(), a.finder.refresh(), b.finder.refresh()]).then(() => { document.body.dataset.ready = "true"; return window.phase48; });
}).catch((error) => { document.body.dataset.error = error.stack || String(error); throw error; });
