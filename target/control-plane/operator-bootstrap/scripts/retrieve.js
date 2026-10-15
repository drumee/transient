"use strict";
// Explicit owner-authorized initial delivery to the controlling TTY only.
// Passwords are never arguments, environment variables or ordinary stdout.
const fs = require("node:fs"), tty = require("node:tty");
const { retrieveInitialCredential } = require("../lib");
let fd, delivery;
try {
  const args = process.argv.slice(2);
  if (args.length !== 5 || args[0] !== "--authorize-retrieval" || args[1] !== "--resource" || args[3] !== "--operation-id") throw Error("OPERATOR_RETRIEVAL_ARGUMENTS_INVALID");
  if (!process.stdin.isTTY) throw Error("OPERATOR_RETRIEVAL_TTY_REQUIRED");
  fd = fs.openSync("/dev/tty", "w");
  if (!tty.isatty(fd)) throw Error("OPERATOR_RETRIEVAL_TTY_REQUIRED");
  delivery = retrieveInitialCredential({ file: args[2], authorization: { authorized: true, scope: "retrieve-initial-credential", operation_id: args[4] } });
  fs.writeSync(fd, "Initial Drumee login: " + delivery.username + "\nInitial password: ");
  fs.writeSync(fd, delivery.password); fs.writeSync(fd, "\n");
} catch (_) {
  process.stderr.write("OPERATOR_PROTECTED_RETRIEVAL_FAILED\n"); process.exitCode = 1;
} finally {
  if (delivery) delivery.password.fill(0);
  if (fd !== undefined) fs.closeSync(fd);
}
