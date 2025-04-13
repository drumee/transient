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
const Socket   = require('./index');

//########################################
class __push_notifier extends Socket {


// ========================
//
// ========================
  constructor(...args) {
    super(...args);
    this.get_count = this.get_count.bind(this);
    this.notify = this.notify.bind(this);
  }

  get_count(data, service) {
    this.yp.call_proc('yp_notification_count', this.user.uid(), function(rows){
      this.echo(rows[0]);
    }.bind(this)); 
  }

// ========================
//
// ========================
  notify(recipient, data) {
    this.sendTo(recipient, data);
  }
}

module.exports = __push_notifier;

