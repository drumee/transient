"use strict";

function trustedHubId(session) {
  if (session && typeof session.currentHub === "function") return session.currentHub();
  const hub = session && session.hub;
  if (hub && typeof hub.get === "function") return hub.get("id");
  return hub && (hub.id || hub.hub_id) || null;
}

function serviceResources(service, input, transfer_resource) {
  const name = String(service || "").split(".").pop();
  if (["list"].includes(name)) return { src: [input.location] };
  if (["get", "rename", "remove"].includes(name)) return { src: [input.node] };
  if (["mkdir", "commit_upload", "upload_start"].includes(name)) return { dest: [input.destination] };
  if (name === "move") return { src: input.nodes || [], dest: [input.destination] };
  if (name === "copy") return { src: input.sources || [], dest: [input.destination] };
  if (name === "download_prepare") return { src: input.roots || [] };
  if (["orig", "preview", "thumb", "document", "video", "master", "stream", "segment"].includes(name)) return { src: [{ hub_id: input.hub_id, nid: input.nid }] };
  return transfer_resource ? transfer_resource({ service, input }) : {};
}

class MfsPermissionBackend {
  constructor({ permission_store, transfer_resource } = {}) {
    if (!permission_store || typeof permission_store.effectivePermission !== "function") throw new Error("MFS ACL requires an effective-permission store");
    this.permission_store = permission_store;
    this.transfer_resource = transfer_resource;
  }

  async resources({ service, input = {}, session } = {}) {
    const target = await serviceResources(service, input, this.transfer_resource);
    const normalized = {};
    for (const side of ["src", "dest"]) {
      normalized[side] = ((target && target[side]) || []).map((node) => node && node.hub_id ? node : { ...node, hub_id: trustedHubId(session) });
    }
    return normalized;
  }

  effectivePermission(uid, node) { return this.permission_store.effectivePermission(uid, node); }
}

module.exports = { MfsPermissionBackend, serviceResources, trustedHubId };
