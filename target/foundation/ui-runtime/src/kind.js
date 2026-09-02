const { EventBus } = require("./events");

function unwrap(value) {
  if (value && value.default) return value.default;
  return value;
}

class KindRegistry extends EventBus {
  constructor({ bootstrapPlugin, loadJS, logger = console, staticKinds = {} } = {}) {
    super();
    this.bootstrapPlugin = bootstrapPlugin;
    this.loadJS = loadJS;
    this.logger = logger;
    this.staticKinds = { ...staticKinds };
    this.applicationKinds = {};
    this.addons = {};
    this.plugins = new Map();
    this.pendingPlugins = new Map();
    this.ready = null;
  }

  setReady(ready) {
    this.ready = Promise.resolve(ready);
    return this.ready;
  }

  registerStatic(kind, value) {
    if (!kind || !value || this.staticKinds[kind]) return undefined;
    this.staticKinds[kind] = unwrap(value);
    return this.staticKinds[kind];
  }

  exists(kind) {
    return Boolean(this.staticKinds[kind] || this.applicationKinds[kind] || this.addons[kind]);
  }

  register(kind, value) {
    if (!kind || !value || this.staticKinds[kind] || this.applicationKinds[kind]) return undefined;
    const normalized = unwrap(value);
    this.applicationKinds[kind] = normalized;
    return normalized;
  }

  get(kind) {
    const value = this.staticKinds[kind] || this.applicationKinds[kind] || this.addons[kind];
    if (!value) return null;
    if (typeof value === "function") return value;
    if (typeof value.then === "function") {
      return value.then((loaded) => unwrap(loaded));
    }
    return unwrap(value);
  }

  registerAddons(args, ref) {
    if (typeof args === "string") {
      this._registerAddon(args, ref);
    } else if (Array.isArray(args)) {
      for (const entry of args) {
        if (Array.isArray(entry)) this._registerAddon(entry[0], entry[1]);
        else if (entry && typeof entry === "object") this.registerAddons(entry);
      }
    } else if (args && typeof args === "object") {
      for (const [kind, value] of Object.entries(args)) this._registerAddon(kind, value);
    }
    this.emit("addons:registered");
  }

  _registerAddon(kind, value) {
    if (!kind || !value || this.addons[kind]) return;
    this.addons[kind] = value;
  }

  async loadPlugin({ name, kind } = {}) {
    if (!name || !kind) throw new Error("Kind.loadPlugin requires name and kind");
    if (this.ready) await this.ready;
    if (this.exists(kind)) return this.get(kind);
    if (typeof this.bootstrapPlugin !== "function") {
      throw new Error("bootstrap.plugin transport is not configured");
    }
    const plugin = await this.bootstrapPlugin(name);
    if (!plugin || !plugin.path) throw new Error(`bootstrap.plugin did not resolve ${name}`);
    if (this.plugins.has(plugin.path)) return this.get(kind);
    if (this.pendingPlugins.has(plugin.path)) {
      await this.pendingPlugins.get(plugin.path);
      return this.get(kind);
    }
    if (typeof this.loadJS !== "function") throw new Error("loadJS is not configured");

    const loading = new Promise((resolve, reject) => {
      const off = this.once("addons:registered", () => {
        off();
        resolve(this.get(kind));
      });
      Promise.resolve(this.loadJS(plugin.path)).then(() => {
        this.plugins.set(plugin.path, plugin);
        // Current bundles register synchronously. A bundle that loaded but did
        // not register an addon is a clean failure instead of a hanging promise.
        if (!this.exists(kind)) {
          off();
          reject(new Error(`Plugin ${name} loaded but did not register ${kind}`));
        }
      }).catch((error) => {
        off();
        reject(error);
      });
    });
    this.pendingPlugins.set(plugin.path, loading);
    try {
      return await loading;
    } finally {
      this.pendingPlugins.delete(plugin.path);
    }
  }
}

module.exports = { KindRegistry };
