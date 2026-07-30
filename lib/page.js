const { isEmpty, isObject, values, template } = require('lodash');
const { Attr } = require('@drumee/server-essentials');

const RuntimeEnv = require('./runtimeEnv');

//########################################
class Page extends RuntimeEnv {
  initialize(opt) {
    this.user = opt.user;
    this.hub = opt.hub;
    this.input = opt.input;
    this.yp = opt.yp;
    this.page = opt.page;
  }

  /**
   * 
   */
  async htmlContent(loader, md, template_file) {
    const { readFileSync } = require('fs');
    const { resolve } = require("path");

    let tpl;
    if(!template_file){
      tpl = resolve(__dirname, "templates", 'index.tpl');
    }else{
      if(/^\//.test(template_file)){
        tpl = template_file;
      }else{
        resolve(__dirname, "templates", template_file );
      }
    }
    const lang = this.user.language() || this.input.app_language();
    let data = await this.getRuntimeEnv();
    if ((!isEmpty(md.description)) && isObject(md.description)) {
      data.description = md.description[lang] || values(description)[0] || data.description;
    }

    if ((!isEmpty(md.title)) && isObject(md.title)) {
      data.title = md.title[lang] || md.title.en || data.title;
    }

    data = { ...this.hub.toJSON(), ...data, loader };
    let auth = this.input.authorization();
    data.keysel = auth.keysel ||  Attr.regsid;
    this.output.setAuthorization(auth);
    let html = readFileSync(tpl);
    html = String(html).trim().toString();
    try{
      data.fonts_links = await this.yp.await_proc(`${this.hub.get(Attr.db_name)}.get_fonts_links`);
      data.fonts_faces = await this.yp.await_proc(`${this.hub.get(Attr.db_name)}.get_fonts_faces`);  
    }catch(e){
    }
    return template(html)(data, { imports: { page: this } })
  }
}

module.exports = Page;
