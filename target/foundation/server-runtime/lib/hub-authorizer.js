"use strict";

const { RuntimeError } = require("./errors");

const HUB_ID = /^[a-f0-9]{16}$/i;

class HubAuthorizer {
  constructor({ resolver, permissionValue } = {}) {
    if (!resolver || typeof resolver.resolveAuthorized !== "function") throw new RuntimeError("HUB_RESOLVER_REQUIRED", "Hub authorization requires an injected lifecycle resolver");
    if (typeof permissionValue !== "function") throw new RuntimeError("PERMISSION_CONVERTER_REQUIRED", "Hub authorization requires the current server-essentials permissionValue converter");
    this.resolver = resolver;
    this.permission_bits = new Set(["read", "write", "delete", "admin", "owner"].map((name) => Number(permissionValue(name))));
    if (this.permission_bits.size !== 5 || [...this.permission_bits].some((value) => !Number.isInteger(value) || value <= 0)) {
      throw new RuntimeError("PERMISSION_CONVERTER_INVALID", "Hub authorization received invalid canonical permission values");
    }
  }

  async authorize(resolved = {}) {
    const session = resolved.session;
    if (!session || typeof session.isAuthenticated !== "function" || !session.isAuthenticated()) {
      return { granted: false, mode: "hub", reason: "HUB_AUTHENTICATION_REQUIRED" };
    }
    const principal = typeof session.identity === "function" ? session.identity() : typeof session.principal === "function" ? session.principal() : null;
    const uid = typeof session.uid === "function" ? session.uid() : principal && principal.id;
    if (!principal || !uid || ["nobody", "guest"].includes(principal.kind) || !principal.domainId) {
      return { granted: false, mode: "hub", reason: "HUB_PRINCIPAL_INVALID" };
    }
    const selector = resolved.permission && resolved.permission.selector || "hub_id";
    const requested = resolved.input && resolved.input[selector];
    if (typeof requested !== "string" || !HUB_ID.test(requested)) return { granted: false, mode: "hub", reason: "HUB_SELECTION_REQUIRED" };
    const asked_permission = Number(resolved.permission && resolved.permission.src);
    if (!this.permission_bits.has(asked_permission)) return { granted: false, mode: "hub", reason: "HUB_PERMISSION_INVALID" };
    try {
      const hub_context = await this.resolver.resolveAuthorized({
        hub_id: requested.toLowerCase(),
        uid,
        organisation_id: Number(principal.domainId),
        asked_permission,
        capabilities: Array.isArray(resolved.permission.capabilities) ? resolved.permission.capabilities : []
      });
      return { granted: true, mode: "hub", uid, hub_context };
    } catch (error) {
      return { granted: false, mode: "hub", reason: error.code || "HUB_PERMISSION_DENIED" };
    }
  }
}

module.exports = { HUB_ID, HubAuthorizer };
