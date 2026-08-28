
const {
  Attr, Logger, sysEnv, Constants, Events
} = require("@drumee/server-essentials");

const { SENT } = Events;
const { RESPONSE_CODE, SESSION_TTL } = Constants;
const { isEmpty, isObject, isArray, isString } = require("lodash");
const { main_domain } = sysEnv();

//########################################
class __core_output extends Logger {
  constructor(...args) {
    super(...args);
    this.initialize = this.initialize.bind(this);
    this.write = this.write.bind(this);
    this.html = this.html.bind(this);
    this.text = this.text.bind(this);
    this.head = this.head.bind(this);
    this.data = this.data.bind(this);
    this.add_data = this.add_data.bind(this);
    this.addError = this.addError.bind(this);
    this.flush = this.flush.bind(this);
    this.cookie = this.cookie.bind(this);
    this.set_header = this.set_header.bind(this);
    this.row = this.row.bind(this);
    this.rows = this.rows.bind(this);
    this.list = this.list.bind(this);
  }

  initialize(opt) {
    this.response = opt.response;
    this.timestamp = new Date().getTime();
    this.unset("env");
    this.unset("response");
    this.unset("cache");
    this.unset("timestamp");
    this.set(RESPONSE_CODE, 200);
    this.set(Attr.status, "offline");
  }

  /**
   *
   * @returns
   */
  write(content, type, code, status) {
    if (!this.response || this.response.headersSent) {
      return;
    }
    code = code || this.get(RESPONSE_CODE);
    status = status || this.get(Attr.status);
    type = type || "text/html";
    const opt = {
      "Content-Type": type,
      "Access-Control-Allow-Origin": `*.${main_domain}`,
      "Vary": `Origin`,
    };
    this.response.statusCode = status;
    this.response.writeHead(code, opt);
    this.response.write(content);
    this.response.end();
    this.trigger(SENT);
    this.isDone = 1;
    this.response = null;
  }

  /**
   *
   */
  isDone() {
    return this.response.headersSent;
  }

  /**
   *
   */
  status(status) {
    const opt = {
      __ack__: this.get(Attr.service) || "no-service",
      __status__: this.get(Attr.status),
      data: { status },
    };

    this.write(JSON.stringify(opt), "application/json");
  }

  /**
   *
   * @param {*} html
   * @returns
   */
  html(html) {
    return this.write(html, "text/html");
  }

  /**
   *
   * @param {*} data
   * @returns
   */
  json(data) {
    if (isString(data)) {
      data = JSON.parse(data)
    }
    let clean_data = [];
    if (isArray(data)) {
      for (let item of data) {
        clean_data.push(this.sanitize(item));
      }
    } else if (isObject(data)) {
      clean_data = this.sanitize(data);
    }
    return this.write(JSON.stringify(clean_data), "application/json");
  }

  /**
   *
   * @param {*} html
   * @returns
   */
  redirect(location) {
    this.response.writeHead(302, { location })
    this.response.end();
    this.trigger(SENT);
    this.isDone = 1;
    this.response = null;
  }

  /**
   *
   * @param {*} html
   * @returns
   */
  javascript(content) {
    return this.write(content, "text/javascript");
  }

  /**
   *
   * @param {*} text
   * @param {*} type
   * @returns
   */
  text(text, type = "text/plain") {
    return this.write(text, type);
  }

  /**
   *
   * @param {*} opt
   * @param {*} code
   */
  head(opt, code) {
    if (!this.response || this.response.headersSent) {
      return;
    }
    try {
      this.response.writeHead(code, opt);
      this.response.end();
      this.trigger(SENT);
    } catch (e) {
      this.debug(e);
      this.warn("FAILED TO SEND HEADER :", opt);
      if (this.response) this.response.end();
      this.trigger(SENT);
    }
  }

