const { EventBus } = require("./events");

const RECONNECT_INTERVAL = 5000;
const CONNECT_TIMEOUT = 60000;
const KEEPALIVE_INTERVAL = 60000;
const KEEPALIVE_GRACE = 120000;
const MAX_RECONNECTS = 50;

function websocketUrl(globalRef, configured) {
  if (typeof configured === "function") return configured();
  if (typeof configured === "string" && configured) return configured;
  const location = globalRef && globalRef.location;
  if (!location || !location.host) throw new Error("WebSocket URL is not configured");
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  return `${protocol}//${location.host}/-/websocket/`;
}

function eventService(message) {
  if (!message || typeof message !== "object") return "";
  return message.service || (message.data && message.data.service) || "";
}

class Websocket extends EventBus {
  constructor({ global = globalThis, url, WebSocket: WebSocketConstructor, setTimeout: setTimeoutImpl, clearTimeout: clearTimeoutImpl, setInterval: setIntervalImpl, clearInterval: clearIntervalImpl, now = () => Date.now(), reconnectInterval = RECONNECT_INTERVAL, connectTimeout = CONNECT_TIMEOUT, keepaliveInterval = KEEPALIVE_INTERVAL, keepaliveGrace = KEEPALIVE_GRACE, maxReconnects = MAX_RECONNECTS } = {}) {
    super();
    this.global = global;
    this.url = url;
    this.WebSocket = WebSocketConstructor || (global && global.WebSocket);
    this.setTimeout = setTimeoutImpl || (global && global.setTimeout ? global.setTimeout.bind(global) : setTimeout);
    this.clearTimeout = clearTimeoutImpl || (global && global.clearTimeout ? global.clearTimeout.bind(global) : clearTimeout);
    this.setInterval = setIntervalImpl || (global && global.setInterval ? global.setInterval.bind(global) : setInterval);
    this.clearInterval = clearIntervalImpl || (global && global.clearInterval ? global.clearInterval.bind(global) : clearInterval);
    this.now = now;
    this.reconnectInterval = reconnectInterval;
    this.connectTimeout = connectTimeout;
    this.keepaliveInterval = keepaliveInterval;
    this.keepaliveGrace = keepaliveGrace;
    this.maxReconnects = maxReconnects;
    this.socket = null;
    this.state = "disconnected";
    this.socketId = null;
    this.reconnects = 0;
    this.lastMessage = 0;
    this.shouldReconnect = false;
    this.reconnectTimer = null;
    this.keepaliveTimer = null;
    this.connectTimer = null;
    this.pendingConnect = null;
  }

  connect() {
    if (this.state === "connected") return Promise.resolve(this);
    if (this.pendingConnect) return this.pendingConnect;
    if (typeof this.WebSocket !== "function") return Promise.reject(new Error("Browser WebSocket is not available"));
    this.shouldReconnect = true;
    this._clearReconnect();
    this._setState(this.reconnects ? "reconnecting" : "connecting");
    this.pendingConnect = new Promise((resolve, reject) => {
      let settled = false;
      const resolveConnected = () => {
        if (settled) return;
        settled = true;
        this._clearConnectTimer();
        resolve(this);
      };
      const rejectConnection = (error) => {
        if (settled) return;
        settled = true;
        this._clearConnectTimer();
        reject(error);
      };
      try {
        const socket = new this.WebSocket(websocketUrl(this.global, this.url), "service");
        this.socket = socket;
        socket.onopen = () => {
          this.lastMessage = this.now();
          this.emit("transport:open", this);
        };
        socket.onmessage = (event) => {
          const delivered = this._onMessage(event);
          if (delivered && this.state === "connected") resolveConnected();
          if (this.state === "connected" && this.socketId) resolveConnected();
        };
        socket.onerror = (event) => {
          this._setState("error");
          this.emit("error", event);
          rejectConnection(new Error("WebSocket transport error"));
        };
        socket.onclose = (event) => {
          this.socket = null;
          this.socketId = null;
          this._stopKeepalive();
          if (!this.shouldReconnect) {
            this._setState("closed");
            this.emit("close", event);
            rejectConnection(new Error("WebSocket closed before authentication"));
            return;
          }
          this._setState("reconnecting");
          this.emit("close", event);
          rejectConnection(new Error("WebSocket closed before authentication"));
          this._scheduleReconnect();
        };
        this.connectTimer = this.setTimeout(() => {
          rejectConnection(new Error("WebSocket authentication timed out"));
          try { socket.close(); } catch (_) {}
        }, this.connectTimeout);
      } catch (error) {
        this._setState("error");
        rejectConnection(error);
        this._scheduleReconnect();
      }
    }).finally(() => { this.pendingConnect = null; });
    return this.pendingConnect;
  }

