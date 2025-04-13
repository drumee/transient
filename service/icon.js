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
const { Attr, Constants} = require("@drumee/server-essentials");
const { PAGE } = Constants;
const { Entity } = require('@drumee/server-core');


//########################################
class __icon extends Entity {

  /**
   * 
   * @returns 
   */
  icon_list() {
    const page = this.input.use(PAGE, 1);
    this.debug(`icon_list page=${page}`);
    return this.db.call_proc('mfs_list_by', 'vector', page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  plateform_list() {
    const page = this.input.use(PAGE, 1);
    this.debug(`plateform_list page=${page}`);
    return this.db.call_proc('yp.plf_icons_list', page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  icon_search() {
    const value = this.input.use(Attr.value, "a");
    const page = this.input.use(Attr.page, 1);
    this.debug(`icon_search value=${value} page=${page}`);
    return this.db.call_proc('mfs_search', value, 'vector', page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  plateform_search() {
    const page = this.input.use(PAGE, 1);
    const value = this.input.use("string", "a");
    this.debug(`plateform_search page=${page}`);
    return this.db.call_proc('yp.plf_icons_search', value, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  icon_get() {
    const id = this.input.use(Attr.id);
    this.debug(`icon_search value=${id} `);
    return this.db.call_proc('mfs_file_stat', id, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_classes() {
    this.debug("icon_get_classes");
    return this.db.call_proc('icon_get_classes', this.output.data);
  }

  /**
   * 
   * @returns 
   */
  icon_plateforme() {
    this.debug("icon_get_files");
    return this.db.call_proc('icon_get_files', this.output.data);
  }
}



module.exports = __icon;
