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
const { Entity } = require('@drumee/server-core');
const { Attr } = require("@drumee/server-essentials");

//########################################
class __contact extends Entity {

  constructor(...args) {
    super(...args);
    this.invite_status = this.invitation_status.bind(this);
  }

  /**
   * 
   */
  invitation_status() {
    let token = this.input.need(Attr.token);
    let uid = this.input.use(Attr.uid);
    this.yp.call_proc('contact_invitation_status', token, uid, this.output.data);
  }

}



module.exports = __contact;
