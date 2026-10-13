"use strict";

// Composition fixture, never a deployable application. Stores are in memory;
// authorization, Session, dispatch, FileIo, media and transfer implementations are real.
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const runtime = require("../../../../foundation/server-runtime/lib");
const { permissionValue } = require("../../../../../sources/server-essentials/lib/lex/permission");
const { HostFilesystem, FileIo } = require("../../../host-filesystem/lib");
const { MfsTransferService, TransferStaging } = require("../../../mfs-transfer/lib");
const { MfsService, MfsPermissionBackend } = require("../../../mfs-service/lib");
const { MediaService, RepresentationManager } = require("../../../media-service/lib");

const hub_a = "b000000000000002", hub_b = "c000000000000003";
const original_id = "d000000000000004", folder_id = "e000000000000005";
const owner = "a000000000000001", reader = "a000000000000002", intruder = "a000000000000003";
const artifact_root = "/fixture/artifacts";
const incoming = "/fixture/incoming";
const users = new Map([["owner", owner], ["reader", reader], ["intruder", intruder]]);
const sessions = new Map(), tokens = new Map(), sockets = new Map();
let session_serial = 0, node_serial = 16, delegation_count = 0, dispatched = 0;
const nodes = new Map();
const key = (node) => `${node.hub_id}:${node.nid}`;

function context(sid, uid = runtime.NOBODY_UID, username = "nobody") {
  return { session_id: sid, id: uid, uid, ident: username, domain_id: 1, domain: "kernel.test", nobody_id: runtime.NOBODY_UID, guest_id: "f000000000000001", signed_in: uid === runtime.NOBODY_UID ? 0 : 1, status: uid === runtime.NOBODY_UID ? "new" : "ok" };
}
const store = {
  async ensureSession(requested) {
    const sid = requested && sessions.has(requested) ? requested : `fixture-session-${String(++session_serial).padStart(12, "0")}`;
    if (!sessions.has(sid)) sessions.set(sid, context(sid));
    return { session_id: sid };
  },
  async resolveSession(sid) { return sessions.get(sid) || null; },
  async resolveSessionContext(sid) { return sessions.get(sid) || null; },
  async signin({ uid, password, sid }) {
    if (password !== "isolated-fixture-password" || !users.has(uid)) return { status: "failed" };
    sessions.set(sid, context(sid, users.get(uid), uid)); return { status: "ok", id: users.get(uid), session_id: sid };
  },
  async domainPermission(uid) { return [...users.values()].includes(uid) ? 63 : 0; },
  async storeAuthn(token, value) { tokens.set(token, value.id); },
  async bindSocket({ id, token }) {
    const sid = tokens.get(token); tokens.delete(token);
    if (!sid) return null;
    sockets.set(id, sid); return { socket_id: id, session_id: sid };
  },
  async freeSocket(id) { sockets.delete(id); },
  async refreshSockets() {},
  async socketRecipients(sid) { return [...sockets.entries()].filter(([, value]) => value === sid).map(([id]) => id); }
};
class MemoryRedis {
  async init() {}
  static getLiveUpdateChannel() { return "il1-fixture-push"; }
  static async getSubscribe() { return { async subscribe(_name, listener) { MemoryRedis.listener = listener; }, async unsubscribe() {}, async quit() {} }; }
  static async sendData(payload, dest) { if (MemoryRedis.listener) await MemoryRedis.listener(JSON.stringify({ payload, dest })); }
}
const session_manager = new runtime.SessionManager({ store });
const host_filesystem = new HostFilesystem({ root: artifact_root });
const file_io = new FileIo({ host_filesystem });
const real_send = file_io.send.bind(file_io);
file_io.send = (...args) => { delegation_count++; return real_send(...args); };
const staging = new TransferStaging({ root: path.join(artifact_root, "staging") });

