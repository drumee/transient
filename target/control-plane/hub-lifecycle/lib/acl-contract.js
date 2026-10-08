"use strict";

const { HubLifecycleError } = require("./errors");

const ACCESS_NAMES = Object.freeze(["read", "write", "delete", "admin", "owner"]);

function createAclContract(constants) {
  const permission = constants && constants.permission;
  const privilege = constants && constants.privilege;
  if (!permission || !privilege) {
    throw new HubLifecycleError("HUB_ACL_CONSTANTS_REQUIRED", "Hub lifecycle requires server-essentials permission and privilege constants");
  }

  const permission_values = {};
  const privilege_values = {};
  for (const name of ACCESS_NAMES) {
    const asked = Number(permission[name]);
    const granted = Number(privilege[name]);
    if (!Number.isInteger(asked) || asked <= 0 || !Number.isInteger(granted) || granted <= 0 || (granted & asked) !== asked) {
      throw new HubLifecycleError("HUB_ACL_CONSTANTS_INVALID", `Invalid canonical ACL constants for '${name}'`);
    }
    permission_values[name] = asked;
    privilege_values[name] = granted;
  }

  function value(table, kind, input) {
    if (typeof input === "string" && Object.hasOwn(table, input)) return table[input];
    const numeric = Number(input);
    if (Number.isInteger(numeric) && Object.values(table).includes(numeric)) return numeric;
    throw new HubLifecycleError(`HUB_${kind.toUpperCase()}_INVALID`, `Unknown canonical Hub ${kind} '${input}'`);
  }

  return Object.freeze({
    names: ACCESS_NAMES,
    permission: Object.freeze(permission_values),
    privilege: Object.freeze(privilege_values),
    permissionFor(input) { return value(permission_values, "permission", input); },
    privilegeFor(input) { return value(privilege_values, "privilege", input); },
    grants(granted_privilege, asked_permission) {
      const granted = Number(granted_privilege) || 0;
      const asked = value(permission_values, "permission", asked_permission);
      return (granted & asked) === asked;
    }
  });
}

module.exports = { ACCESS_NAMES, createAclContract };
