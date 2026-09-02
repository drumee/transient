module.exports = class KernelProbeWorker {
  async status() {
    return { runtime: "phase2", team: false, mfs: false, schemas: false };
  }
};
