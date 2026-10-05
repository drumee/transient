"use strict";

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const events = require("node:events");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const root = path.resolve(__dirname, "../../..");

function dependencyRoot() { const found = [process.env.DRUMEE_UI_BUILD_NODE_MODULES, path.join(root, "target/tooling/ui-build/node_modules")].filter(Boolean).find((candidate) => fs.existsSync(path.join(candidate, "webpack"))); if (!found) throw new Error("Webpack is required"); return found; }
function chrome() { const found = [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find(fs.existsSync); if (!found) throw new Error("Chromium is required"); return found; }
function compile(config) {
  const webpack = require(path.join(dependencyRoot(), "webpack"));
  return new Promise((resolve, reject) => webpack(config, (error, stats) => {
    if (error) reject(error);
    else if (stats.hasErrors()) reject(new Error(stats.toString({ all: false, errors: true })));
    else resolve();
  }));
}
async function endpoint(port) { for (let attempt = 0; attempt < 100; attempt++) { try { const response = await fetch(`http://127.0.0.1:${port}/json/list`); if (response.ok) return (await response.json()).find((entry) => entry.type === "page"); } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome endpoint unavailable"); }
function devtools(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); const pending = new Map(); let serial = 0; socket.addEventListener("open", () => resolve({ close: () => socket.close(), send(method, params = {}) { const id = ++serial; socket.send(JSON.stringify({ id, method, params })); return new Promise((yes, no) => pending.set(id, { yes, no })); } })); socket.addEventListener("error", reject); socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const call = pending.get(message.id); if (!call) return; pending.delete(message.id); message.error ? call.no(new Error(message.error.message)) : call.yes(message.result); }); }); }
async function evaluate(protocol, expression) { const response = await protocol.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception?.description || response.exceptionDetails.text); return response.result.value; }
async function point(protocol, selector) { return evaluate(protocol, `(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return{x:r.left+r.width/2,y:r.top+r.height/2}})()`); }
async function click(protocol, selector) { const target = await point(protocol, selector); await protocol.send("Input.dispatchMouseEvent", { type: "mousePressed", ...target, button: "left", buttons: 1 }); await protocol.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...target, button: "left", buttons: 0 }); await new Promise((resolve) => setTimeout(resolve, 30)); }
async function drag(protocol, from, to, steps = 8) { await protocol.send("Input.dispatchMouseEvent", { type: "mouseMoved", ...from }); await protocol.send("Input.dispatchMouseEvent", { type: "mousePressed", ...from, button: "left", buttons: 1 }); for (let step = 1; step <= steps; step++) await protocol.send("Input.dispatchMouseEvent", { type: "mouseMoved", x: from.x + (to.x - from.x) * step / steps, y: from.y + (to.y - from.y) * step / steps, button: "left", buttons: 1 }); await protocol.send("Input.dispatchMouseEvent", { type: "mouseReleased", ...to, button: "left", buttons: 0 }); await new Promise((resolve) => setTimeout(resolve, 80)); }
async function removeDirectory(directory) { for (let attempt = 0; attempt < 5; attempt++) { try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); return; } catch (error) { if (attempt === 4) throw error; await new Promise((resolve) => setTimeout(resolve, 150)); } } }

