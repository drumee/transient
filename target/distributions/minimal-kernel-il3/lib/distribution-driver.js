"use strict";
// Privileged distribution test boundary, deliberately outside Infra Layer.
// Grants use the owned database's LOCAL root socket; root stays localhost-only.
const D = require("@drumee/infra-layer/lifecycle/docker");
const { fail } = require("./database");
function grantSchemas(prepared) {
  const owned = D.inspectProject(prepared.project, Object.keys(prepared.compose.services));
  if (!owned.some(value => value.service === "database" && value.running && value.revision === prepared.revision)) fail("OWNED_DATABASE_REQUIRED");
  const sql = "CREATE DATABASE IF NOT EXISTS yp CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci; GRANT ALL PRIVILEGES ON yp.* TO 'infra_client'@'%'; GRANT ALL PRIVILEGES ON `hub\\_%`.* TO 'infra_client'@'%';";
  // Exact fixed SQL; no user input, plaintext credentials or raw daemon errors.
  return D.compose(prepared, ["exec", "-T", "database", "/bin/sh", "-c", 'MYSQL_PWD="$(cat /run/secrets/database-admin)" exec mariadb --protocol=socket -uroot --batch'], { input: sql, encoding: "utf8" });
}
module.exports = {
  ...D,
  compose(prepared, args, options) {
    if (args[0] === "run" && args.length === 4 && args[3] === "kernel-init") grantSchemas(prepared);
    return D.compose(prepared, args, options);
  }
};
