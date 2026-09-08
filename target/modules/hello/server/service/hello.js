/*
 * Phase 3 validation worker. Its deliberately deterministic response makes
 * the dispatcher and browser tests observable without any persisted state.
 */
module.exports = class HelloWorker {
  constructor({ session, push } = {}) {
    this.session = session;
    this.pushBus = push;
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

  async push() {
    if (!this.pushBus || typeof this.pushBus.publish !== "function" || !this.session || !this.session.sid) {
      throw new Error("Kernel push transport is not configured for this authenticated session");
    }
    const result = await this.pushBus.publish({
      service: "hello.push",
      sessionId: this.session.sid,
      data: { message: "Hello over WebSocket" }
    });
    return { ok: true, module: "hello", scope: "domain", ...result };
  }
};
