class EventBus {
  constructor() {
    this.listeners = new Map();
  }

  on(name, listener) {
    const entries = this.listeners.get(name) || [];
    entries.push(listener);
    this.listeners.set(name, entries);
    return () => this.off(name, listener);
  }

  once(name, listener) {
    const off = this.on(name, (...args) => {
      off();
      listener(...args);
    });
    return off;
  }

  off(name, listener) {
    const entries = this.listeners.get(name) || [];
    this.listeners.set(name, entries.filter((entry) => entry !== listener));
  }

  emit(name, ...args) {
    for (const listener of [...(this.listeners.get(name) || [])]) listener(...args);
  }
}

module.exports = { EventBus };
