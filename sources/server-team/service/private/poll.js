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
/**  
 * Experimental
 * Planned to hande poll form
*/
const { Attr } = require("@drumee/server-essentials");
const Poll      = require('../poll');

//########################################
class __private_poll extends Poll {

  /**
   * 
   * @param {*} error 
   * @param {*} info 
   */
  init(error, info) {
    const {
      ident
    } = this.get(Attr.visitor);
    const name          = this.get(Attr.visitor).fullname;
    const referrer      = this.input.use(Attr.id);
    const ip            = this.input.use(Attr.id);
    this.db.call_proc('poll_create', ident, name, referrer, ip, this.output.data);
  }
      
  /**
   * 
   * @returns 
   */
  create() {
    const {
      id
    } = this.get(Attr.visitor);
    const {
      ident
    } = this.get(Attr.visitor);
    const name          = this.get(Attr.visitor).fullname;
    const referrer      = this.input.use(Attr.id);
    const ip            = this.input.use(Attr.id);
    return this.db.call_proc('poll_init', id, ident, name, referrer, ip, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_list() {
    const {
      id
    } = this.get(Attr.visitor);
    return this.db.call_proc('poll_get', id, this.output.data);
  }
}

module.exports = __private_poll;
