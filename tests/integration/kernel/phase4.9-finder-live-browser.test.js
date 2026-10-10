"use strict";

const assert = require("node:assert/strict");
const child_process = require("node:child_process");
const events = require("node:events");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");

const enabled = process.env.KERNEL_PHASE49_LIVE_BROWSER === "1";
const root = path.resolve(__dirname, "../../..");
const finder_root = process.env.KERNEL_FINDER_ROOT || path.resolve(root, "../finder");
const system_mfs_root = process.env.KERNEL_SYSTEM_MFS_ROOT || path.resolve(root, "../system-mfs");
const ui_runtime_root = path.resolve(root, "../ui-runtime");
const window_manager_root = path.resolve(root, "../window-manager");
const lifecycle_root = path.join(root, "target/control-plane/hub-lifecycle");
const runtime = require(path.join(root, "target/foundation/server-runtime/lib"));
const { HubLifecycle, ModuleRegistry, SqlHubStore, createAclContract } = require(path.join(lifecycle_root, "lib"));
const { readModuleManifest } = require(path.join(lifecycle_root, "lib/manifest"));
const { HostFilesystem } = require(path.join(root, "target/modules/host-filesystem/lib"));
const { MfsEventAclAuthorizer, MfsEventPublisher, MfsPermissionBackend, MfsService } = require(path.join(root, "target/modules/mfs-service/lib"));
const { MfsTransferService, TransferStaging } = require(path.join(root, "target/modules/mfs-transfer/lib"));
const Constants = require(path.join(root, "sources/server-essentials/lib/lex/constants"));
const { permissionValue } = require(path.join(root, "sources/server-essentials/lib/lex/permission"));
const system_mfs = require(path.join(system_mfs_root, "lib"));

const db_container = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase48b-db";
const db_password = process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root";
const db_name = process.env.KERNEL_DB_NAME || "yp";
const login_password = process.env.KERNEL_PHASE4_TEST_PASSWORD || "phase4-disposable-user";
const owner_uid = "a000000000000091";
const reader_uid = "b000000000000092";

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  const encoded = typeof value === "object" ? JSON.stringify(value) : String(value);
  return `'${encoded.replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}
function bind(sql, parameters) { let index = 0; const output = sql.replace(/\?/g, () => literal(parameters[index++])); if (index !== parameters.length) throw new Error("SQL parameter count mismatch"); return output; }
function parse(output) {
  const lines = output.trim().split("\n").filter(Boolean); if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).filter((line) => line.split("\t").length === headers.length && line !== headers.join("\t")).map((line) => Object.fromEntries(line.split("\t").map((value, index) => [headers[index], value === "NULL" ? null : value])));
}
function mariadb(database_name, sql, input) {
  const args = ["exec", ...(input === undefined ? [] : ["-i"]), "-e", `MYSQL_PWD=${db_password}`, db_container, "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "--batch", "--raw", database_name];
  if (input === undefined) args.push("--execute", sql);
  const result = child_process.spawnSync("docker", args, { encoding: "utf8", input });
  if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  return parse(result.stdout);
}
const database = {
  runtime_user: process.env.KERNEL_DB_USER || "kernel_phase4",
  query(sql, ...parameters) { return mariadb(db_name, bind(sql, parameters)); },
  await_query(sql, ...parameters) { return this.query(sql, ...parameters); },
  await_proc(name, ...parameters) { return this.query(`CALL ${name}(${parameters.map(() => "?").join(",")})`, ...parameters); },
  async await_func(name, ...parameters) { return (await this.query(`SELECT ${name}(${parameters.map(() => "?").join(",")}) AS value`, ...parameters))[0]; },
  executeScript(script, { database: selected = db_name } = {}) { mariadb(selected, "", script); },
  queryIn(selected, sql, ...parameters) { return mariadb(selected, bind(sql, parameters)); }
};

function dependencyRoot() { return path.join(root, "target/tooling/ui-build/node_modules"); }
function chrome() { return [process.env.CHROME_BIN, "/usr/bin/google-chrome", "/usr/bin/chromium"].filter(Boolean).find(fs.existsSync); }
function compile(config) { const webpack = require(path.join(dependencyRoot(), "webpack")); return new Promise((resolve, reject) => webpack(config, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(new Error(stats.toString({ all: false, errors: true }))) : resolve())); }
async function chromePage(port) { for (let attempt = 0; attempt < 100; attempt++) { try { const response = await fetch(`http://127.0.0.1:${port}/json/list`); if (response.ok) return (await response.json()).find((entry) => entry.type === "page"); } catch (_) {} await new Promise((resolve) => setTimeout(resolve, 50)); } throw new Error("Chrome endpoint unavailable"); }
function devtools(url) { return new Promise((resolve, reject) => { const socket = new WebSocket(url); const pending = new Map(); let serial = 0; socket.addEventListener("open", () => resolve({ close: () => socket.close(), send(method, params = {}) { const id = ++serial; socket.send(JSON.stringify({ id, method, params })); return new Promise((yes, no) => pending.set(id, { yes, no })); } })); socket.addEventListener("error", reject); socket.addEventListener("message", (event) => { const message = JSON.parse(event.data); const call = pending.get(message.id); if (!call) return; pending.delete(message.id); message.error ? call.no(new Error(message.error.message)) : call.yes(message.result); }); }); }
async function evaluate(protocol, expression) { const response = await protocol.send("Runtime.evaluate", { expression, returnByValue: true, awaitPromise: true }); if (response.exceptionDetails) throw new Error(response.exceptionDetails.exception && response.exceptionDetails.exception.description || response.exceptionDetails.text); return response.result.value; }
function listen(server) { return new Promise((resolve, reject) => server.listen(0, "127.0.0.1", (error) => error ? reject(error) : resolve(server.address().port))); }
function close(server) { return new Promise((resolve) => server.close(() => resolve())); }
async function removeDirectory(directory) { for (let attempt = 0; attempt < 8; attempt++) { try { fs.rmSync(directory, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); return; } catch (error) { if (attempt === 7) throw error; await new Promise((resolve) => setTimeout(resolve, 200)); } } }

