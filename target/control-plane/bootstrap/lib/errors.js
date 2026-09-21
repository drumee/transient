"use strict";

class PlatformBootstrapError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "PlatformBootstrapError";
    this.code = code;
    this.details = details;
  }
}

module.exports = { PlatformBootstrapError };
