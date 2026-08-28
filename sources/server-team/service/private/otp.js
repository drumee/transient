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
const Public = require("../otp")
class Otp extends Public {
  /**
   * 
   */
  async set_password() {
    const uid = this.input.need(Attr.uid);
    const code = this.input.need(Attr.code);
    const secret = this.input.need(Attr.secret);
    const password = this.input.need(Attr.password);
    let otp = await this._verify(uid);
    let user
    if (otp.code == code) {
      await this.yp.await_proc("set_password", uid, password);
      user = await this.yp.await_proc("get_user", uid);
      let res = await this.session.signin({ username: uid, password });
      res.status = "ok";
      await this.yp.await_query("DELETE FROM secret WHERE code=? AND secret=?", code, secret);
      this.output.data(res);
      return;
    }

    return this.output.data({ error: 1, status: "wrong-otp", message: "Wrong otp" });
  }

}


module.exports = Otp;
