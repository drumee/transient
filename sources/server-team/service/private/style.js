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
/** =========================== */
const Style    = require('../style');
class __private_style extends Style {


  /**
   * 
   */
  create() {
    const name        = this.input.need(Attr.name);
    const selector    = this.input.use(Attr.selector, "");
    const style       = this.input.need(Attr.style);
    const comment     = this.input.use(Attr.comment);
    //@debug "style_create ", name, selector, style, comment
    this.db.call_proc('style_create', name, selector, style, comment, this.output.data);
  }

  /**
   * 
   */
  remove() {
    const id        = this.input.need(Attr.id);
    this.db.call_proc('style_remove', id, this.output.data);
  }

  /**
   * 
   */
  rename() {
    const id     = this.input.need(Attr.id);
    const name   = this.input.need(Attr.name);
    this.db.call_proc('style_rename', id, name, this.output.data);
  }


  /**
   * 
   */
  save() {
    const id      = this.input.need(Attr.id);
    const style   = this.input.need(Attr.style);
    this.db.call_proc('style_save', id, style, this.output.data);
  }
}


module.exports = __private_style;
