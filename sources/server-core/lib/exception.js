const { isString } = require("lodash");
const {
  DrumeeCache, Logger, Constants, Events
} = require("@drumee/server-essentials");
const { ERROR } = Events;
const {
  RESPONSE_CODE,
  FAILED_SENDING_EMAIL,
} = Constants;


class __core_exception extends Logger { //Db

  constructor(...args) {
    super(...args);
    this.initialize = this.initialize.bind(this);
    this._send = this._send.bind(this);
    this.server = this.server.bind(this);
    this.user = this.user.bind(this);
    this.email = this.email.bind(this);
    this.bad_request = this.bad_request.bind(this);
    this.reject = this.reject.bind(this);
    this.unauthorized = this.unauthorized.bind(this);
    this.forbiden = this.forbiden.bind(this);
    this.not_found = this.not_found.bind(this);
    this.precondition = this.precondition.bind(this);
    this.fatal = this.fatal.bind(this);
    this.info = this.info.bind(this);
  }

  initialize(opt) {
    this.output = opt.output;
  }

  /**
   * 
   * @param {*} data 
   */
  _send(data) {
    if (this.get(RESPONSE_CODE)) {
      data.error_code = this.get(RESPONSE_CODE);
      data.status = data.error_code;
      this.output.set(RESPONSE_CODE, data.status);
    }
    this.trigger(ERROR);
    this.output.add_data(data);
    this.output.flush();
  }

  /**
   * 
   * @param {*} text 
   * @param {*} code 
   */
  server(args) {
    let error, reason, service;
    let output = { error: "SERVER_FAULT" };
    if (isString(args)) {
      output.error = DrumeeCache.message(args, this._lang);
      output.reason = DrumeeCache.message('_internal_error', this._lang);
    } else {
      if (args.error) {
        output.error = DrumeeCache.message(args.error, this._lang);
      }
      if (args.code) {
        output.reason = args.code
      }
      if (args.service) {
        output.service = args.service
      }
    }
    this.warn("Server fault:", output)
    this.set(RESPONSE_CODE, 500);
    this._send(output);
  }

  /**
   * 
   * @param {*} text 
   * @param {*} data 
   */
  user(text, data) {
    this.set(RESPONSE_CODE, 400);
    this._send({ reason: data, error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   */
  email(text) {
    if ((this._errors == null)) {
      this._errors = [];
    }
    if (text != null) {
      this._errors.push(DrumeeCache.message(text, this._lang));
    }
    this.set(RESPONSE_CODE, 500);
    this._send({
      error: FAILED_SENDING_EMAIL,
      stack: this._errors
    });
  }

  /**
   * 
   * @param {*} e 
   */
  set_session_language(e) {
    this._lang = e.user.language() || e.input.app_language();
  }

  /**
   * 
   * @param {*} text 
   */
  bad_request(text) {
    this.set(RESPONSE_CODE, 400);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   */
  reject(text) {
    this.set(RESPONSE_CODE, 405);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   */
  unauthorized(text) {
    this.set(RESPONSE_CODE, 401);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   * @param {*} reason 
   */
  forbiden(text = '_access_denied', reason) {
    this.set(RESPONSE_CODE, 403);
    let opt = { error: DrumeeCache.message(text, this._lang) }
    if (reason) opt.reason = DrumeeCache.message(reason, this._lang);
    this._send(opt);
  }

  /**
   * 
   * @param {*} text 
   */
  not_found(text) {
    this.set(RESPONSE_CODE, 404);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   * @param {*} ctx 
   */
  precondition(text, ctx) {
    this.set(RESPONSE_CODE, 412);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }

  /**
   * 
   * @param {*} text 
   */
  fatal(text) {
    this.set(RESPONSE_CODE, 512);
    this._send({ error: DrumeeCache.message(text, this._lang) });
  }
}



module.exports = __core_exception;