function addNode(hub_id, nid, filename, relative, size = 256 * 1024) {
  const node = { hub_id, nid, filename, filetype: "file", mimetype: "application/octet-stream", filesize: size, filepath: `/${filename}`, storage_ref: { type: "local-content", relative: relative || `${hub_id}/${nid}` } };
  const target = path.join(artifact_root, node.storage_ref.relative);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  if (!fs.existsSync(target)) {
    const bytes = Buffer.alloc(size); for (let index = 0; index < size; index++) bytes[index] = index % 251;
    fs.writeFileSync(target, bytes);
  }
  nodes.set(key(node), node); return node;
}
addNode(hub_a, original_id, "original.bin");
addNode(hub_b, original_id, "other-hub.bin");
addNode(hub_a, "d000000000000006", "private.bin");
addNode(hub_a, "d000000000000007", "large.bin", null, 32 * 1024 * 1024);
const folder = { hub_id: hub_a, nid: folder_id, filename: "Uploads", filetype: "root", filepath: "/Uploads" }; nodes.set(key(folder), folder);
fs.mkdirSync(incoming, { recursive: true });
fs.writeFileSync("/fixture/outside.txt", "outside-protected-view");
// /etc/passwd exists in BOTH containers: denying this link proves Nginx's
// symlink guard, rather than merely an absent target in the gateway mount.
const symlink = path.join(artifact_root, hub_a, "symlink"); if (!fs.existsSync(symlink)) fs.symlinkSync("/etc/passwd", symlink);
nodes.set(`${hub_a}:d000000000000008`, { ...nodes.get(`${hub_a}:${original_id}`), nid: "d000000000000008", storage_ref: { type: "local-content", relative: `${hub_a}/symlink` } });

const hub_authorizer = new runtime.HubAuthorizer({ permissionValue, resolver: {
  async resolveAuthorized({ hub_id, uid, asked_permission }) {
    const rights = hub_id === hub_a ? uid === owner ? 63 : uid === reader ? 3 : 0 : 0;
    if ((rights & asked_permission) !== asked_permission) throw Object.assign(new Error("fixture denied"), { code: "HUB_PERMISSION_DENIED" });
    return { hub_id, database_name: `fixture_${hub_id}`, privilege: rights, authorized: true };
  }
} });
let mfs_transfer;
const permission_backend = new MfsPermissionBackend({ permission_store: {
  effectivePermission(uid, node) { return uid === owner ? 63 : uid === reader && node.nid !== "d000000000000006" ? 3 : 0; }
}, transfer_resource: (value) => mfs_transfer.resourceFor(value) });
const mfs_service = new MfsService({ permission_backend, filesystem_factory: () => ({
  async getNode({ node }) { const value = nodes.get(key(node)); if (!value) throw Object.assign(new Error("fixture node missing"), { code: "MFS_NODE_NOT_FOUND" }); return value; },
  async enumerateTree({ roots }) { return { roots, entries: roots.map((root) => nodes.get(key(root))) }; },
  async commitFile(input) {
    const nid = `d${String(node_serial++).padStart(15, "0")}`;
    const relative = `${input.destination.hub_id}/${nid}`;
    fs.renameSync(staging.claim(input.payload_ref), path.join(artifact_root, relative));
    const node = { hub_id: input.destination.hub_id, nid, filename: input.metadata.filename, filetype: "file", mimetype: input.metadata.mimetype || "application/octet-stream", filesize: input.metadata.size, storage_ref: { type: "local-content", relative } };
    nodes.set(key(node), node); return node;
  }
}) });
mfs_transfer = new MfsTransferService({ mfs_service, staging, host_filesystem, upload_chunk_size: 256 * 1024, max_upload_chunk_size: 1024 * 1024 });
const representations = new RepresentationManager({ host_filesystem });
const media_service = new MediaService({ host_filesystem, representations, node_resolver: async (node) => nodes.get(key(node)) });
const original = nodes.get(`${hub_a}:${original_id}`);
for (const [kind, options, content] of [
  ["preview", {}, "preview-fixture"], ["master", {}, "#EXTM3U\nstream-1/playlist.m3u8\n"], ["stream", { serial: 1 }, "#EXTM3U\nsegment-1.ts\n"], ["segment", { serial: 1, segment: 1 }, "segment-fixture"]
]) { const target = host_filesystem.representationPath(original, kind, options); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, content); }

