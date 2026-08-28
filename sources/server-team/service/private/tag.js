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
const { Attr, Constants } = require("@drumee/server-essentials");

const Tag = require("../tag");
const { isEmpty } = require("lodash");


class __private_tag extends Tag {

  /**
   * 
   * @returns 
   */
  store() {
    const sys_id = this.input.use(Attr.serial, 0);
    let id = this.input.use(Attr.hashtag);
    if (isEmpty(id)) {
      id = this.input.need(Attr.id);
    }
    const lang = this.input.use(Attr.lang_code, "[]");
    const type = this.input.need(Attr.type);
    const name = this.input.need(Attr.name);
    const cb = function (data) {
      if (!isEmpty(data) && data.error === undefined) {
        this.output.data(data);
      } else if (!isEmpty(data) && data.error === Constants.ID_NOT_FOUND) {
        this.exception.user(Constants.INVALID_DATA);
      } else {
        this.exception.server(Constants.INTERNAL_ERROR);
      }
    }.bind(this);
    return this.db.call_proc("tag_save", sys_id, id, lang, type, name, cb);
  }

  /**
   * 
   * @returns 
   */
  delete() {
    const sys_id = this.input.need(Attr.serial);
    return this.db.call_proc("tag_delete", sys_id, this.output.data);
  }
}

module.exports = __private_tag;
