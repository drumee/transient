/* global LetcBox */
class HelloWidget extends LetcBox {
  initialize(options = {}) {
    require("./skin.scss");
    super.initialize(options);
    this.model.atLeast({ status: "ready", title: "Drumee kernel" });
    this.declareHandlers();
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
}

module.exports = HelloWidget;
