class Phase26Widget extends LetcBox {
  initialize(options = {}) {
    require("./skin");
    super.initialize(options);
    this.declareHandlers();
  }

  onDomRefresh() {
    this.feed(require("./skeleton")(this));
  }
}

module.exports = Phase26Widget;
