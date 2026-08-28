const { Entity } = require('@drumee/server-core');
const { Cache, Attr, Messenger, sysEnv, toArray } = require('@drumee/server-essentials');
const { join, resolve } = require('path');
const { existsSync, statSync, rmSync } = require("fs");
const { readFileSync } = require("jsonfile");
const { readdir } = require("fs/promises");
class Analytics extends Entity {

  /**
   *
   */
  async update_feed() {
    const { data_dir } = sysEnv();
    const dir = join(data_dir, 'tmp', 'analytics')
    if (!existsSync(dir)) {
      this.warn(`Feeding dir not found`, dir)
      return;
    }

    let sql = `REPLACE INTO trafic SELECT NULL, ?, ?, ?, ?`;
    try {
      const files = await readdir(dir);
      for (const file of files) {
        let realpath = resolve(dir, file);
        let stat = statSync(realpath);
        if (stat.isDirectory()) continue;
        if (!/[0-9]+\.json$/.test(file)) continue;
        let data = readFileSync(realpath);
        for (let r of data) {
          await this.db.await_query(sql, r.timestamp, r.remoteAddr, r.url, r.referrer);
        }
        rmSync(realpath)
      }
    } catch (err) {
      console.trace();
      console.error(err);
    }
  };

  /**
   * 
   */
  async get_env() {
    const env = Cache.getSysConf("analytics");
    await this.update_feed()
    this.output.data(JSON.parse(env));
  }

  /**
   * 
   */
  async users_history() {
    const type = this.input.get(Attr.type) || Attr.day;
    const start = this.input.get(Attr.start);
    const end = this.input.get(Attr.end);
    const interval = this.input.get('interval');
    let data = await this.db.await_proc('users_history', { type, start, end, interval })
    this.output.list(data);
  }

  /**
   * 
   */
  async users_list() {
    const page = this.input.get(Attr.page);
    let data = await this.db.await_proc('users_list', { page })
    this.output.list(data);
  }


  /**
   * 
   */
  async emailing() {
    const message = this.input.get("message");
    const subject = this.input.get("subject");
    let recipients = this.input.get("recipients");
    const { main_domain } = sysEnv();
    const ulang = this.input.ua_language();
    let lex = Cache.lex(ulang);
    if (recipients == "all") {
      recipients = []
      let dest = await this.yp.await_query('SELECT email FROM drumate WHERE JSON_VALUE(profile, "$.category")=?', "trial")
      for (let d of toArray(dest)) {
        if(d.email.isEmail()) recipients.push(d.email)
      }
    }
    let data = {
      heading: subject,
      message,
      workspace: lex._discover_drumee_desk,
      link: `https://${main_domain}/-/`,
      signature: lex._drumee_team,
      reminder: lex._copyright.format(`${new Date().getFullYear()}`),
      hello: lex._hello_x.format(""),
    }
    const msg = new Messenger({
      subject,
      recipient: recipients,
      handler: this.exception.email,
    });
    let tpl = resolve(__dirname, "./templates/news-letter.html")
    let html = msg.renderFrom(tpl, data)
    let { recipient, error } = await msg.send({ html });
    this.debug("SENT", { error })
    this.output.data({ recipient, error });
  }

  /**
   * 
   */
  async trafic_history() {
    const type = this.input.get(Attr.type) || Attr.day;
    const start = this.input.get(Attr.start);
    const url = this.input.get('url');
    const referrer = this.input.get('referrer');
    const end = this.input.get(Attr.end);
    const interval = this.input.get('interval');
    this.debug("ZZZ:119", { referrer, url, type, start, end, interval })
    let data = await this.db.await_proc('trafic_history', { referrer, url, type, start, end, interval })
    this.output.list(data);
  }
}


module.exports = Analytics;