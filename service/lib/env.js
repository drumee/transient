/**
 * @license
 * Copyright 2024 Thidima SA. All Rights Reserved.
 * Licensed under the GNU AFFERO GENERAL PUBLIC LICENSE, Version 3 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.gnu.org/licenses/agpl-3.0.html
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 * =============================================================================
 */
const {
  Attr, Constants, Cache, toArray, RedisStore, sysEnv, TFauth
} = require("@drumee/server-essentials");

const {
  ID_NOBODY
} = Constants;
const { isEmpty, isString, isArray } = require("lodash");
const { getServices } = require("../../router/rest");
const { main_domain } = sysEnv();

// const { existsSync, readFileSync } = require("fs");
// const { resolve } = require("path");
// const { credential_dir } = sysEnv();
// let keyFile = resolve(credential_dir, `crypto/public.pem`);
// let publicKey;
// if (existsSync(keyFile)) {
//   let publicKey = readFileSync(keyFile);
// }

const TfaMethods = TFauth.Methods.map((e) => {
  return e.type
});

async function get_env() {
  const yp = this.yp;
  let data = {
  };
  let _def_fonts = await yp.await_query(
    "SELECT * FROM font WHERE family='Roboto' ORDER BY `name` ASC"
  );

  const hub = this.hub.toJSON();
  if (!isEmpty(hub.fonts_faces)) {
    hub.fonts_faces = hub.fonts_faces.concat(_def_fonts);
  }
  if (!hub.exists) {
    this.exception.not_found("HUB_NOT_FOUND");
    return;
  }
  data.hub = { ...data.hub, ...hub };
  this.user.set(Attr.quota, {});
  data.user = await this.yp.await_proc("get_user", this.uid) || {};
  let { usage } = await this.yp.await_proc("disk_usage", this.uid) || {};
  data.user.disk_usage = usage;
  data.user.otp_key = this.session.get('secret');
  data.organization = await this.yp.await_proc("my_organisation", this.uid);
  const { main_domain } = sysEnv();
  if (isEmpty(data.organization)) {
    let host = main_domain;
    if (this.uid == ID_NOBODY) {
      host = this.input.host();
    }
    data.organization = await this.yp.await_proc(
      "organisation_get",
      host
    );
  }
  if (isArray(data.organization)) {
    data.organization = data.organization[0] || {};
  }
  data.organization.useEmail = global.myDrumee.useEmail || 0;
  data.user.is_reseller = 0;
  if (data.organization.metadata) {
    data.user.is_reseller = data.organization.metadata.is_reseller || 0;
  } else {
    data.organization.metadata = {};
  }
  data.user.main_domain = main_domain;
  if (this.user.get("signed_in")) {
    data.user.signed_in = 1;
    data.user.connection = "online";
  } else {
    data.user.signed_in = 0;
    data.user.connection = "offline";
  }
  data.user.privilege = data.organization.privilege; // To be use from withon origanization
  data.main_domain = main_domain;
  data.hub = hub;
  data.platform = this.platform()
  return data;
}

/**
 * 
 * @returns 
 */
function platform() {
  let platform = {};
  platform.fonts = [];
  platform.description = Cache.getSysConf('platform_intro_popup_title');
  platform.termsandconditions = Cache.getSysConf('termsandconditions') || '{}';
  if (platform.description) {
    platform.description = JSON.parse(platform.description);
  }

  let wp = Cache.getSysConf("wallpaper");
  if (isString(wp)) {
    platform.wallpaper = JSON.parse(wp);
  } else {
    platform.wallpaper = wp;
  }
  platform.intl = this.supportedLanguage();
  platform.arch = global.myDrumee.arch || "pod";
  platform.cdnHost = global.myDrumee.cdnHost;
  platform.version = global.VERSION;
  platform.TfaMethods = TfaMethods;
  if (
    global.myDrumee.isPublic &&
    global.myDrumee.useEmail &&
    global.myDrumee.arch == "cloud"
  ) {
    platform.isPublic = 1;
  }

  platform.plugins = Cache.getSysConf("plugins");
  platform.services = getServices();
  platform.endpoint = this.input.basepath();
  return platform;
}


module.exports = { get_env, platform };
