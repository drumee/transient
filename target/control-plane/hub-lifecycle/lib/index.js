"use strict";

const { HubLifecycleError } = require("./errors");
const { checksum, stable } = require("./manifest");
const { ModuleRegistry } = require("./registry");
const { READ, SqlHubStore, WRITE } = require("./store");

const FORBIDDEN_PUBLIC_FIELDS = ["database_name", "db_name", "db_host", "fs_host", "home_dir", "home_id", "credentials", "creator_module", "inherit"];

function sessionPrincipal(session) {
  if (!session || typeof session.isAuthenticated !== "function" || !session.isAuthenticated()) {
    throw new HubLifecycleError("HUB_AUTHENTICATION_REQUIRED", "Hub lifecycle requires a fully authenticated session");
  }
  const principal = typeof session.identity === "function" ? session.identity() : typeof session.principal === "function" ? session.principal() : null;
  const uid = typeof session.uid === "function" ? session.uid() : principal && principal.id;
  if (!principal || !uid || principal.kind === "nobody" || principal.kind === "guest" || principal.kind === "system") {
    throw new HubLifecycleError("HUB_PRINCIPAL_INVALID", "Anonymous, guest, nobody and system sessions cannot create private Hubs");
  }
  if (!Number.isInteger(Number(principal.domainId)) || Number(principal.domainId) < 1) throw new HubLifecycleError("HUB_ORGANISATION_REQUIRED", "Authenticated principal has no organisation context");
  return { uid: String(uid).toLowerCase(), organisation_id: Number(principal.domainId) };
}

function publicSpecification(specification) {
  const value = specification || {};
  for (const field of FORBIDDEN_PUBLIC_FIELDS) if (Object.hasOwn(value, field)) throw new HubLifecycleError("HUB_PUBLIC_INPUT_FORBIDDEN", `Public Hub request cannot set '${field}'`);
  const idempotency_key = typeof value.idempotency_key === "string" ? value.idempotency_key.trim() : "";
  const name = typeof value.name === "string" ? value.name.trim() : "";
  if (!idempotency_key || idempotency_key.length > 128 || !/^[A-Za-z0-9._:-]+$/.test(idempotency_key)) throw new HubLifecycleError("HUB_IDEMPOTENCY_KEY_INVALID", "Hub idempotency_key must be an opaque ASCII token of at most 128 characters");
  if (!name || name.length > 128) throw new HubLifecycleError("HUB_NAME_INVALID", "Hub name must contain 1 to 128 characters");
  return { idempotency_key, name };
}

class HubLifecycle {
  constructor({ store, registry, can_create } = {}) {
    if (!store) throw new HubLifecycleError("HUB_STORE_REQUIRED", "Hub lifecycle store is required");
    if (!registry || typeof registry.resolvePlan !== "function") throw new HubLifecycleError("MODULE_REGISTRY_REQUIRED", "Trusted module registry is required");
    this.store = store;
    this.registry = registry;
    this.can_create = can_create;
  }

  async createPrivateHub({ session, creator_module, specification } = {}) {
    const principal = sessionPrincipal(session);
    if (typeof this.can_create === "function" && !await this.can_create({ session, ...principal, creator_module })) {
      throw new HubLifecycleError("HUB_CREATE_PERMISSION_DENIED", "Principal cannot create a Hub in this organisation");
    }
    const request = publicSpecification(specification);
    const resolved = this.registry.resolvePlan(creator_module);
    const request_fingerprint = checksum({ creator_module, organisation_id: principal.organisation_id, uid: principal.uid, name: request.name });
    let hub = await this.store.reserveRequest({
      organisation_id: principal.organisation_id,
      creator_uid: principal.uid,
      creator_module,
      idempotency_key: request.idempotency_key,
      fingerprint: request_fingerprint,
      public_name: request.name,
      inherit: resolved.inherit
    });
    hub = await this.store.ensureShard(hub);
    const plan = await this._plan(hub, "create", resolved);
    await this.executePlan(plan);
    const ready = await this.store.getHub(hub.hub_id);
    return { hub_id: ready.hub_id, status: ready.state };
  }

