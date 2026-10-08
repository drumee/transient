"use strict";

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { HubLifecycleError } = require("./errors");

const MODULE_ID = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TARGETS = new Set(["hub", "drumate", "principal", "platform", "yellow-page", "common"]);

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
}

function checksum(value) {
  return crypto.createHash("sha256").update(JSON.stringify(stable(value))).digest("hex");
}

function requirement(value, module_id) {
  if (typeof value === "string" && MODULE_ID.test(value)) return { module_id: value, schema_version: null };
  if (value && typeof value === "object" && MODULE_ID.test(value.module || "")) {
    if (value.schemaVersion !== undefined && (typeof value.schemaVersion !== "string" && typeof value.schemaVersion !== "number")) {
      throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `${module_id}.requires schemaVersion must reuse the dependency schemaVersion value`);
    }
    return { module_id: value.module, schema_version: value.schemaVersion === undefined ? null : String(value.schemaVersion) };
  }
  throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `${module_id}.requires contains an invalid module requirement`);
}

function entryTarget(entry, section) {
  if (entry.target) return entry.target;
  if (entry.schemaClass === "yellow-page") return "yellow-page";
  if (entry.schemaClass === "drumate") return "drumate";
  if (entry.schemaClass === "hub" || entry.schemaClass === "common") return "hub";
  if (section === "provision" || section === "migrations") return "hub";
  return "platform";
}

function objectKey(entry, target) {
  const object_type = entry.objectType || entry.type || "migration";
  const object_name = entry.objectName || entry.name || entry.identity;
  return object_name ? `${target}:${object_type}:${object_name}` : null;
}

function hubEntries(manifest) {
  const values = [];
  for (const section of ["provision", "migrations", "install"]) {
    const entries = Array.isArray(manifest[section]) ? manifest[section] : [];
    for (const entry of entries) {
      const target = entryTarget(entry, section);
      if (!TARGETS.has(target)) throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `Unknown schema target '${target}'`);
      if (target !== "hub") continue;
      values.push({ ...entry, target, object_key: objectKey(entry, target) });
    }
  }
  return values;
}

function normalizeManifest(module_id, manifest, { package_metadata = {}, manifest_path, legacy_path = false } = {}) {
  if (!MODULE_ID.test(module_id || "")) throw new HubLifecycleError("MODULE_ID_INVALID", `Invalid stable module id '${module_id}'`);
  if (!manifest || typeof manifest !== "object" || Array.isArray(manifest)) throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `${module_id} manifest must be an object`);
  const inherit = manifest.inherit === undefined ? "installed" : manifest.inherit;
  if (!["installed", "own"].includes(inherit)) throw new HubLifecycleError("SCHEMA_INHERIT_INVALID", `${module_id}.inherit must be 'installed' or 'own'`);
  if (manifest.requires !== undefined && !Array.isArray(manifest.requires)) throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `${module_id}.requires must be an array`);
  const requires = (manifest.requires || []).map((value) => requirement(value, module_id));
  const seen = new Set();
  for (const value of requires) {
    if (seen.has(value.module_id)) throw new HubLifecycleError("SCHEMA_MANIFEST_INVALID", `${module_id}.requires repeats '${value.module_id}'`);
    seen.add(value.module_id);
  }
  const entries = hubEntries(manifest);
  const schema_version = String(manifest.schemaVersion === undefined ? package_metadata.version || "0" : manifest.schemaVersion);
  const package_version = String(manifest.packageVersion || manifest.applicationVersion || package_metadata.version || "0");
  return {
    module_id,
    inherit,
    requires,
    contributes_hub: entries.length > 0 || Boolean(manifest.contributions && manifest.contributions.hub),
    entries,
    schema_version,
    package_version,
    manifest_checksum: checksum(manifest),
    manifest_path: manifest_path || null,
    legacy_path,
    raw: stable(manifest)
  };
}

function readModuleManifest(module_id, module_root) {
  const canonical = path.join(module_root, "server", "schemas", "SCHEMA_MANIFEST.json");
  const legacy = path.join(module_root, "schemas", "SCHEMA_MANIFEST.json");
  const manifest_path = fs.existsSync(canonical) ? canonical : fs.existsSync(legacy) ? legacy : null;
  if (!manifest_path) throw new HubLifecycleError("SCHEMA_MANIFEST_MISSING", `${module_id} has no server/schemas/SCHEMA_MANIFEST.json`);
  const package_path = path.join(module_root, "package.json");
  const package_metadata = fs.existsSync(package_path) ? JSON.parse(fs.readFileSync(package_path, "utf8")) : {};
  const manifest = JSON.parse(fs.readFileSync(manifest_path, "utf8"));
  return normalizeManifest(module_id, manifest, { package_metadata, manifest_path, legacy_path: manifest_path === legacy });
}

module.exports = { MODULE_ID, checksum, normalizeManifest, readModuleManifest, stable };
