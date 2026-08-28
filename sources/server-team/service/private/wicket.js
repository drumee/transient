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
const Media = require("../media");
const { Attr } = require("@drumee/server-essentials");

class __private_wicket extends Media {
  /**
   *
   */
  async create_external_meeting() {
    let lang = this.user.get(Attr.profile).lang || "en";
    const Moment = require("moment");
    Moment.locale(lang);
    let emails = this.input.need(Attr.emails);
    let title =
      this.input.use("title") ||
      Moment(Moment.now() / 1000, "X").format("LLLL");
    if (title.length > 100) {
      title = title.slice(0, 100);
    }
    let message = this.input.need(Attr.message);
    let args = {
      owner_id: this.uid,
      filename: title,
      pid: this.home_id,
      category: "schedule",
      ext: "",
      mimetype: "application/json",
      filesischeduleze: 0,
    };

    let results = { show: 1 };
    let node = await this.db.await_proc("mfs_create_node", args, {}, results);

    let r = await this.db.await_proc(
      "mfs_set_metadata",
      node.id,
      { content: { emails, title, message, room_id: node.id } },
      1
    );
    await this.db.await_proc("room_book", this.uid, node.id, "meeting");
    this.output.data(r);
  }
}

module.exports = __private_wicket;
