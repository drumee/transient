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
const { readFileSync, existsSync } = require('fs');
const { resolve } = require('path');
const keyFile = '/etc/drumee/credential/crypto/public.pem';
const { RuntimeEnv } = require('@drumee/server-core');
const { uniqueId, Attr } = require("@drumee/server-essentials");
const TPL_BASE = "client/templates";

class __bootstrap extends RuntimeEnv {

  /**
   * 
   */
  async js() {
    let type = this.input.get(Attr.type) || 'text/javascript';
    let data = await this.getRuntimeEnv();
    data = { ...this.hub.toJSON(), ...data, type };
    let auth = this.input.authorization();
    data.keysel = auth.keysel || Attr.regsid;
    this.set({ data });
    this.output.setAuthorization(auth);
    const template_dir = resolve(__dirname, '..', TPL_BASE);
    let content = this.getRender(template_dir, "bootstrap.js.tpl")(data);
    this.output.javascript(content);
  }

  /**
   * 
   */
  async dom() {
    let type = 'text/javascript';
    let data = await this.getRuntimeEnv();
    data = { ...this.hub.toJSON(), ...data, type };
    let auth = this.input.authorization();
    data.host = this.input.host();

    data.keysel = auth.keysel || Attr.regsid;
    this.set({ data });
    this.output.setAuthorization(auth);
    const template_dir = resolve(__dirname, '..', TPL_BASE);
    let content = this.getRender(template_dir, "bootstrap.dom.tpl")(data);
    this.output.javascript(content);
  }

  /**
   * 
   */
  async publicKey() {
    if (existsSync(keyFile)) {
      let key = readFileSync(keyFile);
      this.output.text(key);
    } else {
      this.output.text("-----NO PUBLIC KEY-----");
    }
  }

  /**
   * 
   */
  async authn() {
    let token = uniqueId(22);
    let auth = this.input.authorization();
    let otp_key = this.user.get('otp_key');
    let data = { token };
    if (otp_key) data.otp_key = otp_key;
    if (/^(dmz|share)$/.test(this.hub.get(Attr.area))) {
      auth.type = Attr.guest;
    }
    await this.yp.await_proc(`authn_store`, token, auth);
    this.output.data(data);
  }

  /**
   * 
   */
  getSyncTimes() {
    const t2 = this.input.timestamp();
    const t3 = Date.now()
    this.output.data({ t2, t3 });
  }

}

module.exports = __bootstrap;
