// ================================  *
//   Copyright Xialia.com  2013-2017 *
//   FILE  : src/service/yp
//   TYPE  : module
// ================================  *

const { Entity } = require('@drumee/server-core');

const {
  Cache, toArray, Attr, RedisStore, sysEnv
} = require('@drumee/server-essentials');
const { resolve } = require('path');
class Endpoint extends Entity {


    /**
   * Callback upon installation completed
   * input :
   *   - reset_link
   *   - email
   *   - key
   *   - devices 
   * @returns 
   */
    async install_completed() {
      console.log("AAA:405 install_completed");
      let key = this.input.need(_a.key)
      let reset_link = this.input.need('reset_link');
      let devices = this.input.need('devices');
      // let publicKey = this.input.need('publicKey');
      let email = this.input.need(_a.email);
      let licence = await this.licence.await_proc(`licence_get`, key);
  
      const lang = this.input.ua_language();
      let lex = Cache.lex(lang);
  
      if (isEmpty(licence)) {
        await this.installation_failed(email, 'Invalid licence key', key);
        return
      }
  
      await this.licence.await_proc(`licence_set_devices`, key, devices);
      // await this.licence.await_proc(`yp.pod_register`, licence.domain, publicKey);
  
      let message = Cache.message('_licence_send_install_completed_msg', lang);
      const subject = Cache.message('_licence_send_install_completed_sub', lang);
  
      let link = this.getInstallDocLink(lang);
  
      const msg = new Messenger({
        template: "butler/licence_install_completed",
        subject: subject,
        recipient: email,
        lex,
        data: {
          message,
          recipient: email,
          reset_link: reset_link,
          doc_link: link
        },
      });
  
      await msg.send();
      this.output.data(licence);
    }
  
    /**
    * input :
     *   - email
     *   - reason
     *   - key
     * @returns request, status
     */
  
    async installation_failed(email, reason, key) {
      const lang = this.input.ua_language();
      let lex = Cache.lex(lang);
      let message = Cache.message('_licence_send_installation_failed_msg', lang);
      const subject = Cache.message('_licence_send_installation_failed_sub', lang);
  
      const msg = new Messenger({
        template: "butler/licence_installation_failed",
        subject: subject,
        recipient: email,
        lex,
        data: {
          message,
          recipient: email,
          reason: reason,
        },
      });
  
      await msg.send();
      this.output.text(reason);
    }

}


module.exports = Endpoint;