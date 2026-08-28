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
const { Entity } = require('@drumee/server-core');
const { isEmpty } = require('lodash');

//########################################
class __private_addressbok extends Entity {

  /**
   * 
   * @returns 
   */
  add() {
    let phone;
    const email = this.input.need(Attr.email);
    const name = this.input.need(Attr.name);
    phone = this.input.use(Attr.phone);
  }

  /**
   * 
   * @returns 
   */
  delete() {
    const id = this.input.use(Attr.id) || this.input.need(Attr.email);
    this.db.call_proc('drumate_delete_contact', id, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  search() {
    const name = this.input.use(Attr.name, "");
    const page = this.input.use('page', 1);
    if (isEmpty(name)) {
      this.output.data([]);
      return;
    }
    this.db.call_proc('search_my_contacts', name, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  search_personal_contacts() {
    const name = this.input.use(Attr.name, "");
    const page = this.input.use('page', 1);
    if (isEmpty(name)) {
      this.output.data([]);
      return;
    }
    this.db.call_proc('search_personal_contacts', name, page, this.output.data);
  }

  /**
   * 
   * @returns 
   */
  search_all_contacts() {
    const name = this.input.use(Attr.name, "");
    const page = this.input.use('page', 1);
    if (isEmpty(name)) {
      this.output.data([]);
      return;
    }
    this.db.call_proc('search_all_contacts', name, page, this.output.data);
  }
}


module.exports = __private_addressbok;
