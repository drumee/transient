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

const {Mfs} = require('@drumee/server-core');

//########################################
class __private_reminder extends Mfs {


  /**
   * 
   */
  async create() {
    let task = this.input.need('task');
    let data = await this.yp.await_proc('reminder_create', this.uid, task);
    this.output.data(data);
  }

  /**
   * 
   */
  async update() {
    const id = this.input.need(Attr.id);
    const task = this.input.need('task');
    let data = await this.yp.await_proc('reminder_update', id, task);
    this.output.data(data);
  }

  /**
   * 
   */
  async remove() {
    const id = this.input.need(Attr.id);
    await this.yp.await_proc('reminder_remove', { id });
    this.output.data({ id });
  }

  /**
   * 
   */
  async list() {
    let data = await this.yp.await_proc('reminder_list', this.uid);
    this.output.list(data);
  }

  /**
   * 
   */
  async read() {
    let task = {
      id: this.input.get('reminder_id'),
      nid: this.input.get(Attr.nid),
      hub_id: this.input.get(Attr.hub_id),
      uid: this.uid,
    };

    task = await this.yp.await_proc('reminder_get', task);
    this.output.data(task);
  }

}

module.exports = __private_reminder;
