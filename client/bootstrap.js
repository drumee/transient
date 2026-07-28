// ================================  *
//   Copyright Xialia.com  2013-2017 *
//   FILE  : src/service/yp
//   TYPE  : module
// ================================  *

const { isEmpty, isObject, values, template } = require('lodash');
const { Attr } = require('@drumee/server-essentials');

const { RuntimeEnv } = require('@drumee/server-core');
const pageLanguage = require('./page-language');

//########################################
class BootstrapPage extends RuntimeEnv {
  initialize(opt) {
    this.user = opt.user;
    this.hub = opt.hub;
    this.input = opt.input;
    this.yp = opt.yp;
  }

  /**
   * 
   */
  async htmlContent(loader, md) {
    const { readFileSync } = require('fs');
    const { resolve } = require("path");

    const TPL_BASE = "templates";
    const tpl = resolve(__dirname, TPL_BASE, 'index.tpl');;
    // Deterministic page language: stored profile choice or English — see
    // client/page-language.js (no Accept-Language auto-adoption).
    const lang = pageLanguage(this);
    let data = await this.getRuntimeEnv();
    data.language = lang;
    if ((!isEmpty(md.description)) && isObject(md.description)) {
      data.description = md.description[lang] || values(description)[0] || data.description;
    }

    if ((!isEmpty(md.title)) && isObject(md.title)) {
      data.title = md.title[lang] || md.title.en || data.title;
    }

    data = { ...this.hub.toJSON(), ...data, loader };
    if(data.ws_port && !/^:/.test(data.ws_port)){
      data.ws_port = `:${data.ws_port}`
    }
    let auth = this.input.authorization();
    data.keysel = auth.keysel ||  Attr.regsid;
    this.output.setAuthorization(auth);
    let html = readFileSync(tpl);
    html = String(html).trim().toString();
    data.fonts_links = await this.yp.await_proc(`${this.hub.get(Attr.db_name)}.get_fonts_links`);
    data.fonts_faces = await this.yp.await_proc(`${this.hub.get(Attr.db_name)}.get_fonts_faces`);
    return template(html)(data, { imports: { page: this } })
  }
}

module.exports = BootstrapPage;
