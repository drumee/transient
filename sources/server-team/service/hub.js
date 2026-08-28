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
const { Attr, sysEnv } = require("@drumee/server-essentials");
const { main_domain } = sysEnv()
const { Entity } = require('@drumee/server-core');


//########################################
class __history extends Entity {
  /**
   * 
   */
  logo() {
    let icon = this.hub.get(Attr.icon) || '';
    let vhost = this.hub.get(Attr.vhost) || main_domain;
    let url = icon;
    let proto = this.input.get(Attr.protocol);
    if (this.input.get(Attr.localhost)) {
      if (/^\//.test(icon)) {
        url = `${proto}://${Attr.localhost}/-/svc/@{vhost}/media.raw?p=${icon}`
      } else if (!/^http/.test(icon)) {
        url = `${proto}://${icon}`;
      }
    } else {
      if (/^\//.test(icon)) {
        url = `${proto}://${vhost}${icon}`
      } else if (!/^http/.test(icon)) {
        url = `${proto}://${icon}`;
      }
    }
    this.output.data({ url });
  }

  /**
   * 
   */
  login_image() {
    this.db.call_proc('hub_get_login_image', user_id, page, this.output.list);
  }

}


module.exports = __history;
