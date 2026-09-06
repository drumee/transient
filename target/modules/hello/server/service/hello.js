/*
 * Phase 3 validation worker. Its deliberately deterministic response makes
 * the dispatcher and browser tests observable without any persisted state.
 */
module.exports = class HelloWorker {
  constructor({ session } = {}) {
    this.session = session;
  }

  async ping() {
    return {
      ok: true,
      message: "Hello from Drumee",
      module: "hello"
    };
  }

  async private() {
    const identity = this.session && typeof this.session.identity === "function" ? this.session.identity() : null;
    return {
      ok: true,
      authenticated: true,
      module: "hello",
      scope: "domain",
      identity: { id: identity && identity.id }
    };
  }
};
