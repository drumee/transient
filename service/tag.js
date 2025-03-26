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
const { Attr } = require("@drumee/server-essentials");

/** =============================================== ** */
const { Entity } = require('@drumee/server-core');
class __tag extends Entity {

  initialize(opt) {
    this._start_with = 'block_home';
    super.initialize(opt);
  }


  /**
   * 
   * @returns 
   */
  list() {
    const page = this.input.use(Attr.page, 1);
    let lang = this.input.use('Xlang') || this.lang();
    if (['zh', 'fr', 'en'].includes(lang)) {
      lang = lang;
    } else {
      lang = 'en';
    }
    return this.db.call_proc('tag_list_by_lang', lang, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_by_name() {
    const page = this.input.use(Attr.page, 1);
    const name = this.input.need(Attr.name);
    return this.db.call_proc('tag_get_by_name', name, page, this.output.data);
  }
}

module.exports = __tag;
