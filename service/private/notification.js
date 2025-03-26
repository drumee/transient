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
const { Attr, nullValue } = require("@drumee/server-essentials");
const {keys} = require("lodash");


/**
 *
 */
const { Entity } = require("@drumee/server-core");
class __private_notification extends Entity {
  constructor(...args) {
    super(...args);
    this.clear_all = this.clear_all.bind(this);
  }

  /**
   * To clear notifications
   * @params {array} nodes    - list of mfs nodes to be reset
   * @params {array} messages - list of mfs nodes to be reset
   */
  async clear_all() {
    const nodes = this.input.need(Attr.nodes) || [];
    const messages = this.input.need(Attr.messages) || [];
    let hubs;
    hubs = keys(nodes);
    for (let n of hubs) {
      if (nullValue(n)) continue;
      let hub = await this.yp.await_proc("get_hub", n);
      let json = JSON.stringify(nodes[n]);
      if (hub.db_name) {
        await this.yp.await_proc(
          `${hub.db_name}.mfs_clear_notifications`,
          json,
          this.uid
        );
      }
    }
    hubs = keys(messages);
    for (let n of hubs) {
      if (nullValue(n)) continue;
      let hub = await this.yp.await_proc("get_hub", n);
      if (hub.db_name) {
        await this.yp.await_proc(
          `${hub.db_name}.channel_clear_notifications`,
          this.uid
        );
      }
    }
    this.output.list(nodes);
  }
}

module.exports = __private_notification;
