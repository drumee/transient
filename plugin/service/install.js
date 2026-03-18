
const { Entity } = require('@drumee/server-core');

const {
  Cache, sysEnv
} = require('@drumee/server-essentials');
class Repo extends Entity {

  /**
   * To provide shell script required to bootstrap installation
   */
  async debian() {

    let failed = (msg) => {
      let text = [
        `echo Installation has failed, due to ${msg}`,
        `exit 1`
      ]
      this.output.text(text.join('\n') + '\n');
    }


    let app_host = Cache.getSysConf('application_host');
    let app_path = Cache.getSysConf('application_path');
    let host = await this.yp.await_proc('get_hub', app_host);
    if (!host) {
      return failed(`server error (APPLICATION_HOST_NOT_FOUND)`);
    }

    let node = await this.yp.await_proc(`${host.db_name}.mfs_get_by_path`, app_path);
    if (!node) {
      return failed(`server error (APPLICATION_PATH_NOT_FOUND)`);
    }

    let data = await this.yp.await_proc(`${host.db_name}.mfs_show_node_by`,
      node.id, this.uid, 'rank', 'asc', 1);
    // this.debug("AAA:203", app_host, app_path, host, node, data);

    let items = [null, null, null, null, null];
    for (let item of data) {
      if (item.ext == 'deb') {
        let file = `${item.filename}.${item.ext}`;
        if (/infra/i.test(item.filename)) items[0] = file;
        if (/schemas/i.test(item.filename)) items[1] = file;
        if (/static/i.test(item.filename)) items[2] = file;
        if (/server/i.test(item.filename)) items[3] = file;
        if (/ui/i.test(item.filename)) items[4] = file;
      }
    }
    // let jitsi_packages = [items[0], items[2]]
    let script = [
      `export DRUMEE_PACKAGES="${items.join(' ')}";`,
      // `export DRUMEE_JITSI="${jitsi_packages.join(' ')}";`,
      `export DRUMEE_PACKAGES_BASE="https://${app_host}/${app_path}";`,
    ]
    this.output.text(script.join('\n') + '\n');
  }

  /**
 * Callback upon installation completed
 * input :
 *   - reset_link
 *   - email
 *   - key
 *   - devices 
 * @returns 
 */
  async completed() {
    this.debug("AAA:405 install_completed");
    let reset_link = this.input.need('reset_link');
    let email = this.input.need(_a.email);

    const lang = this.input.ua_language();
    let lex = Cache.lex(lang);

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

  async failed(email, reason, key) {
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


module.exports = Repo;