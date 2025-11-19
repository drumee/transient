


class __button_switch extends LetcBox {
  /**
   * 
   * @param {*} opt 
   * @returns 
   */
  initialize(opt) {
    super.initialize(opt);
    this._id = _.uniqueId('switch-');
    this.model.set(_a.widgetId, this._id);

    this.model.atLeast({
      innerClass : _K.char.empty,
      label      : _K.char.empty,
      flow       : _a.x,
      values     : [0,1]});
    this.declareHandlers();
  }


  /**
   * 
   * @returns 
   */ 
  onDomRefresh() {
    this.feed(require("./skeleton")(this));  
    const sw = this.children.findByIndex(1);
    sw.setState(this.mget(_a.state));
    this.setState(this.mget(_a.state));
  }

  /**
   * 
   * @param {*} cmd 
   * @returns 
   */
  onUiEvent(cmd){
    let i;
    const values = this.mget(_a.values);
    if (cmd.get(_a.service) === _a.toggle) {
      i = this.mget(_a.state)^1;
    } else {
      i = cmd.mget(_a.index);
    }
    this.setState(i);
    this.model.set({ 
      state : i,
      value : values[i]});
    const sw0 = this.children.findByIndex(0);
    sw0.setState(i);
    const sw2 = this.children.findByIndex(2);
    sw2.setState(i);
    const sw = this.children.findByIndex(1);
    sw.setState(i);
    this.triggerHandlers();
  }
}

module.exports = __button_switch;
