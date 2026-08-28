
const { toArray } = require('@drumee/server-essentials').utils;
const { resolve } = require('path');
const { RedisStore, Attr, sysEnv } = require('@drumee/server-essentials');


const Acl = require('./acl');
class __entity extends Acl {


  /**
   * 
   * @param {*} opt 
   */
  async initialize(opt) {
    if ((opt.session == null)) {
      throw { message: 'NO_SESSION_DATA' };
    }
    if ((opt.permission == null)) {
      throw { message: 'PERMISSION_REQUIRED' };
    }
    super.initialize(opt);
    const session = opt.session;
    this.session = session.bind(this);
    this.hub = session.hub.bind(this);
    this.user = session.user.bind(this);
    this.input = session.input.bind(this);
    this.output = session.output.bind(this);
  }

  /**
   * 
   * @param {*} nop 
   * @returns 
   */
  _done(nop) {
    if (nop) {
      return;
    }
    this.trigger(this.before_granting + '-done');
  }

  /**
   * 
   * @returns 
   */
  user_id() {
    return this.user.get(Attr.id);
  }

  /**
   * 
   * @returns 
   */
  client_language() {
    const lang = this.user.language() || this.input.app_language() || 'en';
    return lang;
  }

  /**
   * To notify all connections open by 
   * all online users of a specific hub
   * @param {*} hub_id 
   * @param {*} data 
   * @param {*} opt 
   * @param {*} exclude 
   * @returns 
   */
  async notify_hub(hub_id, data, opt, exclude) {
    let recipients = [];
    if (exclude) {
      recipients = await this.yp.await_proc('entity_sockets', { hub_id, exclude });
    } else {
      recipients = await this.yp.await_proc('entity_sockets', { hub_id, exclude });
    }
    await RedisStore.sendData(this.payload(data, opt), recipients);
    return data;
  }

  /**
   * 
   * @param {*} uid 
   * @param {*} data 
   */
  async notify_user(uid, data) {
    let recipients = await this.yp.await_proc('user_sockets', uid);
    await RedisStore.sendData(this.payload(data), recipients);
  }


  /**
   * 
   * @param {*} opt 
   */
  async notify_by_email(opt = {}) {
    const lang = this.user.language();
    const username = this.user.get('fullname');
    const e = process.env;
    let cmd = resolve(e.server_home, 'offline', 'notification', 'meeting-notification.js');
    const { spawn } = require('child_process');
    let recipient = opt.recipient
    let subject = opt.subject
    let template = opt.template
    let title = opt.title
    let date = opt.date
    let message = opt.message
    let headline = opt.headline
    let link = opt.link
    spawn(cmd, [lang, username, recipient, subject, template, title, date, message, headline, link], { detached: true });
  }



  /**
* 
* @param {*} status 
* @returns 
*/
  async pushUserOnlineStatus() {
    let rows = await this.yp.await_proc("drumate_online_state", this.uid);
    rows = toArray(rows);
    let payload = {
      options: {
        service: "user.connection_status",
        keys: ["user_id"],
      },
    };
    for (let row of rows) {
      payload.socket_id = row.id;
      payload.model = { user_id: row.my_id, status: row.my_state };
      this.silly("AAA:312 -- pushUserOnlineStatus", { payload, row });
      await RedisStore.sendData(payload, row.id);
    }
    return rows;
  }
}

module.exports = __entity;