  /**
   *
   * @param {*} data
   */
  data(data) {
    let rep;
    let echoId = this.get("echoId");
    let clean_data = [];
    if (isArray(data)) {
      for (let item of data) {
        if (echoId) item.echoId = echoId;
        clean_data.push(this.sanitize(item));
      }
    } else if (isObject(data)) {
      if (echoId) data.echoId = echoId;
      clean_data = this.sanitize(data);
    }
    const opt = {
      __ack__: this.get(Attr.service) || "no-service",
      __status__: this.get(Attr.status),
      __expiry__: this.get(Attr.expiry),
      __timestamp__: this.timestamp,
      data: clean_data,
    };
    if (isObject(this.get(Attr.fields))) {
      const fields = this.get(Attr.fields);
      rep = { ...fields, ...opt };
    } else {
      rep = opt;
    }
    this.write(JSON.stringify(rep), "application/json; charset=utf-8");
    return null;
  }

  /**
   *
   * @param {*} data
   */
  add_data(data) {
    const fields = { ...this.get(Attr.fields), ...data };
    this.set({ fields });
  }

  /**
   *
   * @param {*} text
   * @returns
   */
  addError(text) {
    if (this._errors == null) {
      this._errors = [];
    }
    return this._errors.push(text);
  }

  /**
   *
   * @returns
   */
  flush() {
    return this.data();
  }

  /**
   * 
   * @param {*} k 
   * @param {*} v 
   * @param {*} d 
   * @returns 
   */
  cookie(k, v, d) {
    // Too late to set cookie
    if (!this.response || this.response.headersSent) {
      return;
    }
    let domain = this.get(Attr.domain) || main_domain;
    let age = SESSION_TTL;
    let cookie_header = this.response.getHeader("Set-Cookie") || [];
    if (v === null) {
      age = 0;
      v = this.randomString()
    }
    d = d || domain;
    const p = "/";
    const val = `${k}=${v}; Max-Age=${age}; path=${p}; domain=${d}; secure; httponly; SameSite=Strict`;
    cookie_header.push(val);
    this.response.setHeader("Set-Cookie", cookie_header);
    this.response.setHeader(k, v || this.randomString());
    this.response.setHeader("Max-Age", age);
    this.response.setHeader("path", p);
    this.response.setHeader("domain", d);
  }

  /**
   * 
   * @param {*} key 
   * @param {*} value 
   * @returns 
   */
  set_header(key, value) {
    // Too late to set header
    if (this.response.headersSent) {
      return;
    }

    if (key != null && value != null) {
      this.response.setHeader(key, value);
      return;
    }

    if (this.request.headers["x-requested-with"] === "XMLHttpRequest") {
      return this.response.setHeader("Content-Type", "application/json");
    } else {
      return this.response.setHeader("Content-Type", "text/plain");
    }
  }

  /**
   *
   * @returns
   */
  info(text) {
    return this.data({ info: text });
  }

  /**
   *
   * @returns
   */
  row(data) {
    if (data) {
      return this.data(data);
    } else {
      return this.data({});
    }
  }

  /**
   *
   * @returns
   */
  rows(data) {
    if (isEmpty(data)) return this.data([]);
    if (!isArray(data)) data = [data];
    this.data(data);
  }

  /**
   *
   * @returns
   */
  list(data) {
    if (isEmpty(data)) return this.data([]);
    if (!isArray(data)) data = [data];
    this.data(data);
  }

  /**
   * 
   * @param {*} opt 
   */
  setAuthorization(opt) {
    let { keysel, host, id } = opt;
    if (keysel && id) {
      let domain = host || this.get(Attr.domain) || main_domain;
      this.cookie(keysel, id, domain);
    } else {
      this.warn(`Attempt to set authorization with invalid data value`,
        opt
      );
    }
  }


  /**
   * 
   * @param {*} opt 
   */
  clearAuthorization(opt) {
    let { keysel, host } = opt;

    if (keysel) {
      let domain = host || main_domain;
      this.cookie(keysel, null, domain);
    } else {
      this.warn(`Require key selector to clear authorization`,
        opt
      );
    }
  }
}

module.exports = __core_output;
