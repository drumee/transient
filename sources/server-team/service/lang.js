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


class __lang extends Entity {


  constructor(...args) {
    super(...args);
    this.add = this.add.bind(this);
    this.yp_available_languages = this.yp_available_languages.bind(this);
    this.get_languages = this.get_languages.bind(this);
    this.get_pages = this.get_pages.bind(this);
  }

  initialize(opt) {
    super.initialize(opt);
    this._block_root = `${this.hub.get(Attr.home_dir)}/Block`;
  }

  /**
   * 
   * @returns 
   */
  add() {
    return this.output.data({});
  }

  /**
   * 
   * @returns 
   */
  yp_available_languages() {
    const name        = this.input.use(Attr.name, "");
    const page        = this.input.use(Attr.page) || 1;
    return this.db.call_proc('language_available_list', name, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_languages() {
    const page        = this.input.use(Attr.page) || 1;
    return this.db.call_proc('language_get_list', page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  get_pages() {
    const i = this.input;
    const locale      = i.get(Attr.locale) || i.language() || i.app_language() || 'en';
    const published   = i.need(Attr.published);
    const name        = i.get(Attr.name) || "";
    const sort_by     = i.get(Attr.sort_by) || Attr.date;
    const sort        = i.need(Attr.sort);
    const page        = i.get(Attr.page) || 1;
    return this.db.call_proc('block_get_draft_publish', locale, published, name, sort_by, sort, page, this.output.data);
  }
}
    
module.exports = __lang;
