const { LetcBox } = require("..");
class __button_switcher extends LetcBox {

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
    return this.declareHandlers();
  }


  /**
   * 
   * @returns 
   */
  onDomRefresh() {
    return this.feed(require("./skeleton")(this));  
  }


  /**
   * 
   * @param {*} cmd 
   */
  onUiEvent(cmd){
    const values = this.mget(_a.values);
    const i = cmd.mget(_a.index);
    this.model.set({ 
      state : i,
      value : values[i]});
    this.triggerHandlers();
  }
}

module.exports = __button_switcher;