  async _plan(hub, kind, resolved) {
    const snapshot = stable({
      creator_module: resolved.creator_module,
      inherit: resolved.inherit,
      modules: resolved.modules
    });
    const fingerprint = checksum(snapshot);
    return await this.store.findPlan(hub.hub_id, fingerprint) || this.store.createPlan(hub.hub_id, kind, fingerprint, snapshot);
  }

  async executePlan(plan, { after_handler } = {}) {
    const hub = await this.store.getHub(plan.hub_id);
    if (!hub) throw new HubLifecycleError("HUB_NOT_FOUND", "Provisioning plan Hub is missing");
    for (let index = Number(plan.cursor || 0); index < plan.snapshot.modules.length; index++) {
      const module = plan.snapshot.modules[index];
      const current = this.registry.get(module.module_id);
      if (!current || !current.active || !current.installed) throw new HubLifecycleError("PLAN_ARTIFACT_UNAVAILABLE", `Planned module '${module.module_id}' is unavailable`);
      if (current.manifest.manifest_checksum !== module.manifest_checksum || current.artifact_ref !== module.artifact_ref) {
        throw new HubLifecycleError("PLAN_ARTIFACT_CHANGED", `Planned artifact for '${module.module_id}' changed during execution`);
      }
      const state = await this.store.beginCapability(hub.hub_id, plan.id, module);
      if (state.status === "ready" && state.applied_version === module.schema_version) {
        await this.store.finishCapability(hub.hub_id, plan.id, module, index);
        continue;
      }
      try {
        await this.store.claimObjects(hub.hub_id, module.module_id, module.object_keys);
        await current.handler({
          hub: Object.freeze({ hub_id: hub.hub_id, type: "hub", database_name: hub.database_name, organisation_id: Number(hub.organisation_id), owner_id: hub.creator_uid, authorized: true }),
          module: Object.freeze({ ...module }),
          plan: Object.freeze({ id: plan.id, kind: plan.kind, fingerprint: plan.plan_fingerprint })
        });
        if (typeof after_handler === "function") await after_handler({ hub, module, index });
        await this.store.finishCapability(hub.hub_id, plan.id, module, index);
      } catch (error) {
        await this.store.failCapability(hub.hub_id, plan.id, module.module_id, error.code || "HUB_PROVISIONING_FAILED");
        throw error;
      }
    }
    return this.store.finishPlan(hub.hub_id, plan.id);
  }

  async upgradeExistingHubs({ inherit, after = "", limit = 100 } = {}) {
    if (!["installed", "own"].includes(inherit)) throw new HubLifecycleError("HUB_UPGRADE_POLICY_INVALID", "Upgrade scan requires installed or own policy");
    const hubs = await this.store.listHubs({ inherit, after, limit });
    const results = [];
    for (const item of hubs) {
      const hub = await this.store.getHub(item.hub_id);
      const resolved = this.registry.resolvePlan(hub.creator_module);
      const plan = await this._plan(hub, "upgrade", resolved);
      await this.executePlan(plan);
      results.push({ hub_id: hub.hub_id, plan_id: plan.id, status: "ready" });
    }
    return { results, next: hubs.length === Number(limit) ? hubs[hubs.length - 1].hub_id : null };
  }

  async grant({ actor_context, target_uid, permission } = {}) {
    if (!actor_context || !actor_context.authorized || actor_context.permission !== "write") throw new HubLifecycleError("HUB_GRANT_PERMISSION_DENIED", "Hub write context is required to grant access");
    const mask = permission === "write" ? READ | WRITE : permission === "read" ? READ : 0;
    if (!mask) throw new HubLifecycleError("HUB_PERMISSION_INVALID", "Permission must be read or write");
    await this.store.grant(actor_context.hub_id, target_uid, mask, actor_context.uid);
    return { hub_id: actor_context.hub_id, uid: target_uid, permission };
  }
}

module.exports = { HubLifecycle, HubLifecycleError, ModuleRegistry, READ, SqlHubStore, WRITE, publicSpecification, sessionPrincipal };
