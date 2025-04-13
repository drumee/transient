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
const {Entity}   = require('@drumee/server-core');


//########################################
class __font extends Entity {


  /**
   * 
   * @returns 
   */
  font_list() {
    const page      = this.input.use('page', 1);
    this.debug(`font_list page=${page}`);
    return this.db.call_proc('font_list', page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  font_search() {
    const value     = this.input.use(Attr.value, "a");
    const page      = this.input.use(Attr.page, 1);
    this.debug(`font_search value=${value} page=${page}`);
    return this.db.call_proc('plf_search_fonts', value, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  font_get() {
    const id     = this.input.use(Attr.id);
    this.debug(`font_search value=${id} `);
    return this.db.call_proc('font_get', id, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_classes() {
    this.debug("font_get_classes");
    return this.db.call_proc('font_get_classes', this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_files() {
    this.debug("font_get_files");
    return this.db.call_proc('font_get_files', this.output.data);
  }
}



module.exports = __font;
