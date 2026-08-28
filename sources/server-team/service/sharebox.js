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
const { isArray } = require("lodash");
const { Attr } = require("@drumee/server-essentials");
const { Mfs } = require("@drumee/server-core");

//########################################
class __sharebox extends Mfs {
  // ========================
  // Notification count
  // ========================
  constructor(...args) {
    super(...args);
    this.notification_count = this.notification_count.bind(this);
    this.notification_list = this.notification_list.bind(this);
    this.download = this.download.bind(this);
  }

  /**
   *
   */
  notification_count() {
    return this.output.data({});
  }


  /**
   *
   */
  notification_list() {
    return this.output.data({});
  }

  /**
   *
   */
  async download() {
    const nid = this.input.need(Attr.nid);
    const share_id = this.input.need(Attr.share_id);
    if (isArray(nid)) {
      return nid.map((id) => this.debug("zzzzzz", id));
    } else {
      const page = this.input.use(Attr.page) || 0;
      let r = await this.send_media(nid, Attr.folder);
      return r;
    }
  }
}

module.exports = __sharebox;