test("Phase 4.8 mounts standalone and managed Finders with optimized selection and transfer", { timeout: 120000 }, async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase48-"));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase48-profile-"));
  const runtime_root = path.resolve(root, "../ui-runtime");
  const window_root = path.resolve(root, "../window-manager");
  const finder_root = path.join(root, "target/modules/finder");
  const { createConfig } = require(path.join(root, "target/tooling/ui-build/lib"));
  const config = createConfig({ root, name: "phase48-finder", type: "test-fixture", entry: "./tests/integration/kernel/fixtures/finder/browser-entry.js", outputPath: output, publicPath: "./", version: "0.0.0-phase4.8", rev: "phase4.8", loaderRoots: [dependencyRoot(), path.join(window_root, "node_modules")], moduleRoots: [path.join(window_root, "node_modules"), path.join(runtime_root, "node_modules"), dependencyRoot()] });
  config.resolve = config.resolve || {}; config.resolve.alias = { ...(config.resolve.alias || {}), jquery: path.join(runtime_root, "node_modules/jquery"), "@drumee/ui-runtime$": path.join(runtime_root, "src/index.js"), "@drumee/ui-runtime/browser$": path.join(runtime_root, "src/browser.js"), "@drumee/window-manager/browser$": path.join(window_root, "lib/browser.js"), "@phase48/finder$": path.join(finder_root, "lib/browser.js"), "@phase48/finder/window$": path.join(finder_root, "lib/window.js") };
  await compile(config);
  const metadata = JSON.parse(fs.readFileSync(path.join(output, "index.json"), "utf8"));
  fs.writeFileSync(path.join(output, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%}#plain-host{position:absolute;left:10px;top:380px;width:900px;height:330px;border:1px solid #777}#workspace{position:absolute;left:0;top:0;width:940px;height:370px;background:#eef2f7}</style></head><body><main id="workspace"></main><section id="plain-host"></section><script>window.onerror=(m,s,l,c,e)=>document.body.dataset.error=String(e||m)</script><script src="${metadata.entry}"></script></body></html>`);
  const port = 29680 + Math.floor(Math.random() * 100);
  const process = child_process.spawn(chrome(), ["--headless=new", "--no-sandbox", "--disable-gpu", "--window-size=1100,800", `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, "about:blank"], { stdio: "ignore" });
  let protocol;
  try {
    const page = await endpoint(port); protocol = await devtools(page.webSocketDebuggerUrl); await protocol.send("Page.enable"); await protocol.send("Runtime.enable"); await protocol.send("Page.navigate", { url: `file://${path.join(output, "index.html")}` });
    for (let attempt = 0; attempt < 120; attempt++) { const state = await evaluate(protocol, "({ready:document.body.dataset.ready,error:document.body.dataset.error})"); if (state.error) throw new Error(state.error); if (state.ready === "true") break; await new Promise((resolve) => setTimeout(resolve, 50)); }
    const structure = await evaluate(protocol, "({runtime:document.body.dataset.runtimeReady,plainWindow:Boolean(document.querySelector('#plain-host .drumee-window')),plainKind:document.querySelector('#plain-host .drumee-finder').dataset.kind,windows:phase48.manager.windows().length,tiles:document.querySelectorAll('#plain-host .drumee-finder__tile').length,widgetChildren:phase48.plain.children.length,progressViews:document.querySelectorAll('#plain-host [data-kind=finder_transfer_progress]').length,layout:getComputedStyle(document.querySelector('#plain-host .drumee-finder__items')).display})");
    assert.deepEqual(structure, { runtime: "true", plainWindow: false, plainKind: "finder", windows: 2, tiles: 100, widgetChildren: 5, progressViews: 2, layout: "grid" });
    await new Promise((resolve) => setTimeout(resolve, 80));
    const previews = await evaluate(protocol, "({requests:phase48.telemetry.media.length,services:[...new Set(phase48.telemetry.media.map(value=>value.service))],physical:phase48.telemetry.media.some(value=>value.input.db_name||value.input.storage_ref)})");
    assert.ok(previews.requests > 0, JSON.stringify(previews));
    assert.equal(previews.physical, false);
    assert.ok(previews.services.every((service) => ["media.thumb", "media.document", "media.preview", "media.video"].includes(service)), JSON.stringify(previews));
    const navigation = await evaluate(protocol, `(async()=>{const folder=phase48.a.finder.item_list.values().find(item=>item.filetype==='folder');await phase48.a.finder.open(folder);const opened={...phase48.a.finder.location};const title=phase48.a.window.getPart('window-title').getText();await phase48.a.finder.back();const backed={...phase48.a.finder.location};await phase48.a.finder.forward();const forwarded={...phase48.a.finder.location};await phase48.a.finder.up();return{opened,backed,forwarded,up:{...phase48.a.finder.location},title}})()`);
    assert.equal(navigation.opened.nid, "1000000000000002");
    assert.equal(navigation.backed.nid, "1000000000000001");
    assert.equal(navigation.forwarded.nid, "1000000000000002");
    assert.equal(navigation.up.nid, "1000000000000001");
    assert.match(navigation.title, /Documents/);
    await evaluate(protocol, "phase48.a.finder.open(phase48.a.finder.item_list.values().find(item=>item.filetype==='folder'))");
    await evaluate(protocol, "document.querySelector('[data-finder-id=finder-a] .drumee-finder__breadcrumb').click();new Promise(resolve=>setTimeout(resolve,30))");
    assert.equal(await evaluate(protocol, "phase48.a.finder.location.nid"), "1000000000000001");
    await evaluate(protocol, "phase48.plain.loadMore().then(()=>phase48.plain.loadMore())");
    assert.equal(await evaluate(protocol, "document.querySelectorAll('#plain-host .drumee-finder__tile').length"), 250);

    const marquee = await evaluate(protocol, `(()=>{const finder=phase48.plain;const widget=finder.selection_marquee;const list=finder.item_list.el;list.setPointerCapture=()=>{};const lr=list.getBoundingClientRect();const tr=list.querySelectorAll('[data-item-id]')[2].getBoundingClientRect();const down=(x,y,id)=>widget.onPointerDown({button:0,target:list,pointerId:id,clientX:x,clientY:y});const move=(x,y,id)=>widget.onPointerMove({pointerId:id,clientX:x,clientY:y});const up=id=>widget.onPointerUp({pointerId:id});finder.selection.clear();down(lr.left+2,lr.top+2,51);move(lr.left+5,lr.top+5,51);up(51);const threshold=finder.selection.getItems().length;down(lr.left+2,lr.top+2,52);move(tr.right-2,tr.bottom-2,52);up(52);const forward=finder.selection.getItems().length;return{threshold,forward}})()`);
    assert.equal(marquee.threshold, 0);
    assert.ok(marquee.forward >= 3, JSON.stringify(marquee));

    const marquee_drag_source = await point(protocol, "#plain-host .drumee-finder__tile");
    const marquee_drag_target = await point(protocol, "[data-finder-id=finder-b] .drumee-finder__items");
    await drag(protocol, marquee_drag_source, marquee_drag_target, 10);
    const marquee_transfer = await evaluate(protocol, "({source:phase48.plain.items.size,target:phase48.b.finder.items.size,marqueeActive:phase48.plain.selection_marquee.active,itemDragging:phase48.plain.el.dataset.itemDragging||null})");
    assert.deepEqual(marquee_transfer, { source: 250, target: 1 + marquee.forward, marqueeActive: false, itemDragging: null });

    const reverse = await evaluate(protocol, `(()=>{const finder=phase48.plain;const widget=finder.selection_marquee;const list=finder.item_list.el;const lr=list.getBoundingClientRect();const tr=list.querySelectorAll('[data-item-id]')[2].getBoundingClientRect();finder.selection.clear();widget.onPointerDown({button:0,target:list,pointerId:53,clientX:lr.right-2,clientY:lr.top+2});widget.onPointerMove({pointerId:53,clientX:tr.left+2,clientY:tr.bottom-2});widget.onPointerUp({pointerId:53});const count=finder.selection.getItems().length;finder.selection.clear();return count})()`);
    assert.ok(reverse >= 1, String(reverse));

    const selected_after_checkbox = await evaluate(protocol, `(()=>{document.querySelector('#plain-host .drumee-finder__tile').click();document.querySelectorAll('#plain-host .drumee-finder__check')[2].click();return phase48.plain.selection.getItems().map(item=>item.nid)})()`);
    assert.equal(selected_after_checkbox.length, 2, JSON.stringify(selected_after_checkbox));
    await evaluate(protocol, "document.querySelector('#plain-host .drumee-finder__check').click()");
    assert.equal(await evaluate(protocol, "phase48.plain.selection.getItems().length"), 1);

    await evaluate(protocol, `(()=>{const tiles=document.querySelectorAll('[data-finder-id=finder-a] .drumee-finder__tile');tiles[0].click();tiles[1].querySelector('[data-service=tick]').click()})()`);
    assert.equal(await evaluate(protocol, "phase48.a.finder.selection.getItems().length"), 2);
    const before_checkbox_drag_target = await evaluate(protocol, "phase48.b.finder.items.size");
    const source = await point(protocol, "[data-finder-id=finder-a] .drumee-finder__tile");
    const target = await point(protocol, "[data-finder-id=finder-b] .drumee-finder__items");
    await drag(protocol, source, target, 10);
    const transfer = await evaluate(protocol, "({source:phase48.a.finder.items.size,target:phase48.b.finder.items.size,aSelection:phase48.a.finder.selection.getItems().length,bSelection:phase48.b.finder.selection.getItems().length,marqueeActive:phase48.a.finder.selection_marquee.active})");
    assert.equal(transfer.source, 2);
    assert.equal(transfer.target, before_checkbox_drag_target + 2);
    assert.equal(transfer.aSelection, 2);
    assert.equal(transfer.bSelection, 0);
    assert.equal(transfer.marqueeActive, false);

    await evaluate(protocol, "(()=>{document.querySelectorAll('[data-finder-id=finder-a] .drumee-finder__tile')[1].click();return phase48.a.finder.transferTo(phase48.plain)})()");
    const moved = await evaluate(protocol, "({source:phase48.a.finder.items.size,destination:phase48.plain.items.size})");
    assert.deepEqual(moved, { source: 1, destination: 251 });

    const before = await evaluate(protocol, "phase48.a.finder.selection.getItems().length");
    const header = await point(protocol, "[data-window_id=finder-window-a] .drumee-window__header");
    await drag(protocol, header, { x: header.x + 40, y: header.y + 20 });
    assert.equal(await evaluate(protocol, "phase48.a.finder.selection.getItems().length"), before);

    const before_resize = await evaluate(protocol, "({selection:phase48.b.finder.selection.getItems().length,geometry:phase48.b.window.geometry()})");
    const resize_handle = await evaluate(protocol, "(()=>{const r=document.querySelector('[data-window_id=finder-window-b]').getBoundingClientRect();return{x:r.right-3,y:r.bottom-3}})()");
    await drag(protocol, resize_handle, { x: resize_handle.x + 45, y: resize_handle.y + 30 });
    const after_resize = await evaluate(protocol, "({selection:phase48.b.finder.selection.getItems().length,geometry:phase48.b.window.geometry(),marqueeActive:phase48.b.finder.selection_marquee.active})");
    assert.equal(after_resize.selection, before_resize.selection);
    assert.equal(after_resize.marqueeActive, false);
    assert.ok(after_resize.geometry.width > before_resize.geometry.width && after_resize.geometry.height > before_resize.geometry.height, JSON.stringify({ before_resize, after_resize }));

    const remote_changes = await evaluate(protocol, `(()=>{const finder=phase48.b.finder;const file=finder.item_list.values().find(item=>item.filetype==='file');finder.selection.set([file]);phase48.emit({type:'node.renamed',operation_id:'remote-rename-item',node:{hub_id:file.hub_id,nid:file.nid},result:{...file,filename:'remote-name.txt'}});const renamed=finder.selection.getItems()[0].filename;phase48.emit({type:'node.removed',operation_id:'remote-remove-item',node:{hub_id:file.hub_id,nid:file.nid},source_parent:{...finder.location},result:{nodes:[file]}});return{renamed,selected:finder.selection.getItems().length,present:finder.hasItem(file)}})()`);
    assert.deepEqual(remote_changes, { renamed: "remote-name.txt", selected: 0, present: false });

    const before_folder_drop = await evaluate(protocol, "phase48.b.finder.items.size");
    const folder_drop_points = await evaluate(protocol, `(()=>{const root=document.querySelector('[data-finder-id=finder-b]');const source=root.querySelector('[data-filetype=file]');const target=root.querySelector('[data-filetype=folder]');const a=source.getBoundingClientRect();const b=target.getBoundingClientRect();return{from:{x:a.left+a.width/2,y:a.top+a.height/2},to:{x:b.left+b.width/2,y:b.top+b.height/2}}})()`);
    await drag(protocol, folder_drop_points.from, folder_drop_points.to, 10);
    assert.equal(await evaluate(protocol, "phase48.b.finder.items.size"), before_folder_drop - 1);

    const transfers = await evaluate(protocol, `(async()=>{const file=new Blob(['abcdefghij'],{type:'text/plain'});Object.defineProperty(file,'name',{value:'upload.txt'});await phase48.plain.uploadFiles([file]);const item=phase48.plain.item_list.values()[0];const download=await phase48.plain.download_controller.download([item],{document:null,URL:null});return{binary:phase48.telemetry.binary,transfer:phase48.telemetry.transfer,url:download.url,activeUploads:phase48.plain.upload_controller.active.size,activeDownloads:phase48.plain.download_controller.active.size}})()`);
    assert.ok(transfers.binary.length >= 3, JSON.stringify(transfers));
    assert.ok(transfers.binary.every((entry) => entry.is_blob && entry.size <= 4), JSON.stringify(transfers.binary));
    assert.match(transfers.url, /download_retrieve/);
    assert.equal(transfers.activeUploads, 0);
    assert.equal(transfers.activeDownloads, 0);

    const reconnect = await evaluate(protocol, `(async()=>{const before=phase48.telemetry.list_calls;const key='a000000000000001:1000000000000002';phase48.state.by_parent.get(key).unshift({hub_id:'a000000000000001',nid:'9900000000000001',parent_id:'1000000000000002',filename:'offline.txt',filetype:'file',mimetype:'text/plain'});phase48.runtime.Websocket.emit('connected',{});await new Promise(resolve=>setTimeout(resolve,80));return{before,after:phase48.telemetry.list_calls,found:phase48.plain.hasItem({hub_id:'a000000000000001',nid:'9900000000000001'})}})()`);
    assert.ok(reconnect.after >= reconnect.before + 3, JSON.stringify(reconnect));
    assert.equal(reconnect.found, true);

    const lifecycle = await evaluate(protocol, `(async()=>{const host=document.createElement('section');document.body.append(host);const finder=phase48.runtime.mount({kind:'finder',finder_id:'lifecycle-finder',location:{hub_id:'a000000000000001',nid:'1000000000000002'},...phase48.common},host);await finder.refresh();phase48.emit({type:'node.renamed',operation_id:'rename-current',node:{hub_id:'a000000000000001',nid:'1000000000000002'},result:{hub_id:'a000000000000001',nid:'1000000000000002',filename:'Renamed Documents',filetype:'folder'}});const renamed=finder.current_title;phase48.emit({type:'node.removed',operation_id:'remove-current',node:{hub_id:'a000000000000001',nid:'1000000000000002'},result:{nodes:[]}});const invalid=finder.last_error&&finder.last_error.code;finder.destroy();finder.destroy();host.remove();const baseline=phase48.sync.finders.size;for(let index=0;index<5;index++){const mount=document.createElement('section');document.body.append(mount);const value=phase48.runtime.mount({kind:'finder',finder_id:'cycle-'+index,location:{hub_id:'b000000000000002',nid:'2000000000000001'},...phase48.common},mount);await value.refresh();value.destroy();value.destroy();mount.remove();}let externalDestroyed=false;const external={on(){},off(){},destroy(){externalDestroyed=true},uploadForest(){}};const externalHost=document.createElement('section');document.body.append(externalHost);const externalFinder=phase48.runtime.mount({kind:'finder',finder_id:'external-transfer',location:{hub_id:'b000000000000002',nid:'2000000000000001'},mfs_client:phase48.common.mfs_client,mfs_sync:phase48.common.mfs_sync,upload_controller:external},externalHost);await externalFinder.refresh();externalFinder.destroy();externalHost.remove();return{renamed,invalid,items:finder.items.size,registered:phase48.sync.finders.size,baseline,externalDestroyed}})()`);
    assert.deepEqual(lifecycle, { renamed: "Renamed Documents", invalid: "MFS_LOCATION_UNAVAILABLE", items: 0, registered: lifecycle.baseline, baseline: 3, externalDestroyed: false });

    await evaluate(protocol, "phase48.a.destroy();phase48.a.destroy();phase48.plain.destroy();phase48.plain.destroy()");
    const cleanup = await evaluate(protocol, "({registered:phase48.sync.finders.size,windows:phase48.manager.windows().length,plainConnected:document.querySelector('#plain-host .drumee-finder')!==null})");
    assert.deepEqual(cleanup, { registered: 1, windows: 1, plainConnected: false });
  } finally {
    if (protocol) protocol.close(); process.kill("SIGTERM"); await Promise.race([events.once(process, "exit"), new Promise((resolve) => setTimeout(resolve, 1500))]); await removeDirectory(output); await removeDirectory(profile);
  }
});
