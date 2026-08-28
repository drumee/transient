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

const { PAGE } = Constants;

/** ==========================================  */
const { Entity } = require('@drumee/server-core');
class __util extends Entity {



  /**
   * 
   * @returns 
   */
  get_countries() {
    const page = this.input.use(PAGE, 1);
    const length = this.input.use('length', 10);
    return this.yp.call_proc('utils_get_countries', page, length, this.output.data);
  }

  /**
   * 
   */
  search_countries() {
    const name = this.input.use(Attr.value) || this.input.use(Attr.name) || '';
    const page = this.input.use(PAGE, 1);
    return this.yp.call_proc('utils_search_countries', name, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_cities() {
    const country_id = this.input.need(Attr.id);
    const page = this.input.use(PAGE, 1);
    return this.yp.call_proc('yp_get_cities', country_id, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  search_cities() {
    const name = this.input.use(Attr.value) || this.input.use(Attr.name) || '';
    const page = this.input.use(PAGE, 1);
    return this.yp.call_proc('utils_search_cities', name, page, this.output.data);
  }
}

module.exports = __util;
