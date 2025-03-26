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
const Form = require('../form');

//########################################
class __private_form extends Form {

  /**
   * 
   * @param {*}  
   */
  async browse() {
    let page = this.input.get(Attr.page) || 1;
    let node = this.source_granted().node;
    let range = 20;
    let offset = range * (page - 1) ;
    let table = `form_${node.id}`;
    let sql = `SELECT * FROM ${table} ORDER BY ctime DESC LIMIT ${offset}, ${range}`;
    let data = await this.db.await_run(sql);
    this.output.data(data);
  }

}

module.exports = __private_form;
