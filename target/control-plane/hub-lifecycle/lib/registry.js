"use strict";

const { HubLifecycleError } = require("./errors");
const { readModuleManifest } = require("./manifest");

class ModuleRegistry {
  constructor() { this.modules = new Map(); }

  register({ module_id, module_root, manifest, handler, active = true, installed = true, artifact_ref } = {}) {
    const definition = manifest || readModuleManifest(module_id, module_root);
    if (definition.module_id !== module_id) throw new HubLifecycleError("MODULE_MANIFEST_MISMATCH", `Manifest does not belong to '${module_id}'`);
    if (typeof handler !== "function" && definition.contributes_hub) throw new HubLifecycleError("MODULE_HANDLER_REQUIRED", `${module_id} contributes Hub schema but has no trusted provisioner`);
    const record = { module_id, module_root: module_root || null, manifest: definition, handler, active: Boolean(active), installed: Boolean(installed), artifact_ref: artifact_ref || definition.manifest_checksum };
    this.modules.set(module_id, record);
    return record;
  }

  get(module_id) { return this.modules.get(module_id); }
  values() { return [...this.modules.values()]; }

  resolvePlan(creator_module) {
    const creator = this.get(creator_module);
    if (!creator || !creator.installed || !creator.active) throw new HubLifecycleError("CREATOR_MODULE_UNAVAILABLE", `Creator module '${creator_module}' is not installed and active`);
    const roots = creator.manifest.inherit === "installed"
      ? this.values().filter((entry) => entry.installed && entry.active && entry.manifest.contributes_hub).map((entry) => entry.module_id)
      : [creator_module];
    if (!roots.includes(creator_module)) roots.push(creator_module);
    const visiting = new Set();
    const visited = new Set();
    const ordered = [];
    const visit = (module_id, chain = []) => {
      if (visiting.has(module_id)) throw new HubLifecycleError("SCHEMA_DEPENDENCY_CYCLE", `Schema dependency cycle: ${[...chain, module_id].join(" -> ")}`);
      if (visited.has(module_id)) return;
      const record = this.get(module_id);
      if (!record || !record.installed) throw new HubLifecycleError("SCHEMA_DEPENDENCY_MISSING", `Required module '${module_id}' is not installed`);
      if (!record.active) throw new HubLifecycleError("SCHEMA_DEPENDENCY_INACTIVE", `Required module '${module_id}' is not active`);
      visiting.add(module_id);
      for (const required of record.manifest.requires) {
        const dependency = this.get(required.module_id);
        if (required.schema_version && dependency && dependency.manifest.schema_version !== required.schema_version) {
          throw new HubLifecycleError("SCHEMA_DEPENDENCY_VERSION", `${module_id} requires ${required.module_id} schemaVersion ${required.schema_version}`);
        }
        visit(required.module_id, [...chain, module_id]);
      }
      visiting.delete(module_id);
      visited.add(module_id);
      if (record.manifest.contributes_hub || module_id === creator_module) ordered.push(record);
    };
    roots.sort().forEach((module_id) => visit(module_id));
    const owners = new Map();
    for (const record of ordered) for (const entry of record.manifest.entries) {
      if (!entry.object_key) continue;
      const prior = owners.get(entry.object_key);
      if (prior && prior !== record.module_id) throw new HubLifecycleError("SCHEMA_OBJECT_COLLISION", `${entry.object_key} is declared by '${prior}' and '${record.module_id}'`);
      owners.set(entry.object_key, record.module_id);
    }
    return {
      creator_module,
      inherit: creator.manifest.inherit,
      modules: ordered.map((record) => ({
        module_id: record.module_id,
        schema_version: record.manifest.schema_version,
        package_version: record.manifest.package_version,
        requires: record.manifest.requires,
        manifest_checksum: record.manifest.manifest_checksum,
        artifact_ref: record.artifact_ref,
        object_keys: record.manifest.entries.map((entry) => entry.object_key).filter(Boolean)
      }))
    };
  }
}

module.exports = { ModuleRegistry };
