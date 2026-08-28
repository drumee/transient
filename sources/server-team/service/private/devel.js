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
const { Cache } = require("@drumee/server-essentials");

/** ===================== */
const Devel = require("../devel");
class __devel extends Devel {
  /**
   * DEBUG_FLAGS = 0b1111111; // error|warn|info|http|verbose|debug|sylly
   */
  log_over_socket() {
    let flags = this.input.get("flags");
    if (flags) {
      global.debug_flags = flags;
      global.debug_dest = {
        socket_id: this.input.get(Attr.socket_id),
        server: Cache.getEnv(Attr.endpointAddress),
        uid: this.uid,
        service: this.input.get(Attr.service),
      };
    }
    this.output.data({ flags, dest: global.debug_dest });
  }

  /**
   *
   */
  verbosity() {
    let l = this.input.get("level");
    if (l > 0) {
      global.verbosity = l;
      Cache.setEnv({ verbosity: l });
    }
    this.notice("NEW VERBOSITY", l, global.verbosity);
    this.output.data({ verbosity: l });
  }
}

module.exports = __devel;
