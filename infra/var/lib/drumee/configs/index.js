const { readFileSync } = require(`jsonfile`);
const { existsSync } = require(`fs`);
const {join} = require("path");
function sysConfigs() {
  let {
    acme_dir,
    acme_email_account,
    acme_store,
    ca_server,
    cache_dir,
    credential_dir,
    data_dir, 
    db_user, 
    domain_desc, 
    domain_name, 
    drumee_root,
    own_certs_dir,
    own_ssl,
    system_group, 
    system_user, 
  } = readFileSync(`/etc/drumee/drumee.json`);
  let exchanges = {};
  if(existsSync){
    exchanges = readFileSync(`/etc/drumee/conf.d/exchange.json`);
  }
  let {export_dir, import_dir} = exchanges;
  const certs_dir = join(acme_dir, "certs");
  const mfs_dir = join(data_dir, "mfs");
  const public_ui_root = "/_";
  const quota_watermark = Infinity;
  const rewite_root = "/";
  const runtime_dir = join(drumee_root, 'runtime');
  const static_dir = join(drumee_root, 'static');
  const server_dir = join(runtime_dir, 'server');
  const log_dir = join(server_dir, ".pm2/logs");
  const svc_location = join(public_ui_root, "service");
  const ui_base = join(runtime_dir, 'ui');
  const ui_location = "/ui/";
  const verbosity = 3;
  const ws_location = "/websocket/";
  return {
    acme_dir,
    acme_email_account,
    acme_store,
    ca_server,
    cache_dir,
    certs_dir,
    credential_dir,
    data_dir, 
    db_user, 
    domain_desc, 
    domain_name, 
    domain: domain_name,
    drumee_root,
    export_dir,
    import_dir,
    log_dir,
    mfs_dir,
    own_certs_dir,
    own_ssl,
    public_ui_root,
    quota_watermark,
    rewite_root,
    runtime_dir,
    server_dir,
    static_dir,
    svc_location,
    system_group, 
    system_user,   
    ui_base,
    ui_location,
    verbosity,
    ws_location,
  }
}
module.exports = sysConfigs;