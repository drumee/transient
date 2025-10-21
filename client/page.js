const { RuntimeEnv } = require('@drumee/server-core');

const { resolve, join } = require("path");
const { readFileSync, existsSync } = require("fs");
const { readFileSync: readJsonSync } = require("jsonfile");
const {
  DrumeeCache, sysEnv, Permission, Attr, Events, nullValue, getUiInfo, toArray
} = require("@drumee/server-essentials/lib");
const { END, GRANTED } = Events;
const { READ } = Permission;
const { main_domain, endpoint_path, server_dir } = sysEnv();

const TPL_BASE = "templates";
class MainPage extends RuntimeEnv {
  /**
   * Propert isServingPage tells to Acl to grant access, since we
   * are serving only frontend code.
   * In case there a homepage defined, Acl shall be done locally
   * @param {*} opt 
   */
  initialize(opt) {
    this.isServingPage = 1;
    let permission = { src: READ };
    super.initialize({ ...opt, permission });
    this.on(GRANTED, async () => {
      await this.start({ access: GRANTED });
    });

  }

  /**
   *
   */
  static hash() {
    let { hash } = getUiInfo();
    if (hash) {
      console.log(`Page hash=${hash}`);
    }
    return hash;
  }

  /**
   *
   */
  async shouldSendHomepage(data) {
    if (!/^\/.*(.+)\.(.+)/.test(data.homepage)) {
      return false;
    }

    let node = await this.yp.await_proc(
      `${data.db_name}.mfs_access_node`,
      this.uid, resolve('/', data.homepage)
    );
    if (node && (node.permission)) {
      let file = resolve(node.home_dir, node.id, `orig.${node.ext}`);
      let html = readFileSync(file);
      this.output.set_header(
        "Access-Control-Allow-Origin",
        `*.${main_domain}`
      );
      html = html.toString();
      this.output.html(html);
      this.session.trigger(END);
      return true;
    }
    return false;
  }

  /**
   * Temp patch: remove legacy cookie
   * @param {*} opt 
   */
  clearLegacyCookie(host, keysel) {
    //this.debug("AAA:84", { host, keysel }, this.input.cookie(keysel))
    if (this.input.cookie(keysel)) {
      this.output.clearAuthorization({ host, keysel });
    }
  }

  /**
  * 
  */
  refreshAuthorization(data) {
    let { id, keysel } = this.input.authorization();
    let host = main_domain;
    if (/^(dmz|share)$/.test(data.area)) {
      data.icon = `${endpoint_path}/avatar/${data.owner_id}?type=vignette`;
      keysel = this.hub.get(Attr.id);
      host = this.input.host();
    }

    if (nullValue(keysel)) keysel = Attr.regsid;
    let args = {
      id,
      keysel,
      host,
    }
    this.output.setAuthorization(args);
    this.clearLegacyCookie(host, 'xia_sid');
    this.clearLegacyCookie(host, 'guest_sid');
    this.clearLegacyCookie(host, 'session_type');
    return keysel;
  }

  /**
   * 
   */
  getCustomPlugins() {
    /** Get plugins path from hub settings */
    let { plugins } = this.hub.get(Attr.settings) || {};
    if (!plugins) return null;
    let Plugins = []
    /** Read plugins settings the path */
    for (let [path, entry] of Object.entries(plugins)) {
      let index = join(path, 'index.json');
      if (!existsSync(index)) continue;
      let info = readJsonSync(index)
      if (!info || !info.location) continue;
      if (!/.+\/$/.test(info.location)) {
        info.location = `${info.location}/`;
      } else {
        info.location = info.location.replace(/\/+$/, '/')
      }
      Plugins.push({ ...info, entry: `${entry}-${info.hash}.js` })
    }
    if (Plugins.length) {
      return Plugins
    }
    return null;
  }

  /**
   *
   */
  async start(opt) {
    const lang = this.user.language() || this.input.app_language();
    let lex = DrumeeCache.lex(lang);
    const env = await this.getRuntimeEnv();
    let data = { ...lex, ...this.hub.toJSON(), ...env, ...opt };
    if (data.ws_port && !/^:/.test(data.ws_port)) {
      data.ws_port = `:${data.ws_port}`
    }

    if (!data.protocol) {
      data.protocol = 'https';
      data.ws_protocol = 'wss';
      data.ws_port = '';
    }
    if (data.localhost == null) data.localhost = 0;

    let sent = await this.shouldSendHomepage(data);
    await this.session.log_service();
    if (sent) {
      return;
    }
    let plugins = this.getCustomPlugins();
    if (plugins) {
      data.plugins = plugins;
    } else if (data.plugins && data.plugins.location) {
      data.plugins = toArray(data.plugins)
    } else {
      data.plugins = []
    }
    data.keysel = this.refreshAuthorization(data);
    let db = this.hub.get(Attr.db_name);
    data.fonts_links = await this.yp.await_proc(`${db}.get_fonts_links`);
    data.fonts_faces = await this.yp.await_proc(`${db}.get_fonts_faces`);
    data.description = data.description || data.title;
    this.output.set_header(
      "Cache-Control",
      "no-cache, no-store, must-revalidate"
    );
    this.output.set_header("Access-Control-Allow-Origin", `*.${main_domain}`);
    this.output.set_header("Pragma", "no-cache");
    this.output.set_header("Expires", "0");
    this.set({ data });
    if (this.input.get('debug-ui')) {
      data.debugUi = 1;
    }
    const template_dir = resolve(__dirname, TPL_BASE);
    let content = this.getRender(template_dir, "index.tpl")(data);
    this.output.html(content);
    this.session.trigger(END);
  }
}

module.exports = MainPage;
