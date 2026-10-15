"use strict";
// Disposable-process concurrency harness. Arguments contain only a private
// descriptor path; no credentials are in arguments, environment or output.
const fs = require("node:fs"), mariadb = require("mariadb"), api = require("../../lib");
(async () => {
  const config = JSON.parse(fs.readFileSync(process.argv[2], "utf8"));
  const connection = await mariadb.createConnection({ host: "127.0.0.1", port: config.port, user: "root", password: fs.readFileSync(config.password_file, "utf8"), database: config.database, bigIntAsNumber: true });
  try {
    const result = await api.enrollInitialOperator({ ...config.intent, database: { connection }, credential_provider: api.createFileCredentialProvider({ mode: "automatic", file: config.file }) });
    console.log(JSON.stringify({ uid: result.uid, changed: result.changed }));
  } catch (error) {
    console.log(JSON.stringify({ code: error instanceof api.OperatorBootstrapError ? error.code : "CHILD_ENROLLMENT_FAILED" }));
  } finally { await connection.end(); }
})().catch(() => { console.log(JSON.stringify({ code: "CHILD_PREPARATION_FAILED" })); process.exitCode = 1; });