class ProbeWorker {
  constructor({ session }) { this.session = session; }
  headers(input) { const headers = this.session.fixture_headers; return { echoed: input.value, host: headers.host, real_ip: headers["x-real-ip"], forwarded_for: headers["x-forwarded-for"], forwarded_proto: headers["x-forwarded-proto"], forwarded_port: headers["x-forwarded-port"], forwarded: headers.forwarded || null, forwarded_host: headers["x-forwarded-host"] || null }; }
  statistics() { return { delegation_count, dispatched, incoming: fs.readdirSync(incoming).length, uploads: mfs_transfer.uploads.size, downloads: mfs_transfer.downloads.size }; }
  invalid() { return file_io.send(this.session.output, host_filesystem.original({ storage_ref: { type: "local-content", relative: "../outside.txt" } })); }
  deleted() {
    const target = path.join(artifact_root, hub_a, "deleted"); fs.writeFileSync(target, "deleted-after-authorization");
    return file_io.send({ head: (headers, status) => { fs.unlinkSync(target); return this.session.output.head(headers, status); } }, host_filesystem.artifact(target, "deleted.bin"));
  }
}
const registry = new runtime.DescriptorRegistry({ permissionValue });
for (const directory of ["../../../../foundation/server-runtime/acl", "../../../hello/server/acl", "../../../media-service/server/acl", "../../../mfs-transfer/server/acl"]) registry.registerDirectory(path.resolve(__dirname, directory));
registry.registerDescriptor("probe", {
  services: { headers: { scope: "kernel", permission: { src: "anonymous", fast_check: "public-api" } }, statistics: { scope: "kernel", permission: { src: "anonymous", fast_check: "public-api" } }, invalid: { scope: "hub", permission: { src: "read" } }, deleted: { scope: "hub", permission: { src: "read" } } },
  modules: { public: "/fixture/probe-worker", private: "/fixture/probe-worker" }
});
const dispatcher = new runtime.ServiceDispatcher({ registry,
  authorize: runtime.createAuthorizer({ domainAuthorizer: new runtime.DomainAuthorizer({ store }), hubAuthorizer: hub_authorizer, mfsPermissionBackend: permission_backend }),
  capability_resolver: new runtime.CapabilityResolver({ providers: { "system-mfs": async () => ({ available: true, status: "installed" }) } }),
  requireWorker: (file) => file === "/fixture/probe-worker.js" ? ProbeWorker : require(file),
  workerOptions: { mfs_transfer, file_io, media_service, push: new runtime.PushBus({ redisStore: MemoryRedis, socketStore: store, logger: null }), pluginResolver: new runtime.FrontendPluginResolver({ roots: [{ directory: "/fixture/public/plugins", publicPrefix: "/-/plugins" }] }) }
});
const service = runtime.createServiceServer({ dispatcher,
  allowedOrigins: ["https://external-fixture.example"],
  sessionFactory: async (request) => { const session = await session_manager.fromRequest(request); session.fixture_headers = request.headers; return session; },
  onDispatch: () => { dispatched++; },
  binary_uploads: { "mfs-transfer.upload_chunk": { directory: incoming, max_bytes: 1024 * 1024, before_receive: ({ input, session }) => mfs_transfer.uploadPreflight(input, { uid: session.uid() }) } }
});
let ready = false;
const page = http.createServer((request, response) => {
  if (request.url === "/__ready") { response.writeHead(ready ? 200 : 503); response.end(ready ? "ready" : "starting"); return; }
  if (request.url === "/bootstrap.js") { response.writeHead(200, { "content-type": "application/javascript" }); response.end("window.IL1_BOOTSTRAP={fixture:true};"); return; }
  if (["/", "/-/"].includes(request.url)) {
    response.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="icon" href="data:,"><link rel="stylesheet" href="/-/static/smoke.css"></head><body><main id="widget"></main><script src="/bootstrap.js"></script><script src="/-/app/core.js"></script></body></html>'); return;
  }
  response.writeHead(404); response.end();
});
const websocket = new runtime.WebSocketPushRouter({ httpServer: page, sessionManager: session_manager, socketStore: store, redisStore: MemoryRedis, allowedOrigins: ["https://external-fixture.example"], logger: null, watchdogInterval: 2000 });
async function listen(server, port) { await new Promise((resolve) => server.listen(port, "0.0.0.0", resolve)); }
async function main() { await listen(service, 3101); await listen(page, 3102); await websocket.start(); ready = true; console.log("IL1 kernel composition ready"); }
async function stop() { ready = false; await websocket.stop(); mfs_transfer.destroy(); representations.stop(); for (const server of [service, page]) server.close(); setTimeout(() => process.exit(0), 100).unref(); }
process.once("SIGTERM", stop); process.once("SIGINT", stop);
main().catch((error) => { console.error(error.code || "FIXTURE_START_FAILED"); process.exit(1); });
