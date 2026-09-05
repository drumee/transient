/*
 * Phase 3 validation worker. Its deliberately deterministic response makes
 * the dispatcher and browser tests observable without any persisted state.
 */
module.exports = class HelloWorker {
  async ping() {
    return {
      ok: true,
      message: "Hello from Drumee",
      module: "hello"
    };
  }
};
