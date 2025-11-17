// service/signup.js

const { Cache, Attr, sysEnv, Messenger, uniqueId } = require('@drumee/server-essentials');
const { resolve } = require('path');
const Loby = require("./lib/loby")

class Signup extends Loby {

  initialize(opt) {
    super.initialize(opt);
    this.conf = Cache.getSysConf('ob_conf');
    let { db_name } = JSON.parse(this.conf);
    this.app_db = db_name;
  }

  /**
   * 
   */
  async get_info() {
    const sessionId = this.input.sid();
    let sql = `SELECT email, otp FROM ${this.app_db}.signup_data WHERE session_id=?`
    let { email } = await this.db.await_query(sql, sessionId) || {};
    this.output.data({ email });
  }

  /**
   * 
   */
  async save_info() {
    const sessionId = this.input.sid();
    const email = this.input.need(Attr.email);
    let user = await this.yp.await_proc("drumate_exists", email);
    if (user && user.email) {
      return this.output.data({ status: "user_exists", email });
    }
    // Call SP
    let status = await this.db.await_proc(
      `${this.app_db}.save_signup_info`,
      sessionId, email
    );
    const ulang = this.input.ua_language();
    let lex = Cache.lex(ulang)
    const { main_domain } = sysEnv();
    let data = {
      heading: lex._your_account_is_all_set,
      message: lex._your_otp_is_x.format(status.otp),
      link: `https://${main_domain}/-/`,
      signature: lex._drumee_team,
      reminder: lex._copyright.format(`${new Date().getFullYear()}`),
      hello: lex._hello_x.format(email || ""),
    }
    const msg = new Messenger({
      subject: lex._welcome_on_drumee,
      recipient: email,
      handler: this.exception.email,
    });

    let sent = 0;
    try {
      let tpl = resolve(__dirname, "./templates/otp.html")
      let html = msg.renderFrom(tpl, data)
      await msg.send({ html });
      sent = 1;
    } catch (e) {
      this.warn(e)
    }
    this.output.data({ status: 'ok', sent, email });
  }

  /**
   * 
   */
  async create_account() {
    const email = this.input.need(Attr.email);
    const password = this.input.need(Attr.password);
    let user = await this.yp.await_proc("drumate_exists", email);
    if (user && user.email) {
      return this.output.data({ status: "user_exists", email });
    }
    let data = await this.db.await_proc(`${this.app_db}.get_signup_info`, { email }) || {};
    let args = { email, password };
    if (data.user && data.user.email && data.firstname) {
      args = { ...data.user, password }
    }
    this.debug("AAA:103", args)
    let status = await super.create_account(args)
    this.debug("AAA:104", status)
    let res = await this.session.signin({ username: email, email, password });
    this.debug("AAA:107", res)
    res.status = "ok";
    if (res.user && res.user.firstname) {
      status.completed = 1
    } else {
      status.completed = 0
    }
    this.output.data(res);
  }
}

module.exports = Signup;