  close() {
    this.shouldReconnect = false;
    this._clearReconnect();
    this._clearConnectTimer();
    this._stopKeepalive();
    const socket = this.socket;
    this.socket = null;
    if (socket && typeof socket.close === "function") socket.close();
    this._setState("closed");
  }

  bindEvent(service, listener) {
    if (typeof service !== "string" || !service || typeof listener !== "function") {
      throw new Error("bindEvent requires a service name and listener");
    }
    return this.on(`service:${service}`, listener);
  }

  unbindEvent(service, listener) {
    if (typeof service !== "string" || !service || typeof listener !== "function") return;
    this.off(`service:${service}`, listener);
  }

  upstream(service, data = {}) {
    if (typeof service !== "string" || !service) throw new Error("WebSocket upstream service is required");
    const socket = this.socket;
    if (!socket || this.state !== "connected") throw new Error("WebSocket is not connected");
    socket.send(JSON.stringify([service, data]));
  }

  _onMessage(event) {
    let message;
    try {
      message = JSON.parse(event && event.data);
    } catch (_) {
      this.emit("message:invalid", event);
      return false;
    }
    this.lastMessage = this.now();
    const service = eventService(message);
    if (!service) {
      this.emit("message:invalid", message);
      return false;
    }
    if (service === "sys.hello") {
      this.socketId = message.data && message.data.socket_id || null;
      this.reconnects = 0;
      this._setState("connected");
      this._startKeepalive();
      this.emit("connected", message.data || {});
    }
    if (service === "sys.keepalive") this.emit("keepalive", message.data || {});
    if (service === "sys.ping") this.emit("ping", message.data || {});
    const payload = message.data && message.data.service ? message.data : message;
    this.emit("message", message);
    this.emit(`service:${service}`, payload.data, payload.options || {}, payload.model, payload);
    return true;
  }

  _scheduleReconnect() {
    if (!this.shouldReconnect || this.reconnectTimer) return;
    if (this.reconnects >= this.maxReconnects) {
      this.reconnectTimer = this.setTimeout(() => {
        this.reconnectTimer = null;
        this.reconnects = 0;
        this.connect().catch(() => {});
      }, 10000);
      return;
    }
    this.reconnects++;
    this.reconnectTimer = this.setTimeout(() => {
      this.reconnectTimer = null;
      this.connect().catch(() => {});
    }, this.reconnectInterval);
  }

  _startKeepalive() {
    if (this.keepaliveTimer) return;
    this.keepaliveTimer = this.setInterval(() => {
      if (this.state !== "connected") return;
      if (this.now() - this.lastMessage > this.keepaliveGrace) {
        try { this.upstream("sys.ping", { type: "checkConnection" }); } catch (_) {}
      }
    }, this.keepaliveInterval);
  }

  _stopKeepalive() {
    if (this.keepaliveTimer) this.clearInterval(this.keepaliveTimer);
    this.keepaliveTimer = null;
  }

  _clearReconnect() {
    if (this.reconnectTimer) this.clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
  }

  _clearConnectTimer() {
    if (this.connectTimer) this.clearTimeout(this.connectTimer);
    this.connectTimer = null;
  }

  _setState(state) {
    if (this.state === state) return;
    this.state = state;
    this.emit("state", state);
  }
}

module.exports = {
  CONNECT_TIMEOUT,
  KEEPALIVE_GRACE,
  KEEPALIVE_INTERVAL,
  MAX_RECONNECTS,
  RECONNECT_INTERVAL,
  Websocket,
  eventService,
  websocketUrl
};
