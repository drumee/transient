"use strict";

class HubLifecycleError extends Error {
  constructor(code, message, details) {
    super(message || code);
    this.name = "HubLifecycleError";
    this.code = code;
    this.details = details;
  }
}

module.exports = { HubLifecycleError };
