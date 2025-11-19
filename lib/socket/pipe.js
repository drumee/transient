const { timestamp } = require("../utils")

class socket_pipe extends WPP.Socket {
  constructor(...args) {
    this._makeData = this._makeData.bind(this);
    this.slurp = this.slurp.bind(this);
    super(...args);
  }

  url() {
    return this._url || '?';
  }


  _makeData() {
    const data = this.toJSON();
    const service = data.service || data.api || _a.local;
    if (_.isString(data.api)) {
      delete data.api;
      delete data.m;
    }
    //data.service  = service
    if (service === _a.local) {
      data.service = service;
    }
    data.lang      = Visitor.language();
    data.pagelang  = Visitor.pagelang();
    data.device    = Visitor.device();
    //@clear()
    this.set(data);
    return data;
  }

  validate(args) {
    if ((this.get(_a.service) == null)) {
      this.warn("NO API");
      return "no api";
    }
    return null;
  }

  slurp(filename) {
    this._url = filename;
    const options = this._makeOptions();
    options.data = {};
    if (localStorage.no_cache || ((this.params != null) && !this.params.cache)) {
      options.data.nocache = timestamp();
    }
    options.data.lang      = Visitor.language();
    options.data.pagelang  = Visitor.pagelang();
    options.data.device    = Visitor.device();
    this.fetch(options);
    return $.when(this._defer).done(this.__dispatchRest);
  }
}
    
module.exports = socket_pipe;