class MemoryRedis {
  async init() {}
  static getLiveUpdateChannel() { return "phase49-live"; }
  static async getSubscribe() { return { async subscribe(_channel, callback) { MemoryRedis.callback = callback; }, async unsubscribe() {}, async quit() {} }; }
  static async sendData(payload, dest) { if (MemoryRedis.callback) await MemoryRedis.callback(JSON.stringify({ payload, dest })); }
}

test("Chromium uses Finder over authenticated HTTP, real Hub shards and runtime WebSocket", { skip: !enabled, timeout: 300000 }, async () => {
  const temporary = fs.mkdtempSync(path.join(os.tmpdir(), "drumee-phase49-live-"));
  const output = path.join(temporary, "ui"); fs.mkdirSync(output);
  const profile = path.join(temporary, "profile"); fs.mkdirSync(profile);
  const content_root = path.join(temporary, "content");
  const staging = new TransferStaging({ root: path.join(content_root, "transfers") });
  const host_filesystem = new HostFilesystem({ root: content_root });
  const content_store = new system_mfs.LocalContentStore({ root: content_root, staging });
  const acl = createAclContract(Constants);
  await database.executeScript(`
    INSERT INTO entity (id,ident,db_name,home_dir,type,area,dom_id,status,ctime,mtime,settings) VALUES
      ('${owner_uid}','phase49-owner','phase49_owner_identity','/phase49/owner','drumate','personal',41,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}'),
      ('${reader_uid}','phase49-reader','phase49_reader_identity','/phase49/reader','drumate','personal',41,'active',UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),'{}')
      ON DUPLICATE KEY UPDATE status='active',mtime=UNIX_TIMESTAMP();
    INSERT INTO drumate (id,username,domain_id,fingerprint,profile)
      SELECT '${owner_uid}','phase49-owner',41,fingerprint,'{"email":"phase49-owner@kernel.test"}' FROM drumate WHERE id='phase4authuser01'
      ON DUPLICATE KEY UPDATE fingerprint=VALUES(fingerprint),profile=VALUES(profile);
    INSERT INTO drumate (id,username,domain_id,fingerprint,profile)
      SELECT '${reader_uid}','phase49-reader',41,fingerprint,'{"email":"phase49-reader@kernel.test"}' FROM drumate WHERE id='phase4authuser01'
      ON DUPLICATE KEY UPDATE fingerprint=VALUES(fingerprint),profile=VALUES(profile);
    INSERT INTO privilege (uid,domain_id,privilege,is_authoritative) VALUES ('${owner_uid}',41,3,1)
      ON DUPLICATE KEY UPDATE privilege=VALUES(privilege),is_authoritative=VALUES(is_authoritative);
  `);
  await database.executeScript("CREATE TABLE IF NOT EXISTS hub_acl (hub_id varchar(16) NOT NULL, uid varchar(16) NOT NULL, permission tinyint(3) unsigned NOT NULL, granted_by varchar(16) NOT NULL, ctime int unsigned NOT NULL, mtime int unsigned NOT NULL, PRIMARY KEY (hub_id,uid)) ENGINE=InnoDB");
  const hub_store = new SqlHubStore({ database, acl }); await hub_store.install();
  const mfs_store = new system_mfs.SqlMfsStore({ database }); await system_mfs.install({ store: mfs_store });
  const modules = new ModuleRegistry();
  modules.register({ module_id: "system-mfs", module_root: system_mfs_root, manifest: readModuleManifest("system-mfs", system_mfs_root), handler: ({ hub }) => system_mfs.provision({ store: mfs_store, context: { hub_id: hub.hub_id } }), artifact_ref: "system-mfs:phase49-live" });
  const creator_root = path.join(root, "tests/fixtures/phase4.8b/own-module");
  modules.register({ module_id: "own-module", module_root: creator_root, manifest: readModuleManifest("own-module", creator_root), handler: async ({ hub }) => { const manifest = JSON.parse(fs.readFileSync(path.join(creator_root, "server/schemas/SCHEMA_MANIFEST.json"))); for (const entry of manifest.provision) await database.executeScript(fs.readFileSync(path.join(creator_root, entry.path), "utf8"), { database: hub.database_name }); }, artifact_ref: "phase49-live:creator" });
  const lifecycle = new HubLifecycle({ store: hub_store, registry: modules, can_create: async ({ organisation_id }) => organisation_id === 41 });
  const yellow_page_store = new runtime.YellowPageStore({ database });
  const session_manager = new runtime.SessionManager({ store: yellow_page_store });
  const hub_authorizer = new runtime.HubAuthorizer({ resolver: hub_store, permissionValue });
  const permission_backend = new MfsPermissionBackend({ permission_store: mfs_store });
  const push = new runtime.PushBus({ redisStore: MemoryRedis, socketStore: yellow_page_store, logger: null });
  const event_acl = new MfsEventAclAuthorizer({ session_resolver: (recipient) => session_manager.fromSessionId(recipient.session_id), hub_authorizer, permission_backend, permission_contract: Constants.permission, read_permission: permissionValue("read") });
  const publisher = new MfsEventPublisher({
    recipients: () => database.query("SELECT id AS socket_id,session_id,uid FROM socket"),
    authorize: (request) => event_acl.authorize(request),
    transport: { publishRecipient: ({ principal, service, payload }) => push.publish({ service, data: payload, dest: principal.socket_id }) }
  });
  const mfs_service = new MfsService({ filesystem_factory: (principal) => new system_mfs.MfsFilesystem({ store: mfs_store, principal: principal.uid, content_store }), events: publisher, permission_backend, permission_contract: Constants.permission });
  const mfs_transfer = new MfsTransferService({ mfs_service, staging, host_filesystem, upload_chunk_size: 4, max_upload_chunk_size: 1024, ttl_ms: 60000 });
  permission_backend.transfer_resource = (request) => request.service === "phase49.bytes" ? { src: [request.input.node] } : mfs_transfer.resourceFor(request);
  const descriptors = new runtime.DescriptorRegistry({ permissionValue });
  descriptors.registerDirectory(path.join(root, "target/foundation/server-runtime/acl"));
  descriptors.registerDirectory(path.join(root, "target/modules/mfs-service/server/acl"));
  descriptors.registerDirectory(path.join(root, "target/modules/mfs-transfer/server/acl"));
  descriptors.registerDescriptor("phase49", {
    modules: { private: "phase49-worker.js" },
    services: {
      create: { scope: "domain", permission: { src: "read" } },
      grant: { scope: "hub", requires: ["system-mfs"], permission: { src: "admin", selector: "hub_id" } },
      set_node_access: { scope: "hub", requires: ["system-mfs"], permission: { src: "admin", selector: "hub_id" } },
      revoke: { scope: "hub", requires: ["system-mfs"], permission: { src: "admin", selector: "hub_id" } },
      bytes: { scope: "mfs", permission: { src: "read" } }
    }
  }, { workdir: "/trusted" });
  let created;
  class Phase49Worker {
    constructor({ session, hub_context }) { this.session = session; this.hub_context = hub_context; }
    async create() {
      if (!created) {
        const a = await lifecycle.createPrivateHub({ session: this.session, creator_module: "own-module", specification: { idempotency_key: "phase49-live-a", name: "Phase 49 live A" } });
        const b = await lifecycle.createPrivateHub({ session: this.session, creator_module: "own-module", specification: { idempotency_key: "phase49-live-b", name: "Phase 49 live B" } });
        created = { a: { ...a, root: { hub_id: a.hub_id, nid: (await system_mfs.validateProvisioning({ store: mfs_store, context: { hub_id: a.hub_id } })).root_id } }, b: { ...b, root: { hub_id: b.hub_id, nid: (await system_mfs.validateProvisioning({ store: mfs_store, context: { hub_id: b.hub_id } })).root_id } }, reader_uid };
      }
      return created;
    }
    async grant(input) { await lifecycle.grant({ actor_context: this.hub_context, target_uid: input.target_uid, privilege: input.privilege || "read" }); const hub = await hub_store.getHub(input.hub_id); if (input.wildcard !== false) await database.queryIn(hub.database_name, "INSERT INTO permission (resource_id,entity_id,message,expiry_time,ctime,utime,permission,assign_via) VALUES ('*',?,'phase49 reader',0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),?,'root') ON DUPLICATE KEY UPDATE permission=VALUES(permission)", input.target_uid, Number(input.node_permission || 3)); return { granted: true }; }
    async set_node_access(input) { const hub = await hub_store.getHub(input.hub_id); await database.queryIn(hub.database_name, "DELETE FROM permission WHERE entity_id=?", input.target_uid); const entries = input.entries || [{ node: input.node, permission: input.permission }]; for (const entry of entries) await database.queryIn(hub.database_name, "INSERT INTO permission (resource_id,entity_id,message,expiry_time,ctime,utime,permission,assign_via) VALUES (?,?,'phase49 scoped reader',0,UNIX_TIMESTAMP(),UNIX_TIMESTAMP(),?,'share') ON DUPLICATE KEY UPDATE permission=VALUES(permission),assign_via=VALUES(assign_via)", entry.node.nid, input.target_uid, Number(entry.permission)); return { granted: true }; }
    async revoke(input) { await lifecycle.revoke({ actor_context: this.hub_context, target_uid: input.target_uid }); const hub = await hub_store.getHub(input.hub_id); await database.queryIn(hub.database_name, "DELETE FROM permission WHERE resource_id='*' AND entity_id=?", input.target_uid); return { revoked: true }; }
    async bytes(input) { const node = await mfs_store.getNode(null, input.node); const body = await content_store.read(node.storage_ref); this.session.output.write(body, "application/octet-stream"); return null; }
  }
  const authorize = runtime.createAuthorizer({ domainAuthorizer: new runtime.DomainAuthorizer({ store: yellow_page_store }), hubAuthorizer: hub_authorizer, mfsPermissionBackend: permission_backend });
  const dispatcher = new runtime.ServiceDispatcher({
    registry: descriptors,
    authorize,
    capability_resolver: new runtime.CapabilityResolver({ providers: { "system-mfs": async ({ hub_context, hub_contexts }) => ({ available: Boolean(hub_context || hub_contexts), status: "installed" }) } }),
    requireWorker: (filename) => filename === "/trusted/phase49-worker.js" ? Phase49Worker : require(filename),
    workerOptions: { mfs_service, mfs_transfer }
  });

  const static_server = http.createServer((request, response) => {
    const filename = request.url === "/bundle.js" ? path.join(output, "bundle.js") : path.join(output, "index.html");
    response.writeHead(200, { "content-type": request.url === "/bundle.js" ? "application/javascript" : "text/html" }); response.end(fs.readFileSync(filename));
  });
  const static_port = await listen(static_server);
  const origin = `http://127.0.0.1:${static_port}`;
  const api_server = runtime.createServiceServer({
    dispatcher,
    sessionFactory: (request) => session_manager.fromRequest(request),
    allowedOrigins: [origin],
    binary_uploads: { "mfs-transfer.upload_chunk": { directory: path.join(temporary, "incoming"), max_bytes: 1024, before_receive: ({ input, session }) => mfs_transfer.uploadPreflight(input, { uid: session.uid() }) } }
  });
  const websocket_package = require(require.resolve("websocket", { paths: [path.resolve(root, "../server-runtime")] }));
  const websocket = new runtime.WebSocketPushRouter({ httpServer: api_server, sessionManager: session_manager, socketStore: yellow_page_store, redisStore: MemoryRedis, WebSocketServer: websocket_package.server, allowedOrigins: [origin], logger: null });
  await websocket.start();
  const api_port = await listen(api_server);
  const api_url = `http://127.0.0.1:${api_port}`;

  const { createConfig } = require(path.join(root, "target/tooling/ui-build/lib"));
  const config = createConfig({ root, name: "phase49-live", type: "test-fixture", entry: "./tests/integration/kernel/fixtures/finder/live-browser-entry.js", outputPath: output, publicPath: "./", version: "0.0.0-phase4.9", rev: "phase4.9-live", loaderRoots: [dependencyRoot(), path.join(window_manager_root, "node_modules")], moduleRoots: [path.join(window_manager_root, "node_modules"), path.join(ui_runtime_root, "node_modules"), dependencyRoot()] });
  config.output.filename = "bundle.js";
  config.resolve = config.resolve || {}; config.resolve.alias = { ...(config.resolve.alias || {}), jquery: path.join(ui_runtime_root, "node_modules/jquery"), "@drumee/ui-runtime/browser$": path.join(ui_runtime_root, "src/browser.js"), "@drumee/window-manager/browser$": path.join(window_manager_root, "lib/browser.js"), "@drumee/finder$": path.join(finder_root, "lib/browser.js"), "@drumee/finder/window$": path.join(finder_root, "lib/window.js") };
  await compile(config);
  fs.writeFileSync(path.join(output, "index.html"), `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;width:100%;height:100%}#workspace{width:920px;height:370px}#reader-host{width:420px;height:260px}</style></head><body><main id="workspace"></main><section id="reader-host"></section><script>window.PHASE49_CONFIG=${JSON.stringify({ service_url: api_url, websocket_url: `ws://127.0.0.1:${api_port}/-/websocket/`, password: login_password })};window.onerror=(m,s,l,c,e)=>document.body.dataset.error=String(e||m)</script><script src="/bundle.js"></script></body></html>`);

  const browser = chrome(); assert.ok(browser, "Chromium is required");
  const debug_port = 29800 + Math.floor(Math.random() * 100);
  const chrome_process = child_process.spawn(browser, ["--headless=new", "--no-sandbox", "--disable-gpu", "--window-size=1100,800", `--remote-debugging-port=${debug_port}`, `--user-data-dir=${profile}`, `${origin}/`], { stdio: "ignore" });
  let protocol;
  try {
    const page = await chromePage(debug_port); protocol = await devtools(page.webSocketDebuggerUrl); await protocol.send("Runtime.enable");
    for (let attempt = 0; attempt < 240; attempt++) { const state = await evaluate(protocol, "({ready:document.body.dataset.ready,error:document.body.dataset.error})"); if (state.error) throw new Error(state.error); if (state.ready === "true") break; await new Promise((resolve) => setTimeout(resolve, 100)); }
    assert.deepEqual(await evaluate(protocol, "({windows:phase49.manager.windows().length,a:phase49.a.finder.location.hub_id,b:phase49.b.finder.location.hub_id,distinct:phase49.a.finder.location.hub_id!==phase49.b.finder.location.hub_id,sockets:[phase49.owner_socket.state,phase49.reader_socket.state]})"), { windows: 2, a: created.a.hub_id, b: created.b.hub_id, distinct: true, sockets: ["connected", "connected"] });
    const operations = await evaluate(protocol, `(async()=>{const a=phase49.a.finder;const b=phase49.b.finder;const source=(await phase49.owner_client.mkdir(a.location,'Source')).result;const destination=(await phase49.owner_client.mkdir(a.location,'Destination')).result;await a.refresh();a.selection.set([source]);await a.transferTo({finder:a,location:{hub_id:a.location.hub_id,nid:destination.nid}});await a.open(destination);const inside=a.item_list.values().some(item=>item.nid===source.nid);await a.up();a.selection.set([destination]);await a.transferTo({finder:b,location:{...b.location}});await b.refresh();return{inside,copied:b.item_list.values().some(item=>item.filename==='Destination'),a:{...a.location},b:{...b.location}}})()`);
    assert.equal(operations.inside, true, JSON.stringify(operations)); assert.equal(operations.copied, true, JSON.stringify(operations));
    const denied = await evaluate(protocol, `(async()=>{try{await phase49.reader_client.mkdir(phase49.created.a.root,'Denied');return null}catch(error){return error.code}})()`);
    assert.equal(denied, "PERMISSION_DENIED");
    const upload = await evaluate(protocol, `(async()=>{const bytes=new TextEncoder().encode('phase49-real-bytes');const start=await phase49.transfer_client.uploadStart({destination:phase49.created.a.root,size:bytes.length,metadata:{filename:'live.txt',size:bytes.length,mimetype:'text/plain'}});for(let index=0;index<Math.ceil(bytes.length/start.chunk_size);index++){const part=bytes.slice(index*start.chunk_size,Math.min(bytes.length,(index+1)*start.chunk_size));await phase49.transfer_client.uploadChunk({transfer_id:start.transfer_id,index},new Blob([part]))}const done=await phase49.transfer_client.uploadComplete({transfer_id:start.transfer_id});const fetched=await phase49.owner_transport.bytes({hub_id:done.result.hub_id,nid:done.result.nid});return{nid:done.result.nid,text:new TextDecoder().decode(fetched)}})()`);
    assert.equal(upload.text, "phase49-real-bytes");
    const revoked_after_approval = await evaluate(protocol, `(async()=>{const root=phase49.created.a.root;const source=(await phase49.owner_client.mkdir(root,'Revocation source')).result;const destination=(await phase49.owner_client.mkdir(root,'Revocation destination')).result;const item=(await phase49.owner_client.mkdir(source,'Revocation item')).result;await phase49.owner_transport.postService('phase49.grant',{hub_id:root.hub_id,target_uid:phase49.created.reader_uid,privilege:'delete',wildcard:false});await phase49.owner_transport.postService('phase49.set_node_access',{hub_id:root.hub_id,target_uid:phase49.created.reader_uid,entries:[{node:source,permission:15},{node:destination,permission:7}]});await phase49.reader.navigate(source);const listed=phase49.reader.item_list.values().find(value=>value.nid===item.nid);const target=await phase49.reader_client.get(destination);phase49.reader.selection.set([listed]);const approved=phase49.reader.access_policy.transfer({items:[listed],destination:target});await phase49.owner_transport.postService('phase49.set_node_access',{hub_id:root.hub_id,target_uid:phase49.created.reader_uid,entries:[{node:source,permission:3},{node:destination,permission:7}]});let denial=null;try{await phase49.reader.transferTo({finder:phase49.reader,location:{hub_id:destination.hub_id,nid:destination.nid},resource:target})}catch(error){denial=error.code}return{approved:approved.allowed,denial,restored:phase49.reader.item_list.values().some(value=>value.nid===item.nid),pending:phase49.reader.pending_operations.size,undo:phase49.reader.undo_stack.length}})()`);
    assert.deepEqual(revoked_after_approval, { approved: true, denial: "PERMISSION_DENIED", restored: true, pending: 0, undo: 0 });
    const partial = await evaluate(protocol, `(async()=>{const root=phase49.created.a.root;const source=(await phase49.owner_client.mkdir(root,'Scoped source')).result;const destination=(await phase49.owner_client.mkdir(root,'Private destination')).result;const item=(await phase49.owner_client.mkdir(source,'Reader-visible item')).result;await phase49.owner_transport.postService('phase49.grant',{hub_id:root.hub_id,target_uid:phase49.created.reader_uid,privilege:'read',wildcard:false});await phase49.owner_transport.postService('phase49.set_node_access',{hub_id:root.hub_id,target_uid:phase49.created.reader_uid,node:source,permission:3});await phase49.reader.navigate(source);const listed=phase49.reader.item_list.values().find(value=>value.nid===item.nid);phase49.reader.selection.set([listed]);const reader_access={hub:listed.access.hub_privilege,node:listed.access.node_privilege};const owner_access=(await phase49.owner_client.get(item)).access;await phase49.owner_client.move([item],destination,'partial-visible-live');for(let attempt=0;attempt<100&&phase49.reader.item_list.values().some(value=>value.nid===item.nid);attempt++)await new Promise(resolve=>setTimeout(resolve,20));let destination_denial=null;try{await phase49.reader_client.get(destination)}catch(error){destination_denial=error.code}const payloads=phase49.socket_events.reader.filter(value=>value.service==='mfs.event'&&value.data&&value.data.operation_id==='partial-visible-live');return{source,destination,item,reader_access,owner_access,stale:phase49.reader.item_list.values().some(value=>value.nid===item.nid),selected:phase49.reader.selection.getItems().some(value=>value.nid===item.nid),destination_denial,payloads}})()`);
    assert.deepEqual(partial.reader_access, { hub: 3, node: 3 });
    assert.equal(partial.owner_access.hub_privilege, 63);
    assert.equal(partial.owner_access.node_privilege, 63);
    assert.equal(partial.stale, false);
    assert.equal(partial.selected, false);
    assert.equal(partial.destination_denial, "PERMISSION_DENIED");
    assert.equal(partial.payloads.length > 0, true);
    const partial_payload = JSON.stringify(partial.payloads);
    assert.match(partial_payload, /reconcile/);
    for (const hidden of [partial.destination.nid, partial.destination.filename, partial.item.nid, partial.item.filename]) assert.equal(partial_payload.includes(hidden), false, hidden);
    await evaluate(protocol, "phase49.owner_transport.postService('phase49.grant',{hub_id:phase49.created.a.hub_id,target_uid:phase49.created.reader_uid})");
    const before = await evaluate(protocol, "phase49.socket_events.reader.filter(value=>value.service==='mfs.event').length");
    await evaluate(protocol, "phase49.owner_client.mkdir(phase49.created.a.root,'Before revoke')");
    for (let attempt = 0; attempt < 50 && await evaluate(protocol, "phase49.socket_events.reader.filter(value=>value.service==='mfs.event').length") === before; attempt++) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(await evaluate(protocol, "phase49.socket_events.reader.filter(value=>value.service==='mfs.event').length") > before);
    await evaluate(protocol, "phase49.owner_transport.postService('phase49.revoke',{hub_id:phase49.created.a.hub_id,target_uid:phase49.created.reader_uid})");
    const revoked_count = await evaluate(protocol, "phase49.socket_events.reader.filter(value=>value.service==='mfs.event').length");
    await evaluate(protocol, "phase49.owner_client.mkdir(phase49.created.a.root,'After revoke')");
    await new Promise((resolve) => setTimeout(resolve, 300));
    assert.equal(await evaluate(protocol, "phase49.socket_events.reader.filter(value=>value.service==='mfs.event').length"), revoked_count);
    const exposed = await evaluate(protocol, "[...phase49.owner_transport.exchanges,...phase49.reader_transport.exchanges,...phase49.socket_events.owner.map(JSON.stringify),...phase49.socket_events.reader.map(JSON.stringify)].join('\\n')");
    assert.doesNotMatch(exposed, /hub_[a-f0-9]{16}|database_name|db_host|home_dir|storage_ref/i);
  } finally {
    if (protocol) protocol.close();
    chrome_process.kill("SIGTERM"); await Promise.race([events.once(chrome_process, "exit"), new Promise((resolve) => setTimeout(resolve, 1500))]);
    await websocket.stop(); mfs_transfer.destroy(); await close(api_server); await close(static_server); await removeDirectory(temporary);
  }
});
