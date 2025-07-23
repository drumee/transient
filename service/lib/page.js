const { RuntimeEnv } = require('@drumee/server-core');
const { sysEnv } = require("@drumee/server-essentials");
const { main_domain } = sysEnv();
const { resolve } = require("path");
const { readFileSync } = require("fs");
const { template } = require("lodash");
const TPL_BASE = "templates";

class SandboxPage extends RuntimeEnv {

  /**
   * 
   */
  _write(content){
    this.output.set_header(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    this.output.set_header("Access-Control-Allow-Origin", `*.${main_domain}`);
    this.output.set_header("Pragma", "no-cache");
    this.output.set_header("X-Celia", "81680085");
    this.output.set_header("Expires", "0");
    this.output.html(content);
    this.stop();
  }
  /**
   *
   */
  async main(user) {
    const tpl = resolve(__dirname, TPL_BASE, 'index.tpl');;
    const { org_name, icon } = this.hub.toJSON();
    let env = await this.getSettings();
    this.debug("AAAA:33", env)
    let data = { ...env, ...user };
    data.description = `Drumee Team Live Demo ${org_name}`;
    data.keywords = `Drumee Team Live Demo`;
    data.icon = icon;
    data.keysel = user.id;
    data.uid = user.id;
    data.user_domain = user.domain;
    data.main_domain = main_domain;
    let html = readFileSync(tpl);
    html = String(html).trim().toString();
    const content = template(html)(data, { imports: { page: this } });
    this._write(content);
  }

}

module.exports = SandboxPage;
