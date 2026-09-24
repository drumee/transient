#!/usr/bin/env node
"use strict";

const child_process = require("child_process");
const path = require("path");
const { MfsNamespace, SqlMfsStore, install, provision, validate_installation, validate_provisioning } = require(path.resolve(__dirname, "../../../target/modules/system-mfs/lib"));

const container = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";
const database_name = process.env.KERNEL_DB_NAME || "yp";
const password = process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root";

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function bind(sql, parameters) {
  let index = 0;
  const bound = sql.replace(/\?/g, () => literal(parameters[index++]));
  if (index !== parameters.length) throw new Error("SQL parameter count does not match placeholders");
  return bound;
}

function parse(output) {
  const lines = output.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).filter((line) => line.split("\t").length === headers.length).map((line) => Object.fromEntries(
    line.split("\t").map((value, index) => [headers[index], value === "NULL" ? null : value])
  ));
}

const database = {
  runtime_user: process.env.KERNEL_DB_USER || "kernel_phase4",
  async query(sql, ...parameters) {
    const result = child_process.spawnSync("docker", [
      "exec", "-e", `MYSQL_PWD=${password}`, container,
      "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "--batch", "--raw", database_name,
      "--execute", bind(sql, parameters)
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
    return parse(result.stdout);
  },
  async execute_script(script, { database: selected = database_name } = {}) {
    const result = child_process.spawnSync("docker", [
      "exec", "-i", "-e", `MYSQL_PWD=${password}`, container,
      "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root", "--batch", "--raw", selected
    ], { encoding: "utf8", input: script });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
  }
};

async function main() {
  const operation = process.argv[2] || "validate-installation";
  const principal_id = process.argv[3];
  const context = principal_id ? { organisation_id: Number(process.argv[4] || 1), principal_id } : undefined;
  const store = new SqlMfsStore({ database });
  let report;
  if (operation === "install") report = await install({ store });
  else if (operation === "validate-installation") report = await validate_installation({ store });
  else if (operation === "provision") report = await provision({ store, context });
  else if (operation === "validate") report = await validate_provisioning({ store, context });
  else if (operation === "exercise") {
    const ready = await validate_provisioning({ store, context });
    if (!ready.valid) throw new Error(`MFS context is not ready: ${ready.status}`);
    const mfs = new MfsNamespace({ store, context });
    const created = await mfs.make_directory(ready.root_id, process.argv[5] || "Phase46B");
    report = { ready, created, resolved: await mfs.resolve_node(created.nid), children: await mfs.list_children(ready.root_id) };
  } else throw new Error(`Unknown system-mfs operation: ${operation}`);
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
