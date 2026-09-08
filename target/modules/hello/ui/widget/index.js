/* global LetcBox */
class HelloWidget extends LetcBox {
  initialize(options = {}) {
    require("./skin.scss");
    super.initialize(options);
    this.model.atLeast({ status: "ready", title: "Drumee kernel" });
    this.declareHandlers();
    this._unbindPush = this.runtime && this.runtime.Websocket && this.runtime.Websocket.bindEvent("hello.push", (data) => this.onPush(data));
  }

  onDomRefresh() {
    this.feed(require("./skeleton")(this));
    if (!this._pingPromise) this._pingPromise = this.ping();
  }

  async ping() {
    try {
      const response = await this.postService("hello.ping", {});
      this.mset("status", response.message);
      this.feed(require("./skeleton")(this));
      this.trigger("hello:ping", response);
      return response;
    } catch (error) {
      this.mset("status", "service unavailable");
      this.feed(require("./skeleton")(this));
      this.trigger("hello:error", error);
      throw error;
    }
  }

  async push() {
    return this.postService("hello.push", {});
  }

  onPush(data = {}) {
    this.mset("status", data.message || "Hello over WebSocket");
    this.feed(require("./skeleton")(this));
    this.trigger("hello:push", data);
  }

  onBeforeDestroy() {
    if (typeof this._unbindPush === "function") this._unbindPush();
    this._unbindPush = null;
  }
}

module.exports = HelloWidget;
