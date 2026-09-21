#!/usr/bin/env node
"use strict";

const childProcess = require("child_process");
const path = require("path");
const { bootstrap, validate, SqlPlatformStore } = require(path.resolve(__dirname, "../../../target/control-plane/bootstrap/lib"));

const container = process.env.KERNEL_DB_CONTAINER || "transient-kernel-phase4-db";
const databaseName = process.env.KERNEL_DB_NAME || "yp";
const password = process.env.KERNEL_DB_ROOT_PASSWORD || "phase4-disposable-root";
const operation = process.argv[2] || "validate";
const domain = process.argv[3] || "kernel.test";

function literal(value) {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return String(value);
  return `'${String(value).replaceAll("\\", "\\\\").replaceAll("'", "''")}'`;
}

function bind(sql, parameters) {
  let index = 0;
  const bound = sql.replace(/\?/g, () => {
    if (index >= parameters.length) throw new Error("Missing SQL parameter");
    return literal(parameters[index++]);
  });
  if (index !== parameters.length) throw new Error("Unused SQL parameter");
  return bound;
}

function parse(output) {
  const lines = output.trim().split("\n").filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split("\t");
  return lines.slice(1).map((line) => Object.fromEntries(
    line.split("\t").map((value, index) => [headers[index], value === "NULL" ? null : value])
  ));
}

const database = {
  async query(sql, ...parameters) {
    const result = childProcess.spawnSync("docker", [
      "exec", "-e", `MYSQL_PWD=${password}`, container,
      "mariadb", "--protocol=tcp", "--host=127.0.0.1", "--user=root",
      "--batch", "--raw", databaseName, "--execute", bind(sql, parameters)
    ], { encoding: "utf8" });
    if (result.status !== 0) throw new Error(`${result.stdout}\n${result.stderr}`.trim());
    return parse(result.stdout);
  }
};

async function main() {
  const store = new SqlPlatformStore({ database });
  if (operation === "bootstrap") {
    const before = await validate({ store, domain });
    if (process.argv.includes("--require-invalid") && before.valid) throw new Error("Expected platform invariants to be absent before bootstrap");
    const report = await bootstrap({ store, domain, organisationName: "Kernel integration" });
    process.stdout.write(`${JSON.stringify({ before, after: report })}\n`);
    return;
  }
  if (operation === "validate") {
    const report = await validate({ store, domain });
    process.stdout.write(`${JSON.stringify(report)}\n`);
    if (!report.valid) process.exitCode = 1;
    return;
  }
  throw new Error(`Unknown platform bootstrap operation: ${operation}`);
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`);
  process.exitCode = 1;
});
