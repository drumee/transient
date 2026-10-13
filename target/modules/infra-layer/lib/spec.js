"use strict";

const crypto = require("node:crypto");
const path = require("node:path");
const net = require("node:net");

function record(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

// Validate descriptors before reading values: planning never evaluates input getters.
function plainTree(value, ancestors = new Set()) {
  if (value === null || ["string", "boolean"].includes(typeof value)) return true;
  if (typeof value === "number") return Number.isFinite(value);
  if (typeof value !== "object" || (!record(value) && !Array.isArray(value)) || ancestors.has(value)) return false;
  ancestors.add(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const valid = Reflect.ownKeys(descriptors).every((key) => typeof key === "string"
    && !["__proto__", "constructor", "prototype"].includes(key)
    && !descriptors[key].get && !descriptors[key].set && plainTree(descriptors[key].value, ancestors));
  ancestors.delete(value);
  return valid;
}

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (record(value)) return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonical(value[key])]));
  return value;
}
function serialize(value) { return JSON.stringify(canonical(value)); }
function digest(value) { return crypto.createHash("sha256").update(typeof value === "string" ? value : serialize(value)).digest("hex"); }
function clone(value) { return JSON.parse(serialize(value)); }
function lexical(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
function hostname(value) {
  return typeof value === "string" && value.length <= 253 && value === value.toLowerCase()
    && value.split(".").every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
}
function resourcePath(value) {
  return typeof value === "string" && /^\/[a-zA-Z0-9_./-]+$/.test(value) && !value.includes("//") && !value.endsWith("/")
    && !value.split("/").some((part) => part === "." || part === "..")
    && path.posix.normalize(value) === value && !["/", "/data", "/etc", "/var", "/srv", "/home"].includes(value);
}
function prefix(value) { return typeof value === "string" && /^\/(?:[a-zA-Z0-9_-]+\/)+$/.test(value); }
function contains(parent, child) { return parent === child || child.startsWith(`${parent}/`); }
function port(value) { return Number.isInteger(value) && value > 0 && value <= 65535; }
function endpoint(value) {
  return record(value) && (hostname(value.host) || net.isIP(value.host)) && port(value.port) && value.transport === "tcp";
}
function identifier(value) { return typeof value === "string" && /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,79}$/.test(value); }
function resolveDomain(spec) {
  if (spec.dns.mode === "localhost") return "localhost";
  return spec.instance.domain || (spec.dns.mode === "local" ? "drumee.lan" : undefined);
}

module.exports = { canonical, clone, contains, digest, endpoint, hostname, identifier, lexical, plainTree, port, prefix, record, resolveDomain, resourcePath, serialize };
