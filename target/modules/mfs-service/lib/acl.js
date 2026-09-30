"use strict";

const NOBODY_UID = "ffffffffffffffff";

function trustedUid(session) {
  if (session && typeof session.uid === "function") return session.uid() || NOBODY_UID;
  const identity = session && typeof session.identity === "function" ? session.identity() : null;
  return identity && identity.id || NOBODY_UID;
}

function trustedHubId(session) {
  if (session && typeof session.currentHub === "function") return session.currentHub();
  const hub = session && session.hub;
  if (hub && typeof hub.get === "function") return hub.get("id");
  return hub && (hub.id || hub.hub_id) || null;
}

function resources(service, input, transfer_resource) {
  const name = String(service || "").split(".").pop();
  if (["list"].includes(name)) return { src: [input.location] };
  if (["get", "rename", "remove"].includes(name)) return { src: [input.node] };
  if (["mkdir", "commit_upload", "upload_start"].includes(name)) return { dest: [input.destination] };
  if (name === "move") return { src: input.nodes || [], dest: [input.destination] };
  if (name === "copy") return { src: input.sources || [], dest: [input.destination] };
  if (name === "download_prepare") return { src: input.roots || [] };
  return transfer_resource ? transfer_resource({ service, input }) : {};
}

class MfsAclAuthorizer {
  constructor({ permission_store, transfer_resource } = {}) {
    if (!permission_store || typeof permission_store.effectivePermission !== "function") throw new Error("MFS ACL requires an effective-permission store");
    this.permission_store = permission_store;
    this.transfer_resource = transfer_resource;
  }

  async authorize({ service, permission, input = {}, session } = {}) {
    if (!permission || permission.scope !== "mfs") return { granted: false, mode: "unsupported-scope" };
    const uid = trustedUid(session);
    const target = await resources(service, input, this.transfer_resource);
    for (const side of ["src", "dest"]) {
      const asked = permission[side];
      if (asked == null || Number(asked) === 0) continue;
      const nodes = (await target)[side] || [];
      if (!nodes.length) return { granted: false, mode: "mfs", side, reason: "resource-required" };
      for (const node of nodes) {
        const target_node = node && node.hub_id ? node : { ...node, hub_id: trustedHubId(session) };
        if (!target_node || !target_node.hub_id || !target_node.nid) return { granted: false, mode: "mfs", side, reason: "trusted-resource-identity-required" };
        const privilege = await this.permission_store.effectivePermission(uid, target_node);
        if ((Number(privilege) & Number(asked)) !== Number(asked)) return { granted: false, mode: "mfs", side, node, asked, privilege };
      }
    }
    return { granted: true, mode: "mfs", uid };
  }
}

module.exports = { MfsAclAuthorizer, resources, trustedHubId, trustedUid };
