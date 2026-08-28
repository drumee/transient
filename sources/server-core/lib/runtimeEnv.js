const { resolve, join } = require("path");
const Entity = require("./entity");
const { existsSync, statSync } = require('fs')
const { readFileSync } = require('jsonfile')
const DRUMEE_TITLE = "Drumee";
const {
  Cache, Constants, Attr, sysEnv, getUiInfo
} = require("@drumee/server-essentials");
const { ID_NOBODY } = Constants;
// const, not let: these are PROCESS-WIDE. `main_domain` used to be reassigned
// per request from getSettings(), which leaked one request's value into every
// later request the worker served. Keeping them const makes that class of bug
// throw at the assignment instead of silently corrupting the next visitor.
const { main_domain, static_dir, endpoint_path, ui_home } = sysEnv();
let manifest_file = join(ui_home, 'app', 'manifest.json')
// mtime-keyed cache so dev rebuilds (webpack rewrites manifest.json) are
// picked up without restarting the server process. Disk read happens once
// per manifest write — negligible compared to the per-request work.
let Manifest;
let _manifestMtime = 0;
function loadManifest() {
  if (!existsSync(manifest_file)) return undefined;
  const mtime = statSync(manifest_file).mtimeMs;
  if (!Manifest || mtime !== _manifestMtime) {
    Manifest = readFileSync(manifest_file);
    _manifestMtime = mtime;
  }
  return Manifest;
}
loadManifest();
class RuntimeEnv extends Entity {

  initialize(opt) {
    if (this._failed || this._isStopped) return;
    super.initialize(opt);
  }

  /**
   * 
   */
  getAppInfo() {
    let conf = { ...getUiInfo() };
    conf.location = endpoint_path;
    conf.entry = `main-${conf.hash}.js`;
    conf.vendor = `vendor-${conf.hash}.js`;
    conf.sprite = `sprite-${conf.hash}.js`;
    conf.locale = `locale-${conf.hash}.js`;
    conf.core = `core-${conf.hash}.js`;
    if (conf.no_hash) {
      conf.entry = `main.js`;
      conf.vendor = `vendor.js`;
      conf.sprite = `sprite.js`;
      conf.locale = `locale.js`;
      conf.core = `core.js`;
    }
    conf.manifest = loadManifest();
    return conf
  }


  /**
   *
   */
  getSettings() {
    const { isObject, isEmpty, values } = require("lodash");
    let settings = {};
    let profile = {};
    let area = Attr.private;
    if (this.hub) {
      settings = this.hub.get("settings") || {};
      profile = this.hub.get("profile") || {};
      area = this.hub.get(Attr.area);
    }
    let title = profile.title || {};
    let meta = profile.meta || [];
    let { description } = settings || {};
    let {
      endpoint_name, domain, instance,
      ws_location, public_ui_root
    } = sysEnv();


    let language = this.input.app_language();
    if (this.user) {
      language = this.user.language() || language;
    }
    if (isEmpty(title)) {
      title = DRUMEE_TITLE;
    } else if (isObject(title)) {
      title = title[language] || title.en || DRUMEE_TITLE;
    }

    if (isObject(description)) {
      description =
        description[language] || values(description)[0] || DRUMEE_TITLE;
    }
    let endpointPath = endpoint_path;
    let websocketPath = join(endpointPath, ws_location);
    const protocol = this.input.get(Attr.protocol);
    let ws_protocol = 'ws';
    if (protocol == 'https') {
      ws_protocol = 'wss';
    }
    const port = this.input.get('server_port');
    let ws_port;
    if (port == 443) {
      ws_port = ''
    } else {
      ws_port = port;
    }

    // A request served through localhost (Host: localhost — internal @vhost
    // calls, a local curl, a health probe) renders its bootstrap against
    // "localhost" instead of the public domain. That substitution is PER
    // REQUEST: it used to assign to the module-scoped `main_domain` above,
    // which is process-wide and never restored, so a SINGLE localhost hit
    // permanently pinned every later page this worker rendered to
    // main_domain: "localhost" — including public ones. The client reads
    // bootstrap().main_domain to build absolute URLs (the share page's
    // Login / Join Workspace / See more buttons open
    // `https://${main_domain}${location.pathname}#/welcome/signin`), so real
    // visitors were sent to https://localhost/. Keep it request-local.
    let localhost = this.input.get(Attr.localhost) || 0;
    const domain_name = localhost ? Attr.localhost : main_domain;
    const res = {
      access: "web",
      area,
      app: this.getAppInfo(),
      appRoot: public_ui_root,
      arch: Cache.getEnv("arch") || "single",
      browsers: "",
      connection: "new",
      description,
      domain,
      endpointName: endpoint_name,
      endpointPath,
      ident: "nobody",
      instance_name: endpoint_name,
      instance,
      language,
      localhost,
      main_domain: domain_name,
      meta,
      ws_port: ws_port || '',
      mfs_base: endpointPath,
      org_name: domain,
      profile,
      protocol,
      servicePath: join(endpointPath, "service/"),
      signed_in: 0,
      static_dir,
      svc: join(endpointPath, "svc/"),
      svcPath: join(endpointPath, "svc/"),
      title,
      uid: ID_NOBODY,
      vdo: join(endpointPath, "vdo/"),
      vdoPath: join(endpointPath, "vdo/"),
      websocketPath,
      ws_port,
      ws_protocol,
      ws_location: websocketPath,
    }
    return res;
  }

  /**
   *
   * @returns
   */
  async getRuntimeEnv() {
    let settings = this.getSettings();
    if (!this.session || !this.user || !this.input) {
      return settings;
    }
    const a = {
      ...settings,
      connection: this.user.get("connection"),
      signed_in: this.user.get("signed_in"),
      uid: this.user.get(Attr.id) || ID_NOBODY,
      user_domain: this.user.get(Attr.domain),
    };
    return a;
  }

  /**
  * 
  */
  getRender(template_dir, fname) {
    const { readFileSync, existsSync } = require('fs');
    let filename = resolve(template_dir, fname);
    if (!existsSync(filename)) {
      this.warn("TEMPLATE_NOTFOUND", filename)
      console.trace()
      return null;
    }
    this.set({ template_dir });
    let x = readFileSync(filename);
    let content = String(x).trim().toString();
    const { template } = require('lodash');
    return template(content, { imports: { renderer: this } });
  }

}

module.exports = RuntimeEnv;
