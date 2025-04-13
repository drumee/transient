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
const { Entity } = require('@drumee/server-core');
const DRUMEE_PUB_KEY = '/etc/drumee/publickeys/drumee.com.pem';
const { verifyMessage } = require("@drumee/server-essentials").subtleCrypto;
const { Cache } = require("@drumee/server-essentials");
const { existsSync } = require('fs');

//########################################
class __input extends Entity {


  /**
   * 
   */
  async updateLicence() {
    let { signature, content } = this.input.data();
    //console.log("AAA:27XX", { signature, content }, this.input.data());
    let verified = false;
    if(!existsSync(DRUMEE_PUB_KEY)){
      return this.exception.server("DRUMEE_PUB_KEY_NOT_FOUND");
    }

    try {
      verified = await verifyMessage({ signature, content }, DRUMEE_PUB_KEY);
      if (verified) {
        console.log("AAA:32XX verified", { verified, signature, content});
        await this.yp.await_proc("sys_conf_set", 'licence_content', content);
        console.log("AAA:34XX NEW");
        await this.yp.await_proc("sys_conf_set", 'licence_signature', signature);
        console.log("AAA:36XX NEW");
        await Cache.load(this.yp, 1);
        console.log("AAA:38XX NEW");
        let current = await this.yp.await_func("sys_conf_get", 'licence_content');
        console.log("AAA:40XX NEW", current);

      }
    } catch (e) {
      this.warn("ERR:44", e);
    }
    this.output.data({ verified });
  }

}

module.exports = __input;
