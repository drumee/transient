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
const { Attr } = require("@drumee/server-essentials");

class Changelog extends Entity {

  /**
   * 
   */
  async read() {
    let args = {
      uid: this.uid,
      last: this.input.get('last'),
      id: this.input.get(Attr.id),
      page: this.input.get(Attr.page),
      exclude: this.input.get(Attr.exclude),
    }
    for (let k in args) {
      if (!args[k]) delete args[k]
    }
    let r = await this.yp.await_proc(`changelog_read`, args) || [];
    this.output.list(r);
  }

}

module.exports = Changelog;
