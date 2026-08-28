const STRING = "string";
const OBJECT = "object";
const NUMBER = "number";

class __data {
  constructor(data) {
    if (data.type === "utf8" && data.utf8Data) {
      this.rawdata = data.utf8Data;
    } else {
      this.rawdata = data;
    }
    this.isData = true;
    if (typeof this.rawdata !== STRING) return;
    try {
      if (this.rawdata.lenght > 500000) {
        this.rawdata = { error: "DATA_TOO_BIG" };
        return;
      }
      this.rawdata = JSON.parse(this.rawdata);
    } catch (e) {
      return;
    }
  }

  service() {
    if (this.__service) return this.__service;
    switch (typeof this.rawdata) {
      case STRING:
        this.__service = this.rawdata;
        break;
      case OBJECT:
        if (this.rawdata.length) {
          this.__service = this.rawdata[0];
        } else {
          this.__service = this.rawdata.service;
        }
        break;
      default:
        this.__service = null;
    }
    try {
      const m = this.__service.split(".");
      this.__module = m[0];
      this.__method = m[1];
    } catch (e) {
      this.__module = "no-module";
      this.__method = "no-method";
    }
    return this.__service;
  }

  moduleName() {
    if (!this.__module) this.service();
    return this.__module;
  }

  methodName() {
    if (!this.__method) this.service();
    return this.__method;
  }

  recipient(expect) {
    switch (typeof this.rawdata) {
      case STRING:
        return this.rawdata;
      case OBJECT:
        if (this.rawdata.length) {
          if (typeof this.rawdata[1] === expect) {
            return this.rawdata[1];
          }
          const d = new __data(this.rawdata[1]);
          return d.recipient(expect);
        }
        return this.rawdata.recipient;
      default:
        return null;
    }
  }

  data() {
    let d;
    switch (typeof this.rawdata) {
      case STRING:
        return this.rawdata;

      case OBJECT:
        let l = this.rawdata.length;
        switch (l) {
          case 1:
            d = new __data(this.rawdata[l - 1]);
            return d.data();

          case 2:
          case 3:
            return this.rawdata[l - 1];

          case null:
          case undefined:
            return this.rawdata.data || this.rawdata;

          default:
            return null;
        }
    }
  }

  /**
   *
   * @param {*} name
   * @returns
   */
  get(name) {
    let d = this.data() || {};
    const { isEmpty, isArray } = require("lodash");

    if (typeof name === NUMBER && typeof d === STRING) {
      if (this.rawdata.length) {
        return this.rawdata[name];
      }
    }
    //console.log("RRRRRRRRRRRRRR 113", name, d, d[name]);
    if (!isEmpty(d[name])) {
      return d[name];
    }
    //console.log("RRRRRRRRRRRRRR 115", name, d);
    if (!isArray(d)) {
      return this.rawdata[name];
    }
    for (let i of d) {
      //console.log("RRRRRRRRRRRRRR 117", name, i);
      if (!isEmpty(i[name])) {
        return i[name];
      }
    }
    // console.log("RRRRRRRRRRRRRR 120", name, this.rawdata);
    // return this.rawdata[name];
  }
}

module.exports = __data;
