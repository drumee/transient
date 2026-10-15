"use strict";
class OperatorBootstrapError extends Error {
  constructor(code) { super(code); this.name = "OperatorBootstrapError"; this.code = code; }
}
const fail = code => { throw new OperatorBootstrapError(code); };
module.exports = { OperatorBootstrapError, fail };
